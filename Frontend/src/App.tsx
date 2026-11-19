import { ConversationHost, type ConversationVisionPort } from "./pages/conversation/ConversationHost";
import { listen } from "@tauri-apps/api/event";
import { AutomaticMemoryPanel } from "./components/memory/AutomaticMemoryPanel";
import { SelfStudyPanel } from "./components/memory/SelfStudyPanel";
import { selfStudyForConversation, selfStudyForCognitiveVolume } from "./core/memory/self-study";
import { automaticMemoryForConversation } from "./core/memory/automatic-memory";
import { useLearningSources } from "./hooks/useLearningSources";
import type { AutomaticMemoryReview } from "./core/memory/automatic-memory";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { DashboardHost } from "./pages/dashboard/DashboardHost";
import type { CloudRequest, CloudResponse, CloudStatus, ConversationMessage, HybridRetrievalPreview, HybridRetrievalRequest } from "./core/conversation/conversation-contracts";
import { DEFAULT_CONVERSATION_BEHAVIOR, supportsConversationBehavior, updateConversationBehavior } from "./core/conversation/behavior-settings";
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
import { createCognitiveEvent } from "./core/cognitive/cognitive-events";
import type { CognitiveEvent, CognitiveLevel, CognitiveModule } from "./core/cognitive/cognitive-events";
import { applyMemoryRetrievalOutcome, applyMemoryReview } from "./core/memory/memory-consolidation";
import type { RetrievalOutcome, ReviewOutcome } from "./core/memory/memory-consolidation";
import { beginMemoryRetrieval, completeMemoryRetrieval, emptyMemoryRetrieval, failMemoryRetrieval, observePreparedMemory, type MemoryRetrievalObservation } from "./core/memory/retrieval-observation";
import { loadCompatibleArray } from "./core/shared/storage-migration";
import { startSerializedPolling } from "./core/shared/polling";
import { parsePermissionGatewayStatus } from "./core/governance/permissions";
import { initialScreen, NavigationHost, type NavigationRequest } from "./core/navigation/NavigationHost";
import type { Screen } from "./core/navigation/workspaces";
import { parseWorkingMemoryOperationResult, parseWorkingMemorySnapshot } from "./core/memory/working-memory";
import type { WorkingMemoryOperationResult, WorkingMemorySnapshot } from "./core/memory/working-memory";
import { messagesFromConversationHistory, parseConversationHistorySnapshot } from "./core/conversation/conversation-history";
import { parseOwnerProfileSnapshot } from "./core/conversation/owner-profile";
import type { OwnerProfileSnapshot } from "./core/conversation/owner-profile";
import { parseConversationLearningConfirmation, parseConversationLearningPreview } from "./core/conversation/conversation-learning";
import type { ConversationLearningApproval, ConversationLearningCandidate, ConversationLearningPreview } from "./core/conversation/conversation-learning";
import { parseVoiceOutputPreview, parseVoiceOutputResult } from "./core/voice/voice-output";
import type { VoiceOutputPreview, VoiceOutputResult } from "./core/voice/voice-output";
import { parseVoiceTurnTranscript } from "./core/voice/voice-input";
import type { VoiceTurnTranscript } from "./core/voice/voice-input";

type SessionKind = "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza";

type Session = {
  affects?: import("./core/cognitive/affect").MemoryAffect[];
  id: string;
  kind: SessionKind;
  intention: string;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  nextStep?: string;
  memoryType?: "semantic" | "procedural" | "preference" | "episodic";
  source?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  accessibilityStatus?: "accessible" | "dormant";
  accessibilityUpdatedAt?: string;
  suppressionStatus?: "suppressed";
  suppressionReason?: "ownerChoice" | "sensitiveContext" | "temporaryBoundary";
  suppressionUpdatedAt?: string;
  archiveStatus?: "archived";
  archiveReason?: "ownerChoice" | "superseded" | "noLongerRelevant";
  archiveUpdatedAt?: string;
  deletionStatus?: "scheduled";
  deletionReason?: "ownerRequest" | "duplicateAfterMerge" | "privacyRemoval";
  deletionRequestedAt?: string;
  deletionEligibleAt?: string;
  memoryVersion?: number;
  reconsolidatedAt?: string;
  reconsolidationReason?: "ownerCorrection" | "newContext" | "clarification";
  previousVersionSha256?: string;
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  retrievalEvidenceVersion?: 1;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
  contextEvents?: { type: "screenshot"; recordedAt: string }[];
};

type ForegroundContext = { windowTitle: string; processName: string };
type MemorySnapshot = { sessions: Session[]; storagePath: string; existed: boolean };
const storageKey = "alice-cognitive-core-sessions-v1";
const legacyStorageKeys = ["proyecto-p-sessions-v1"];
const cloudSelectionKey = "alice-cognitive-core-cloud-selection-v1";
const Avatar = lazy(() => import("./pages/embodiment/AvatarPage").then((module) => ({ default: module.Avatar })));

function loadCloudSelection() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cloudSelectionKey) ?? "null") as { provider?: unknown; model?: unknown } | null;
    return { provider: typeof parsed?.provider === "string" ? parsed.provider : "", model: typeof parsed?.model === "string" ? parsed.model : "" };
  } catch {
    return { provider: "", model: "" };
  }
}

function loadSessions(): Session[] {
  return loadCompatibleArray<Session>(localStorage, storageKey, legacyStorageKeys);
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

export function App() {
  const visionRef = useRef<ConversationVisionPort>(null);
  const desktopApp = isTauri();
  const avatarDiagnostic = import.meta.env.VITE_ALICE_AVATAR_DIAGNOSTIC === "1";
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const {
    automaticMemory, automaticPhase, automaticError, automaticSource,
    selfStudy, selfStudyError, selfStudySource,
    toggleSelfStudy, toggleAutomaticMemory, refreshLearningSources,
    reviewAutomaticMemory: reviewLearningMemory,
  } = useLearningSources(desktopApp);

  async function reviewAutomaticMemory(input: AutomaticMemoryReview) {
    await reviewLearningMemory(input);
    setMemoryRetrieval(emptyMemoryRetrieval());
  }

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemorySnapshot | null>(null);
  const [conversationDraft, setConversationDraft] = useState("");
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
  const [cloudPending, setCloudPending] = useState(false);
  const [conversationBehavior, setConversationBehavior] = useState(() => ({ ...DEFAULT_CONVERSATION_BEHAVIOR }));
  const [memoryRetrieval, setMemoryRetrieval] = useState<MemoryRetrievalObservation>(emptyMemoryRetrieval);
  const memoryRetrievalGeneration = useRef(0);
  const observeMemoryRetrieval = useCallback((prepared: MemoryRetrievalObservation) => {
    setMemoryRetrieval(previous => observePreparedMemory(previous, prepared));
  }, []);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ providers: [
    { id: "llamacpp", label: "Gemma local · llama.cpp", configured: false, defaultModel: "gemma-4-E2B-it-Q4_K_M", protocol: "Local · inicio por autoestudio o desde Configuración", retentionMode: "Sin nube" },
    { id: "ollama", label: "Ollama local", configured: false, defaultModel: "qwen3.5:4b", protocol: "Chat local · loopback", retentionMode: "inferencia local; sin salida a Internet" },
    { id: "openai", label: "OpenAI", configured: false, defaultModel: "gpt-5.6-terra", protocol: "Responses API", retentionMode: "store: false" },
    { id: "anthropic", label: "Anthropic", configured: false, defaultModel: "", protocol: "Messages API", retentionMode: "solicitud sin estado local" },
    { id: "google", label: "Google", configured: false, defaultModel: "gemini-3.5-flash", protocol: "GenerateContent", retentionMode: "retención según Google" },
    { id: "xai", label: "xAI", configured: false, defaultModel: "grok-4.5", protocol: "Responses API", retentionMode: "store: false" },
    { id: "compatible", label: "Compatible", configured: false, defaultModel: "", protocol: "Chat Completions", retentionMode: "definida por el servicio" },
  ] });
  const [cloudSelection, setCloudSelection] = useState(loadCloudSelection);
  const [cognitiveEvents, setCognitiveEvents] = useState<CognitiveEvent[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<"browser" | "loading" | "native" | "error">(desktopApp ? "loading" : "browser");
  const [memoryPath, setMemoryPath] = useState("");
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileSnapshot | null>(null);
  const [ownerProfileError, setOwnerProfileError] = useState("");
  const [ownerProfileReloadKey, setOwnerProfileReloadKey] = useState(0);
  const memoryLoadStarted = useRef(false);
  const sessionsRef = useRef(sessions);
  const memorySaveQueue = useRef<Promise<void>>(Promise.resolve());
  const workingMemoryGeneration = useRef(-1);

  const remembered = useMemo(() => sessions.filter((session) => session.finishedAt), [sessions]);
  const conversationalMemories = useMemo(() => [...(ownerProfile?.records ?? []), ...remembered, ...automaticMemoryForConversation(automaticMemory), ...selfStudyForConversation(selfStudy)], [ownerProfile, remembered, automaticMemory, selfStudy]);
  const cognitiveMemories = useMemo(() => [...(ownerProfile?.records ?? []), ...remembered, ...automaticMemoryForConversation(automaticMemory), ...selfStudyForCognitiveVolume(selfStudy)], [ownerProfile, remembered, automaticMemory, selfStudy]);
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

  function recordEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO") {
    setCognitiveEvents((current) => [...current.slice(-199), createCognitiveEvent(module, node, payload, level)]);
  }

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

  useEffect(() => {
    if (!desktopApp) return;
    invoke<CloudStatus>("cloud_status").then(setCloudStatus).catch((error) => recordEvent("SECURITY", "CLOUD_STATUS_ERROR", String(error), "WARN"));
  }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp) return;
    let active = true;
    invoke<unknown>("owner_profile_status").then((raw) => {
      if (!active) return;
      const snapshot = parseOwnerProfileSnapshot(raw);
      setOwnerProfile(snapshot);
      setOwnerProfileError("");
      if (snapshot.state === "available") recordEvent("MEMORY", "OWNER_PROFILE_LOAD", `${snapshot.records.length} recuerdos de perfil confirmados · ${snapshot.sourceFiles.length} fuentes con SHA-256`);
    }).catch((error) => {
      if (!active) return;
      setOwnerProfileError(String(error));
      recordEvent("SECURITY", "OWNER_PROFILE_LOAD_ERROR", String(error), "WARN");
    });
    return () => { active = false; };
  }, [desktopApp, ownerProfileReloadKey]);

  useEffect(() => {
    if (!desktopApp) return;
    return startSerializedPolling({
      intervalMs: 5_000,
      read: async () => parseWorkingMemorySnapshot(await invoke<unknown>("working_memory_status")),
      onValue: snapshot => {
        // A read started before a confirmed clear/response must not restore its old view.
        if (snapshot.generation < workingMemoryGeneration.current) return;
        setWorkingMemory(snapshot);
        workingMemoryGeneration.current = snapshot.generation;
      },
      onError: error => {
        if (workingMemoryGeneration.current < 0) {
          workingMemoryGeneration.current = 0;
          recordEvent("SECURITY", "WORKING_MEMORY_STATUS_ERROR", String(error), "WARN");
        }
      },
    });
  }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp) return;
    invoke<unknown>("conversation_history_status").then((raw) => {
      const snapshot = parseConversationHistorySnapshot(raw);
      if (snapshot.state === "invalid") {
        recordEvent("SECURITY", "CONVERSATION_HISTORY_INVALID", snapshot.error ?? "Historial bloqueado", "WARN");
        return;
      }
      setMessages(messagesFromConversationHistory(snapshot));
      if (snapshot.state === "ready") recordEvent("MEMORY", "CONVERSATION_HISTORY_LOADED", `${snapshot.messageCount} mensajes locales recuperados · sin promoción automática a recuerdo`);
    }).catch((error) => recordEvent("SECURITY", "CONVERSATION_HISTORY_LOAD_ERROR", String(error), "WARN"));
  }, [desktopApp]);

  useEffect(() => {
    const selected = cloudStatus.providers.find((provider) => provider.id === cloudSelection.provider);
    if (!selected) {
      const fallback = cloudStatus.providers.find((provider) => provider.id === "ollama") ?? cloudStatus.providers.find((provider) => provider.configured) ?? cloudStatus.providers[0];
      if (fallback) setCloudSelection({ provider: fallback.id, model: fallback.defaultModel });
      return;
    }
    if (!cloudSelection.model.trim() && selected.defaultModel) setCloudSelection((current) => ({ ...current, model: selected.defaultModel }));
  }, [cloudSelection.model, cloudSelection.provider, cloudStatus.providers]);

  useEffect(() => {
    if (!cloudSelection.provider) return;
    localStorage.setItem(cloudSelectionKey, JSON.stringify(cloudSelection));
  }, [cloudSelection]);

  function selectCloudProvider(providerId: string) {
    const selected = cloudStatus.providers.find((provider) => provider.id === providerId);
    if (!selected) return;
    setCloudSelection({ provider: selected.id, model: selected.defaultModel });
    recordEvent("SYSTEM", "INFERENCE_ROUTE_SELECTED", `${selected.label} · ${selected.defaultModel || "sin modelo"}`);
  }

  useEffect(() => {
    if (!desktopApp || memoryLoadStarted.current) return;
    memoryLoadStarted.current = true;
    const legacySessions = loadSessions();
    invoke<MemorySnapshot>("load_memory").then(async (snapshot) => {
      setMemoryPath(snapshot.storagePath);
      if (snapshot.existed) {
        sessionsRef.current = snapshot.sessions;
        setSessions(snapshot.sessions);
        setMemoryStatus("native");
        recordEvent("MEMORY", "MEMORY_LOAD", `${snapshot.sessions.length} recuerdos cargados desde archivo local`);
        return;
      }
      if (legacySessions.length) {
        const savedPath = await invoke<string>("save_memory", { sessions: legacySessions });
        setMemoryPath(savedPath);
        sessionsRef.current = legacySessions;
        setSessions(legacySessions);
        recordEvent("MEMORY", "MEMORY_MIGRATION", `${legacySessions.length} recuerdos migrados desde el navegador`);
      }
      setMemoryStatus("native");
    }).catch((error) => {
      setMemoryStatus("error");
      recordEvent("SECURITY", "MEMORY_LOAD_ERROR", String(error), "WARN");
    });
  }, [desktopApp]);

  function updateSessions(update: Session[] | ((current: Session[]) => Session[])) {
    const next = typeof update === "function" ? update(sessionsRef.current) : update;
    sessionsRef.current = next;
    setSessions(next);
    if (!desktopApp) {
      saveSessions(next);
      return;
    }
    memorySaveQueue.current = memorySaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const path = await invoke<string>("save_memory", { sessions: next });
        setMemoryPath(path);
        setMemoryStatus("native");
      })
      .catch((error) => {
        setMemoryStatus("error");
        recordEvent("SECURITY", "MEMORY_SAVE_ERROR", String(error), "WARN");
      });
  }

  async function updateSessionsVerified(update: (current: Session[]) => Session[]) {
    const previous = sessionsRef.current;
    const next = update(previous);
    sessionsRef.current = next;
    setSessions(next);
    if (!desktopApp) {
      saveSessions(next);
      return;
    }
    const persistence = memorySaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const path = await invoke<string>("save_memory", { sessions: next });
        setMemoryPath(path);
        setMemoryStatus("native");
      });
    memorySaveQueue.current = persistence.catch((error) => {
      setMemoryStatus("error");
      recordEvent("SECURITY", "MEMORY_SAVE_ERROR", String(error), "WARN");
    });
    try {
      await persistence;
    } catch (error) {
      if (sessionsRef.current === next) {
        sessionsRef.current = previous;
        setSessions(previous);
      }
      throw error;
    }
  }

  async function toggleObservation() {
    if (!desktopApp) return;
    navigate("puentes");
    recordEvent("SECURITY", "PERMISSION_REQUIRED", observationEnabled
      ? "La detención requiere un grant oneShot en el Gateway R2"
      : "La activación requiere un grant de sesión en el Gateway R2");
  }

  async function sendCloudMessage(request: CloudRequest, recalledMemoryIds: string[], retrieval?: MemoryRetrievalObservation) {
    const authorizedRequest = { ...request, behavior: supportsConversationBehavior(request.provider) ? { ...conversationBehavior } : undefined };
    const retrievalGeneration = ++memoryRetrievalGeneration.current;
    const sentRetrieval = beginMemoryRetrieval(retrieval ?? emptyMemoryRetrieval(), request.message.trim(), request.memoryCount > 0);
    setMemoryRetrieval(sentRetrieval);
    setCloudPending(true);
    recordEvent("PERCEPTION", "INFERENCE_PREFLIGHT_APPROVED", `${request.provider}/${request.model} · historial ${request.historyCount} · RAG ${request.memoryCount}`);
    try {
      const vision = await visionRef.current?.capture();
      const response = await invoke<CloudResponse>("send_cloud_message", { request: {...authorizedRequest, ...(vision ? {vision} : {})} });
      if (memoryRetrievalGeneration.current === retrievalGeneration) {
        setMemoryRetrieval(completeMemoryRetrieval(sentRetrieval, response.responseId, response.memoryContextMode));
      }
      const now = new Date().toISOString();
      if (response.workingMemory) {
        try {
          const snapshot = parseWorkingMemorySnapshot(response.workingMemory);
          workingMemoryGeneration.current = snapshot.generation;
          setWorkingMemory(snapshot);
          recordEvent("MEMORY", "WORKING_MEMORY_RECORDED", `${snapshot.messageCount}/${snapshot.maximumMessages} mensajes reales en RAM · TTL ${snapshot.ttlSeconds}s`);
        } catch (error) {
          recordEvent("SECURITY", "WORKING_MEMORY_CONTRACT_ERROR", String(error), "WARN");
        }
      }
      if (response.conversationHistory) {
        try {
          const history = parseConversationHistorySnapshot(response.conversationHistory);
          setMessages(messagesFromConversationHistory(history));
          recordEvent("MEMORY", "CONVERSATION_HISTORY_APPENDED", `${history.messageCount} mensajes persistentes · aprendizaje automático se evalúa aparte`);
        } catch (error) {
          setMessages((current) => [...current,
            { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: now },
            { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
          ]);
          recordEvent("SECURITY", "CONVERSATION_HISTORY_CONTRACT_ERROR", String(error), "WARN");
        }
      } else {
        setMessages((current) => [...current,
          { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: now },
          { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
        ]);
      }
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
      setCloudPending(false);
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

  async function assessRetrievalOutcome(recordId: string, outcome: RetrievalOutcome) {
    const target = sessionsRef.current.find((session) => session.id === recordId);
    if (!target || target.kind !== "Enseñanza" || target.memoryStatus !== "confirmed" || target.archiveStatus === "archived") throw new Error("El recuerdo ya no admite una evaluación de recuperación.");
    await updateSessionsVerified((current) => current.map((session) => session.id === recordId ? applyMemoryRetrievalOutcome(session, outcome) : session));
    recordEvent("MEMORY", outcome === "helpful" ? "MEMORY_RETRIEVAL_HELPFUL" : "MEMORY_RETRIEVAL_NOT_HELPFUL", `${recordId} · confirmado por el propietario · sin cambio automático de fuerza o accesibilidad`);
  }

  async function clearWorkingMemory(expectedGeneration: number): Promise<WorkingMemoryOperationResult> {
    if (!desktopApp) throw new Error("El vaciado de RAM requiere la aplicación de escritorio.");
    try {
      const result = parseWorkingMemoryOperationResult(await invoke<unknown>("clear_working_memory", { input: { expectedGeneration, confirmed: true } }));
      workingMemoryGeneration.current = result.snapshot.generation;
      setWorkingMemory(result.snapshot);
      recordEvent("MEMORY", "WORKING_MEMORY_CLEARED", `RAM vaciada en generación ${result.snapshot.generation}`);
      if (result.warning) recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_AUDIT_WARNING", result.warning, "WARN");
      return result;
    } catch (error) {
      recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_ERROR", String(error), "WARN");
      throw error;
    }
  }

  async function exportMemory() {
    if (!desktopApp) throw new Error("La exportación está disponible en la aplicación de escritorio.");
    await memorySaveQueue.current;
    const path = await invoke<string>("export_memory");
    recordEvent("MEMORY", "MEMORY_EXPORT", `Memoria exportada: ${path}`);
    return path;
  }

  async function restoreMemory() {
    if (!desktopApp) throw new Error("La restauración está disponible en la aplicación de escritorio.");
    await memorySaveQueue.current;
    const snapshot = await invoke<MemorySnapshot>("restore_memory_backup");
    sessionsRef.current = snapshot.sessions;
    setSessions(snapshot.sessions);
    setMemoryPath(snapshot.storagePath);
    setMemoryStatus("native");
    recordEvent("MEMORY", "MEMORY_RESTORE", `${snapshot.sessions.length} recuerdos restaurados desde el respaldo`, "WARN");
    return snapshot.sessions.length;
  }

  async function reloadMemoryFromDisk() {
    if (!desktopApp) throw new Error("La recarga de memoria requiere la aplicación de escritorio.");
    await memorySaveQueue.current;
    const snapshot = await invoke<MemorySnapshot>("load_memory");
    sessionsRef.current = snapshot.sessions;
    setSessions(snapshot.sessions);
    setMemoryPath(snapshot.storagePath);
    setMemoryStatus("native");
    return snapshot.sessions.length;
  }

  function refreshVolumeLearning() {
    refreshLearningSources();
    if (!ownerProfile || ownerProfileError) setOwnerProfileReloadKey(value => value + 1);
    if (memoryStatus === "error") void reloadMemoryFromDisk().catch(error => {
      setMemoryStatus("error");
      recordEvent("MEMORY", "MEMORY_RELOAD_ERROR", String(error), "WARN");
    });
  }

  async function openMemoryDirectory() {
    if (!desktopApp) throw new Error("La carpeta privada está disponible en la aplicación de escritorio.");
    const path = await invoke<string>("open_memory_directory");
    recordEvent("MEMORY", "MEMORY_DIRECTORY_OPEN", `Carpeta de memoria abierta: ${path}`);
    return path;
  }

  function reviewMemory(id: string, outcome: ReviewOutcome) {
    const memory = sessionsRef.current.find((session) => session.id === id);
    if (!memory) return;
    updateSessions((current) => current.map((session) => session.id === id ? applyMemoryReview(session, outcome) : session));
    recordEvent("MEMORY", outcome === "confirmed" ? "MEMORY_REVIEW_CONFIRMED" : "MEMORY_REVIEW_CONFLICT", `${outcome === "confirmed" ? "Vigencia confirmada" : "Corrección solicitada"}: ${memory.intention}`, outcome === "confirmed" ? "INFO" : "WARN");
  }

  return <NavigationHost
    screen={screen} request={navigationRequest} onRoute={acceptRoute}
    memories={conversationalMemories.length} events={cognitiveEvents.length}
  >
    {screen === "dashboard" && <DashboardHost
      desktopApp={desktopApp}
      assistant={{
        provider: cloudStatus.providers.find(provider => provider.id === cloudSelection.provider)?.label ?? "Sin motor seleccionado",
        memoryCount: conversationalMemories.length,
        eventCount: cognitiveEvents.length,
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
    {screen === "estado" && <StateControlsHost snapshot={brainSnapshot} desktopApp={desktopApp} behavior={{ settings: conversationBehavior, supported: desktopApp && supportsConversationBehavior(cloudSelection.provider), busy: cloudPending, onChange: (key, value) => { if (!cloudPending) setConversationBehavior(current => updateConversationBehavior(current, key, value)); } }} />}
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
    {screen === "memoria" && <Memoria automaticMemoryPanel={<><SelfStudyPanel snapshot={selfStudy} error={selfStudyError} onToggle={toggleSelfStudy} /><AutomaticMemoryPanel snapshot={automaticMemory} phase={automaticPhase} error={automaticError} onToggle={toggleAutomaticMemory} onReview={reviewAutomaticMemory} /></>} sessions={sessions} ownerProfile={ownerProfile} workingMemory={workingMemory} onClearWorkingMemory={clearWorkingMemory} onUpdate={(id, changes) => { updateSessions((current) => current.map((session) => session.id === id ? { ...session, ...changes, ...(session.memoryStatus === "conflict" ? { memoryStatus: "confirmed" as const } : {}) } : session)); recordEvent("MEMORY", "MEMORY_UPDATE", `Recuerdo actualizado: ${id}`); }} onDelete={async (id) => { await updateSessionsVerified((current) => current.filter((session) => session.id !== id)); recordEvent("MEMORY", "MEMORY_DELETE", `Fragmento heredado descartado: ${id}`, "WARN"); return sessionsRef.current.length; }} onReview={reviewMemory} onExport={exportMemory} onRestore={restoreMemory} onReloadMemory={reloadMemoryFromDisk} onOpenDirectory={openMemoryDirectory} storageStatus={memoryStatus} storagePath={memoryPath} />}
    {screen === "actividad" && <Actividad events={cognitiveEvents} onClear={() => setCognitiveEvents([])} />}
    {screen === "auditoria" && <AuditPageHost desktopApp={desktopApp} capability={auditCapability} onClearCapability={() => setAuditCapability(null)} />}
    {screen === "habilidades" && <Habilidades desktopApp={desktopApp} />}
    {screen === "procedimientos" && <Procedimientos desktopApp={desktopApp} />}
    {screen === "configuracion" && <Configuracion showFullHistory={showFullHistory} onShowFullHistoryChange={setShowFullHistory} desktopApp={desktopApp} status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model} onProviderChange={selectCloudProvider} onModelChange={(model) => setCloudSelection((current) => ({ ...current, model }))} />}
    {screen === "puentes" && <CapacidadesYPermisos onObservationStateChange={setObservationEnabled} onOpenAudit={capability => { setAuditCapability(capability ?? null); navigate("auditoria"); }} />}
    {screen === "rostro" && <section className="bridge-page" aria-label="Control facial de Alice"><FaceTrackingPanel /></section>}
    {screen === "cuerpo" && <section className="bridge-page" aria-label="Solucionador corporal de Alice"><BodySolverPanel /></section>}
    {screen === "avatar" && <Suspense fallback={<section className="avatar-page"><div className="avatar-unavailable"><span>VRM</span><strong>Preparando el visor local…</strong><p>Los componentes 3D se cargan solamente al abrir esta pantalla.</p></div></section>}><Avatar desktopApp={desktopApp} /></Suspense>}
  </NavigationHost>;
}
