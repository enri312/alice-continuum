import { ConversationHost, type ConversationVisionPort } from "./pages/conversation/ConversationHost";
import { AutomaticMemoryPanel } from "./components/memory/AutomaticMemoryPanel";
import { SelfStudyPanel } from "./components/memory/SelfStudyPanel";
import { buildMemoryCatalog } from "./core/memory/memory-catalog";
import {
  learningSnapshot, refreshLearningSources, reviewAutomaticLearning,
  startLearningSession, subscribeToLearning, toggleAutomaticMemory, toggleSelfStudy,
} from "./core/memory/learning-session";
import type { AutomaticMemoryReview } from "./core/memory/automatic-memory";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DashboardHost } from "./pages/dashboard/DashboardHost";
import type { CloudRequest, CloudResponse, HybridRetrievalPreview, HybridRetrievalRequest } from "./core/conversation/conversation-contracts";
import { supportsConversationBehavior } from "./core/conversation/behavior-settings";
import {
  beginConversationTurn, changeConversationBehavior, conversationSnapshot, endConversationTurn,
  recordConversationResponse, selectCloudProvider, selectConversationModel, setConversationDraft,
  setFullConversationHistory, subscribeToConversation,
} from "./core/conversation/conversation-session";
import { Volumen } from "./pages/cognitive/NeuralVolumePage";
import { Flujo } from "./pages/cognitive/EvidenceFlowPage";
import { StateControlsHost } from "./components/cognitive/state-controls/StateControlsHost";
import { Planificador } from "./pages/cognitive/ActionPlannerPage";
import { Memoria } from "./pages/memory/MemoryVaultPage";
import { Actividad } from "./pages/cognitive/ActivityHost";
import { AuditPageHost } from "./pages/cognitive/AuditPageHost";
import { FaceTrackingPanel } from "./components/embodiment/FaceTrackingPanel";
import { BodySolverPanel } from "./components/embodiment/BodySolverPanel";
import { CapacidadesYPermisos } from "./pages/governance/CapabilityRegistryPage";
import { Configuracion } from "./pages/governance/SystemSettingsPage";
import { Habilidades } from "./pages/governance/SkillWorkshopPage";
import { Procedimientos } from "./pages/governance/ProcedureObserverPage";
import { buildBrainSnapshot } from "./core/cognitive/brain";
import { recordCognitiveEvent as recordEvent } from "./core/cognitive/activity-session";
import {
  acceptWorkingMemoryResponse, assessRetrievalOutcome, clearWorkingMemory, discardMemory,
  exportMemory, memorySessionSnapshot, openMemoryDirectory, refreshOwnerProfile, reloadMemoryFromDisk, restoreMemory,
  reviewMemory, startMemorySession, subscribeToMemory, updateMemory,
} from "./core/memory/memory-session";
import { beginMemoryRetrieval, completeMemoryRetrieval, emptyMemoryRetrieval, failMemoryRetrieval, observePreparedMemory, type MemoryRetrievalObservation } from "./core/memory/retrieval-observation";
import { startSerializedPolling } from "./core/shared/polling";
import { parsePermissionGatewayStatus } from "./core/governance/permissions";
import { initialScreen, NavigationHost, type NavigationRequest } from "./core/navigation/NavigationHost";
import type { Screen } from "./core/navigation/workspaces";
import { parseConversationLearningConfirmation, parseConversationLearningPreview } from "./core/conversation/conversation-learning";
import type { ConversationLearningApproval, ConversationLearningCandidate, ConversationLearningPreview } from "./core/conversation/conversation-learning";
import { parseVoiceOutputPreview, parseVoiceOutputResult } from "./core/voice/voice-output";
import type { VoiceOutputPreview, VoiceOutputResult } from "./core/voice/voice-output";
import { parseVoiceTurnTranscript } from "./core/voice/voice-input";
import type { VoiceTurnTranscript } from "./core/voice/voice-input";

type ForegroundContext = { windowTitle: string; processName: string };
const Avatar = lazy(() => import("./pages/embodiment/AvatarPage").then((module) => ({ default: module.Avatar })));

export function App() {
  const visionRef = useRef<ConversationVisionPort>(null);
  const desktopApp = isTauri();
  const avatarDiagnostic = import.meta.env.VITE_ALICE_AVATAR_DIAGNOSTIC === "1";
  const { sessions, finishedIndices, workingMemory, memoryStatus, memoryPath, ownerProfile, ownerProfileError } =
    useSyncExternalStore(subscribeToMemory, memorySessionSnapshot);
  useEffect(startMemorySession, []);
  useEffect(startLearningSession, []);
  const {
    automaticMemory, automaticPhase, automaticError, automaticSource,
    selfStudy, selfStudyError, selfStudySource, approvedStudyIndices,
  } = useSyncExternalStore(subscribeToLearning, learningSnapshot);

  async function reviewAutomaticMemory(input: AutomaticMemoryReview) {
    await reviewAutomaticLearning(input);
    setMemoryRetrieval(emptyMemoryRetrieval());
  }

  const {
    cloudStatus, cloudSelection, draft: conversationDraft, showFullHistory,
    behavior: conversationBehavior, pending: cloudPending, messages,
  } = useSyncExternalStore(subscribeToConversation, conversationSnapshot);
  const [auditCapability, setAuditCapability] = useState<string | null>(null);
  const [screen, setActiveScreen] = useState(() =>
    initialScreen(new URLSearchParams(window.location.search), avatarDiagnostic));
  const [navigationRequest, setNavigationRequest] = useState<NavigationRequest | null>(null);
  const navigationSequence = useRef(0);
  const navigate = useCallback((destination: Screen) => {
    navigationSequence.current = (navigationSequence.current + 1) >>> 0;
    setNavigationRequest({ id: navigationSequence.current, screen: destination });
  }, []);
  const acceptRoute = useCallback((destination: Screen, clearAudit: boolean) => {
    if (clearAudit) setAuditCapability(null);
    setActiveScreen(destination);
    setNavigationRequest(current => current?.screen === destination ? null : current);
  }, []);
  const [observationEnabled, setObservationEnabled] = useState(false);
  const [foregroundContext, setForegroundContext] = useState<ForegroundContext | null>(null);
  const [memoryRetrieval, setMemoryRetrieval] = useState<MemoryRetrievalObservation>(emptyMemoryRetrieval);
  const memoryRetrievalGeneration = useRef(0);
  const observeMemoryRetrieval = useCallback((prepared: MemoryRetrievalObservation) => {
    setMemoryRetrieval(previous => observePreparedMemory(previous, prepared));
  }, []);
  const { conversationalMemories, cognitiveMemories } = useMemo(() => buildMemoryCatalog({
    ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices,
  }), [ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices]);
  const ollamaProvider = cloudStatus.providers.find((provider) => provider.id === "ollama");
  const ollamaModel = cloudSelection.provider === "ollama" && cloudSelection.model.trim() ? cloudSelection.model : ollamaProvider?.defaultModel ?? "qwen3.5:4b";
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text;
  const brainSnapshot = useMemo(() => buildBrainSnapshot({
    lastUserMessage,
    conversationCount: messages.length,
    memories: cognitiveMemories,
    retrievedMemoryCount: memoryRetrieval.count,
    retrievedMemoryTop: memoryRetrieval.top,
    retrievedMemoryIds: memoryRetrieval.ids,
    memoryRetrievalObservation: memoryRetrieval,
    observerEnabled: observationEnabled,
    foregroundContext,
    cloudConfigured: cloudStatus.providers.some((provider) => provider.configured),
    cloudPending,
  }), [cloudPending, cloudStatus.providers, cognitiveMemories, foregroundContext, lastUserMessage, memoryRetrieval, messages.length, observationEnabled]);

  useEffect(() => {
    if (!desktopApp || !observationEnabled) return;
    return startSerializedPolling({
      intervalMs: 2_000,
      read: async () => {
        const [context, rawGateway] = await Promise.all([
          invoke<ForegroundContext | null>("get_foreground_context"),
          invoke<unknown>("permission_gateway_status"),
        ]);
        const gateway = parsePermissionGatewayStatus(rawGateway);
        const active = gateway.grants.some((grant) => grant.capabilityId === "context.foreground.control" && grant.mode === "session" && grant.state === "active");
        return { context, active };
      },
      onValue: ({ context, active }) => {
        setObservationEnabled(active);
        setForegroundContext(active ? context : null);
      },
      onError: () => {
        setObservationEnabled(false);
        setForegroundContext(null);
      },
    });
  }, [desktopApp, observationEnabled]);

  async function toggleObservation() {
    if (!desktopApp) return;
    navigate("puentes");
    recordEvent("SECURITY", "PERMISSION_REQUIRED", observationEnabled
      ? "La detención requiere un grant oneShot en el Gateway R2"
      : "La activación requiere un grant de sesión en el Gateway R2");
  }

  async function sendCloudMessage(request: CloudRequest, recalledMemoryIds: string[], retrieval?: MemoryRetrievalObservation) {
    const sentRetrieval = beginMemoryRetrieval(retrieval ?? emptyMemoryRetrieval(), request.message.trim(), request.memoryCount > 0);
    const behavior = beginConversationTurn();
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

  function refreshVolumeLearning() {
    refreshLearningSources();
    void refreshOwnerProfile();
    if (memoryStatus === "error") void reloadMemoryFromDisk().catch(() => undefined);
  }

  return <NavigationHost
    screen={screen} request={navigationRequest} onRoute={acceptRoute}
    memories={conversationalMemories.length}
  >
    {screen === "dashboard" && <DashboardHost
      desktopApp={desktopApp}
      assistant={{
        provider: cloudStatus.providers.find(provider => provider.id === cloudSelection.provider)?.label ?? "Sin motor seleccionado",
        memoryCount: conversationalMemories.length,
      }}
      onNavigate={navigate}
    />}
    {screen === "nucleo" && <Volumen snapshot={brainSnapshot} desktopApp={desktopApp} learningReady={!desktopApp || (memoryStatus === "native" && ownerProfile !== null && automaticMemory !== null && selfStudy !== null)} selfStudy={selfStudy} learningActivity={{
      native: desktopApp, selfStudyPhase: selfStudy?.phase ?? null, selfStudyLastError: selfStudy?.lastError ?? null,
      automaticPhase, automaticEnabled: automaticMemory?.enabled ?? null, selfStudySource, automaticSource,
      recordsStatus: memoryStatus === "error" || ownerProfileError ? "error" : memoryStatus === "native" && ownerProfile !== null ? "ready" : "loading",
      recordsError: ownerProfileError || (memoryStatus === "error" ? "No se pudieron leer los recuerdos guardados. Puedes reintentar la lectura." : ""),
    }} onRefreshLearning={refreshVolumeLearning} />}
    {screen === "flujo" && <Flujo snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "estado" && <StateControlsHost snapshot={brainSnapshot} desktopApp={desktopApp} behavior={{ settings: conversationBehavior, supported: desktopApp && supportsConversationBehavior(cloudSelection.provider), busy: cloudPending, onChange: changeConversationBehavior }} />}
    {screen === "planificador" && <Planificador snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "identificacion" && <ConversationHost
      visionRef={visionRef} desktopApp={desktopApp} draft={conversationDraft} showFullHistory={showFullHistory}
      status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model}
      messages={messages} memories={conversationalMemories} cloudPending={cloudPending}
      observationEnabled={observationEnabled} foregroundContext={foregroundContext}
      retrievedMemoryCount={brainSnapshot.retrievedMemoryCount}
      automaticLearning={automaticMemory ? {enabled: automaticMemory.enabled, count: automaticMemory.activeCount, phase: automaticPhase, onOpen: () => navigate("memoria")} : undefined}
      onDraftChange={setConversationDraft} onMemoryRetrieval={observeMemoryRetrieval}
      onHybridRetrieve={previewHybridMemoryRetrieval} onPreviewConversationLearning={previewConversationLearning}
      onConfirmConversationLearning={confirmConversationLearning} onRetrievalOutcome={assessRetrievalOutcome}
      onPreviewVoiceOutput={previewVoiceOutput} onConfirmVoiceOutput={confirmVoiceOutput} onCancelVoiceOutput={cancelVoiceOutput}
      onStartVoiceSession={startVoiceSession} onStopVoiceSession={stopVoiceSession} onSpeakVoiceSession={speakVoiceSession}
      onPrepareVoiceTurn={prepareVoiceTurn} onTranscribeVoiceTurn={transcribeVoiceTurn}
      onToggleObservation={toggleObservation} onOpenSettings={() => navigate("configuracion")} onSend={sendCloudMessage}
    />}
    {screen === "memoria" && <Memoria automaticMemoryPanel={<><SelfStudyPanel snapshot={selfStudy} error={selfStudyError} onToggle={toggleSelfStudy} /><AutomaticMemoryPanel snapshot={automaticMemory} phase={automaticPhase} error={automaticError} onToggle={toggleAutomaticMemory} onReview={reviewAutomaticMemory} /></>} sessions={sessions} ownerProfile={ownerProfile} workingMemory={workingMemory} onClearWorkingMemory={clearWorkingMemory} onUpdate={updateMemory} onDelete={discardMemory} onReview={reviewMemory} onExport={exportMemory} onRestore={restoreMemory} onReloadMemory={reloadMemoryFromDisk} onOpenDirectory={openMemoryDirectory} storageStatus={memoryStatus} storagePath={memoryPath} />}
    {screen === "actividad" && <Actividad />}
    {screen === "auditoria" && <AuditPageHost desktopApp={desktopApp} capability={auditCapability} onClearCapability={() => setAuditCapability(null)} />}
    {screen === "habilidades" && <Habilidades desktopApp={desktopApp} />}
    {screen === "procedimientos" && <Procedimientos desktopApp={desktopApp} />}
    {screen === "configuracion" && <Configuracion showFullHistory={showFullHistory} onShowFullHistoryChange={setFullConversationHistory} desktopApp={desktopApp} status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model} onProviderChange={selectCloudProvider} onModelChange={selectConversationModel} />}
    {screen === "puentes" && <CapacidadesYPermisos onObservationStateChange={setObservationEnabled} onOpenAudit={capability => { setAuditCapability(capability ?? null); navigate("auditoria"); }} />}
    {screen === "rostro" && <section className="bridge-page" aria-label="Control facial de Alice"><FaceTrackingPanel /></section>}
    {screen === "cuerpo" && <section className="bridge-page" aria-label="Solucionador corporal de Alice"><BodySolverPanel /></section>}
    {screen === "avatar" && <Suspense fallback={<section className="avatar-page"><div className="avatar-unavailable"><span>VRM</span><strong>Preparando el visor local…</strong><p>Los componentes 3D se cargan solamente al abrir esta pantalla.</p></div></section>}><Avatar desktopApp={desktopApp} /></Suspense>}
  </NavigationHost>;
}
