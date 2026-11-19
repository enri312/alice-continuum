import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../../../core/cognitive/activity-session";
import { acceptWorkingMemoryResponse, reloadMemoryFromDisk } from "../../../core/memory/memory-session";
import { beginMemoryRetrieval, completeMemoryRetrieval, emptyMemoryRetrieval, failMemoryRetrieval, observePreparedMemory, type MemoryRetrievalObservation } from "../../../core/memory/retrieval-observation";
import { parseVoiceOutputPreview, parseVoiceOutputResult, type VoiceOutputPreview, type VoiceOutputResult } from "../../../core/voice/voice-output";
import { parseVoiceTurnTranscript, type VoiceTurnTranscript } from "../../../core/voice/voice-input";
import { supportsConversationBehavior } from "../../../core/conversation/behavior-settings";
import type { CloudRequest, CloudResponse, HybridRetrievalPreview, HybridRetrievalRequest } from "../../../core/conversation/conversation-contracts";
import { parseConversationLearningConfirmation, parseConversationLearningPreview, type ConversationLearningApproval, type ConversationLearningCandidate, type ConversationLearningPreview } from "../../../core/conversation/conversation-learning";
import { beginConversationTurn, endConversationTurn, recordConversationResponse, selectCloudProvider } from "../../../core/conversation/conversation-session";
import type { VisionInput } from "../../../core/conversation/vision-session";

export function useLegacyConversationTransport(desktopApp: boolean) {
  const visionRef = useRef<{ capture: () => Promise<VisionInput | undefined> }>(null);
  const [memoryRetrieval, setMemoryRetrieval] = useState<MemoryRetrievalObservation>(emptyMemoryRetrieval);
  const memoryRetrievalGeneration = useRef(0);
  const observeMemoryRetrieval = useCallback((prepared: MemoryRetrievalObservation) => {
    setMemoryRetrieval(previous => observePreparedMemory(previous, prepared));
  }, []);

  async function sendCloudMessage(request: CloudRequest, recalledMemoryIds: string[], retrieval?: MemoryRetrievalObservation) {
    const sentRetrieval = beginMemoryRetrieval(retrieval ?? emptyMemoryRetrieval(), request.message.trim(), request.memoryCount > 0);
    const behavior = beginConversationTurn(request.message.trim(), request.memoryCount > 0, retrieval);
    const retrievalGeneration = ++memoryRetrievalGeneration.current;
    try {
      const authorizedRequest = { ...request, behavior: supportsConversationBehavior(request.provider) ? { ...behavior } : undefined };
      setMemoryRetrieval(sentRetrieval);
      recordEvent("PERCEPTION", "INFERENCE_PREFLIGHT_APPROVED", `${request.provider}/${request.model} · historial ${request.historyCount} · RAG ${request.memoryCount}`);
      const vision = await visionRef.current?.capture();
      const response = await invoke<CloudResponse>("send_cloud_message", { request: {...authorizedRequest, ...(vision ? {vision} : {})} });
      if (memoryRetrievalGeneration.current === retrievalGeneration) {
        setMemoryRetrieval(completeMemoryRetrieval(sentRetrieval, response.responseId, response.memoryContextMode));
      }
      const now = new Date().toISOString();
      if (response.workingMemory) acceptWorkingMemoryResponse(response.workingMemory);
      recordConversationResponse(request, response, now);
      if (response.workingMemoryError) recordEvent("SECURITY", "WORKING_MEMORY_RECORD_ERROR", response.workingMemoryError, "WARN");
      if (response.conversationHistoryError) recordEvent("SECURITY", "CONVERSATION_HISTORY_RECORD_ERROR", response.conversationHistoryError, "WARN");
      if (recalledMemoryIds.length && response.memoryContextMode === "full") recordEvent("MEMORY", "MEMORY_RETRIEVAL_AWAITING_FEEDBACK", `${recalledMemoryIds.length} recuerdo${recalledMemoryIds.length === 1 ? "" : "s"} incluido${recalledMemoryIds.length === 1 ? "" : "s"} en el contexto · utilidad aún no confirmada`);
      recordEvent("OUTPUT", "CLOUD_RESPONSE", `${response.provider}/${response.model} · ${response.inputTokens} entrada · ${response.outputTokens} salida`);
      return response;
    } catch (error) {
      if (memoryRetrievalGeneration.current === retrievalGeneration) setMemoryRetrieval(failMemoryRetrieval(sentRetrieval));
      recordEvent("SECURITY", "CLOUD_REQUEST_ERROR", String(error), "WARN");
      throw error;
    } finally {
      endConversationTurn();
    }
  }

  async function previewHybridMemoryRetrieval(request: HybridRetrievalRequest) {
    if (!desktopApp) throw new Error("La ampliación con Gemma requiere la aplicación de escritorio.");
    try {
      const preview = await invoke<HybridRetrievalPreview>("preview_hybrid_memory_retrieval", { request });
      recordEvent("MEMORY", "HYBRID_RETRIEVAL_PREVIEW", `${preview.matches.length} candidatos ordenados localmente · no persistidos · revisión humana requerida`);
      return preview;
    } catch (error) {
      recordEvent("SECURITY", "HYBRID_RETRIEVAL_PREVIEW_ERROR", String(error), "WARN");
      throw error;
    }
  }

  async function previewConversationLearning(exchangeId: string) {
    if (!desktopApp) throw new Error("La propuesta de recuerdo requiere la aplicación de escritorio.");
    const preview = parseConversationLearningPreview(await invoke<unknown>("preview_conversation_learning", { input: { exchangeId } }));
    recordEvent("MEMORY", "CONVERSATION_LEARNING_PREVIEW", `${preview.candidates.length} propuestas locales · no persistidas · sólo evidencia del propietario`);
    return preview;
  }

  async function confirmConversationLearning(preview: ConversationLearningPreview, candidate: ConversationLearningCandidate, approved: ConversationLearningApproval) {
    if (!desktopApp) throw new Error("La confirmación de recuerdo requiere la aplicación de escritorio.");
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

  async function previewVoiceOutput(exchangeId: string): Promise<VoiceOutputPreview> {
    if (!desktopApp) throw new Error("La voz de Alice requiere la aplicación de escritorio.");
    const preview = parseVoiceOutputPreview(await invoke<unknown>("preview_voice_output", { input: { exchangeId } }));
    recordEvent("OUTPUT", "VOICE_OUTPUT_PREVIEW", `${preview.characterCount}/${preview.characterLimit} caracteres · Fish Audio · sin audio persistente`);
    return preview;
  }

  async function confirmVoiceOutput(requestId: string): Promise<VoiceOutputResult> {
    if (!desktopApp) throw new Error("La voz de Alice requiere la aplicación de escritorio.");
    const result = parseVoiceOutputResult(await invoke<unknown>("confirm_voice_output", { input: { requestId, confirmed: true } }));
    recordEvent("OUTPUT", "VOICE_OUTPUT_COMPLETE", `${result.characterCount} caracteres · ${result.durationMs} ms · MP3 temporal · sin memoria ni archivo`);
    return result;
  }

  async function cancelVoiceOutput(requestId: string): Promise<void> {
    if (!desktopApp) return;
    await invoke<unknown>("cancel_voice_output", { input: { requestId } });
    recordEvent("OUTPUT", "VOICE_OUTPUT_CANCELLED", "Vista previa descartada antes de enviar texto a Fish Audio.");
  }

  async function prepareVoiceTurn(): Promise<void> {
    if (!desktopApp) throw new Error("La voz requiere la aplicación de escritorio.");
    const runtime = await invoke<{ running: boolean }>("start_local_runtime");
    if (!runtime.running) throw new Error("Gemma no está listo para escuchar.");
    selectCloudProvider("llamacpp");
    recordEvent("PERCEPTION", "VOICE_TURN_READY", "Gemma preparado por solicitud del propietario; micrófono todavía apagado.");
  }

  async function startVoiceSession(): Promise<string> {
    const session = await invoke<{ sessionId: string }>("start_voice_session");
    try {
      await prepareVoiceTurn();
      return session.sessionId;
    } catch (error) {
      await stopVoiceSession(session.sessionId).catch(() => undefined);
      throw error;
    }
  }

  async function stopVoiceSession(sessionId: string): Promise<void> {
    await invoke("stop_voice_session", { input: { sessionId } });
  }

  async function speakVoiceSession(exchangeId: string, sessionId: string): Promise<VoiceOutputResult> {
    return parseVoiceOutputResult(await invoke("speak_voice_session_response", { input: { exchangeId, sessionId } }));
  }

  async function transcribeVoiceTurn(audioBase64: string, mimeType: string, sessionId?: string): Promise<VoiceTurnTranscript> {
    if (!desktopApp) throw new Error("La transcripción de voz requiere la aplicación de escritorio.");
    const result = parseVoiceTurnTranscript(await invoke<unknown>("transcribe_voice_turn", { input: { audioBase64, mimeType, confirmed: true, ...(sessionId ? { sessionId } : {}) } }));
    recordEvent("PERCEPTION", result.noSpeech ? "VOICE_TURN_NO_SPEECH" : "VOICE_TURN_TRANSCRIBED", `${result.model} · ${result.durationMs} ms · audio descartado · borrador no enviado`);
    return result;
  }

  return {
    visionRef, memoryRetrieval, setMemoryRetrieval, observeMemoryRetrieval, sendCloudMessage, previewHybridMemoryRetrieval,
    previewConversationLearning, confirmConversationLearning, previewVoiceOutput, confirmVoiceOutput,
    cancelVoiceOutput, prepareVoiceTurn, startVoiceSession, stopVoiceSession, speakVoiceSession, transcribeVoiceTurn,
  };
}
