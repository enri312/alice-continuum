import { invoke, isTauri } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../cognitive/activity-session";
import { acceptWorkingMemoryResponse, reloadMemoryFromDisk } from "../memory/memory-session";
import type { MemoryRetrievalObservation } from "../memory/retrieval-observation";
import { observationSnapshot, readObservationGateway } from "../governance/observation-session";
import { parseVoiceOutputPreview, parseVoiceOutputResult, type VoiceOutputPreview, type VoiceOutputResult } from "../voice/voice-output";
import { parseVoiceTurnTranscript, type VoiceTurnTranscript } from "../voice/voice-input";
import { supportsConversationBehavior } from "./behavior-settings";
import type { CloudRequest, CloudResponse, HybridRetrievalPreview, HybridRetrievalRequest, SendAuthorization } from "./conversation-contracts";
import {
  parseConversationLearningConfirmation, parseConversationLearningPreview,
  type ConversationLearningApproval, type ConversationLearningCandidate, type ConversationLearningPreview,
} from "./conversation-learning";
import { beginConversationTurn, completeConversationRetrieval, endConversationTurn, recordConversationResponse, selectCloudProvider } from "./conversation-session";
import type { VisionInput } from "./vision-session";

async function verifyWindowPermission(revision: number | undefined, window: NonNullable<SendAuthorization["window"]>) {
  const message = "Cambi? el permiso o el contexto de la ventana. Revis? nuevamente el mensaje antes de procesarlo.";
  try {
    await readObservationGateway();
  } catch {
    throw new Error(message);
  }
  const { grant, revision: verifiedRevision, foregroundContext } = observationSnapshot();
  if (!grant || grant.expiresAt <= Date.now() || revision !== verifiedRevision
      || foregroundContext?.windowTitle !== window.windowTitle || foregroundContext.processName !== window.processName) {
    throw new Error(message);
  }
}

export async function sendConversationTurn(
  request: CloudRequest,
  recalledMemoryIds: string[],
  retrieval: MemoryRetrievalObservation | undefined,
  captureVision: () => Promise<VisionInput | undefined>,
  authorization?: SendAuthorization,
) {
  if (!isTauri()) throw new Error("El env?o requiere la aplicaci?n de escritorio.");
  const observationRevision = authorization?.window ? observationSnapshot().revision : undefined;
  const behavior = beginConversationTurn(request.message.trim(), request.memoryCount > 0, retrieval);
  try {
    const authorizedRequest = { ...request, behavior: supportsConversationBehavior(request.provider) ? { ...behavior } : undefined };
    const vision = await captureVision();
    if (authorization?.window) await verifyWindowPermission(observationRevision, authorization.window);
    authorization?.verifyReview();
    recordEvent("PERCEPTION", "INFERENCE_PREFLIGHT_APPROVED", `${request.provider}/${request.model} ? historial ${request.historyCount} ? RAG ${request.memoryCount}`);
    const response = await invoke<CloudResponse>("send_cloud_message", { request: { ...authorizedRequest, ...(vision ? { vision } : {}) } });
    completeConversationRetrieval(response.responseId, response.memoryContextMode);
    if (response.workingMemory) acceptWorkingMemoryResponse(response.workingMemory);
    recordConversationResponse(request, response, new Date().toISOString());
    if (response.workingMemoryError) recordEvent("SECURITY", "WORKING_MEMORY_RECORD_ERROR", response.workingMemoryError, "WARN");
    if (response.conversationHistoryError) recordEvent("SECURITY", "CONVERSATION_HISTORY_RECORD_ERROR", response.conversationHistoryError, "WARN");
    if (recalledMemoryIds.length && response.memoryContextMode === "full") recordEvent("MEMORY", "MEMORY_RETRIEVAL_AWAITING_FEEDBACK", `${recalledMemoryIds.length} recuerdo${recalledMemoryIds.length === 1 ? "" : "s"} incluido${recalledMemoryIds.length === 1 ? "" : "s"} en el contexto ? utilidad a?n no confirmada`);
    recordEvent("OUTPUT", "CLOUD_RESPONSE", `${response.provider}/${response.model} ? ${response.inputTokens} entrada ? ${response.outputTokens} salida`);
    return response;
  } catch (error) {
    recordEvent("SECURITY", "CLOUD_REQUEST_ERROR", String(error), "WARN");
    throw error;
  } finally {
    endConversationTurn();
  }
}

export async function previewHybridMemoryRetrieval(request: HybridRetrievalRequest) {
  if (!isTauri()) throw new Error("La ampliación con Gemma requiere la aplicación de escritorio.");
  try {
    const preview = await invoke<HybridRetrievalPreview>("preview_hybrid_memory_retrieval", { request });
    recordEvent("MEMORY", "HYBRID_RETRIEVAL_PREVIEW", `${preview.matches.length} candidatos ordenados localmente · no persistidos · revisión humana requerida`);
    return preview;
  } catch (error) {
    recordEvent("SECURITY", "HYBRID_RETRIEVAL_PREVIEW_ERROR", String(error), "WARN");
    throw error;
  }
}

export async function previewConversationLearning(exchangeId: string) {
  if (!isTauri()) throw new Error("La propuesta de recuerdo requiere la aplicación de escritorio.");
  const preview = parseConversationLearningPreview(await invoke<unknown>("preview_conversation_learning", { input: { exchangeId } }));
  recordEvent("MEMORY", "CONVERSATION_LEARNING_PREVIEW", `${preview.candidates.length} propuestas locales · no persistidas · sólo evidencia del propietario`);
  return preview;
}

export async function confirmConversationLearning(preview: ConversationLearningPreview, candidate: ConversationLearningCandidate, approved: ConversationLearningApproval) {
  if (!isTauri()) throw new Error("La confirmación de recuerdo requiere la aplicación de escritorio.");
  const result = parseConversationLearningConfirmation(await invoke<unknown>("confirm_conversation_learning", { input: {
    exchangeId: preview.exchangeId,
    expectedConversationSha256: preview.sourceSha256,
    expectedMemorySha256: preview.memorySha256,
    candidate,
    approved,
    confirmed: true,
  } }));
  await reloadMemoryFromDisk();
  recordEvent("MEMORY", result.alreadyConfirmed ? "CONVERSATION_LEARNING_DUPLICATE" : "CONVERSATION_LEARNING_CONFIRMED", `${result.recordId} · confirmado por el propietario · ${result.recordCount} recuerdos locales`);
  return result;
}

export async function previewVoiceOutput(exchangeId: string): Promise<VoiceOutputPreview> {
  if (!isTauri()) throw new Error("La voz de Alice requiere la aplicación de escritorio.");
  const preview = parseVoiceOutputPreview(await invoke<unknown>("preview_voice_output", { input: { exchangeId } }));
  recordEvent("OUTPUT", "VOICE_OUTPUT_PREVIEW", `${preview.characterCount}/${preview.characterLimit} caracteres · Fish Audio · sin audio persistente`);
  return preview;
}

export async function confirmVoiceOutput(requestId: string): Promise<VoiceOutputResult> {
  if (!isTauri()) throw new Error("La voz de Alice requiere la aplicación de escritorio.");
  const result = parseVoiceOutputResult(await invoke<unknown>("confirm_voice_output", { input: { requestId, confirmed: true } }));
  recordEvent("OUTPUT", "VOICE_OUTPUT_COMPLETE", `${result.characterCount} caracteres · ${result.durationMs} ms · MP3 temporal · sin memoria ni archivo`);
  return result;
}

export async function cancelVoiceOutput(requestId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke<unknown>("cancel_voice_output", { input: { requestId } });
  recordEvent("OUTPUT", "VOICE_OUTPUT_CANCELLED", "Vista previa descartada antes de enviar texto a Fish Audio.");
}

export async function prepareVoiceTurn(): Promise<void> {
  if (!isTauri()) throw new Error("La voz requiere la aplicación de escritorio.");
  const runtime = await invoke<{ running: boolean }>("start_local_runtime");
  if (!runtime.running) throw new Error("Gemma no está listo para escuchar.");
  selectCloudProvider("llamacpp");
  recordEvent("PERCEPTION", "VOICE_TURN_READY", "Gemma preparado por solicitud del propietario; micrófono todavía apagado.");
}

export async function startVoiceSession(): Promise<string> {
  const session = await invoke<{ sessionId: string }>("start_voice_session");
  try {
    await prepareVoiceTurn();
    return session.sessionId;
  } catch (error) {
    await stopVoiceSession(session.sessionId).catch(() => undefined);
    throw error;
  }
}

export async function stopVoiceSession(sessionId: string): Promise<void> {
  await invoke("stop_voice_session", { input: { sessionId } });
}

export async function speakVoiceSession(exchangeId: string, sessionId: string): Promise<VoiceOutputResult> {
  return parseVoiceOutputResult(await invoke("speak_voice_session_response", { input: { exchangeId, sessionId } }));
}

export async function transcribeVoiceTurn(audioBase64: string, mimeType: string, sessionId?: string): Promise<VoiceTurnTranscript> {
  if (!isTauri()) throw new Error("La transcripción de voz requiere la aplicación de escritorio.");
  const result = parseVoiceTurnTranscript(await invoke<unknown>("transcribe_voice_turn", { input: { audioBase64, mimeType, confirmed: true, ...(sessionId ? { sessionId } : {}) } }));
  recordEvent("PERCEPTION", result.noSpeech ? "VOICE_TURN_NO_SPEECH" : "VOICE_TURN_TRANSCRIBED", `${result.model} · ${result.durationMs} ms · audio descartado · borrador no enviado`);
  return result;
}
