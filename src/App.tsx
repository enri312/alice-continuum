import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Conversacion } from "./Page/Conversacion";
import type { CloudRequest, CloudResponse, CloudStatus, ConversationMessage } from "./Page/Conversacion";
import { Volumen } from "./Page/Volumen";
import { Flujo } from "./Page/Flujo";
import { Estado } from "./Page/Estado";
import { Planificador } from "./Page/Planificador";
import { Memoria } from "./Page/Memoria";
import { Actividad } from "./Page/Actividad";
import { Puentes } from "./Page/Puentes";
import { Identificacion } from "./Page/Identificacion";
import { Configuracion } from "./Page/Configuracion";
import { Habilidades } from "./Page/Habilidades";
import { Procedimientos } from "./Page/Procedimientos";
import { buildBrainSnapshot } from "./core/brain";
import { createCognitiveEvent } from "./core/cognitive-events";
import type { CognitiveEvent, CognitiveLevel, CognitiveModule } from "./core/cognitive-events";
import { NavigationIcon } from "./components/NavigationIcon";
import { applyMemoryRetrievalOutcome, applyMemoryReview } from "./core/memory-consolidation";
import type { RetrievalOutcome, ReviewOutcome } from "./core/memory-consolidation";
import { loadCompatibleArray } from "./core/storage-migration";
import { parsePermissionGatewayStatus } from "./core/permissions";
import { workspaceForScreen, workspaceScreens } from "./core/workspaces";
import type { Screen } from "./core/workspaces";
import { messagesFromWorkingMemory, parseWorkingMemoryOperationResult, parseWorkingMemorySnapshot } from "./core/working-memory";
import type { WorkingMemoryOperationResult, WorkingMemorySnapshot } from "./core/working-memory";
import { parseOwnerProfileSnapshot } from "./core/owner-profile";
import type { OwnerProfileSnapshot } from "./core/owner-profile";

type SessionKind = "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza";

type Session = {
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
const Avatar = lazy(() => import("./Page/Avatar").then((module) => ({ default: module.Avatar })));

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
  const desktopApp = isTauri();
  const avatarDiagnostic = import.meta.env.VITE_ALICE_AVATAR_DIAGNOSTIC === "1";
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemorySnapshot | null>(null);
  const [conversationDraft, setConversationDraft] = useState("");
  const [screen, setScreen] = useState<Screen>(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    const knownScreens = Object.values(workspaceScreens).flat();
    if (knownScreens.includes(requested as Screen)) return requested as Screen;
    return avatarDiagnostic ? "avatar" : "identificacion";
  });
  const [observationEnabled, setObservationEnabled] = useState(false);
  const [foregroundContext, setForegroundContext] = useState<ForegroundContext | null>(null);
  const [cloudPending, setCloudPending] = useState(false);
  const [memoryRetrieval, setMemoryRetrieval] = useState<{ count: number; top: string; ids: string[] }>({ count: 0, top: "", ids: [] });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ providers: [
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
  const memoryLoadStarted = useRef(false);
  const sessionsRef = useRef(sessions);
  const memorySaveQueue = useRef<Promise<void>>(Promise.resolve());
  const workingMemoryGeneration = useRef(-1);

  const remembered = useMemo(() => sessions.filter((session) => session.finishedAt), [sessions]);
  const conversationalMemories = useMemo(() => [...(ownerProfile?.records ?? []), ...remembered], [ownerProfile, remembered]);
  const ollamaProvider = cloudStatus.providers.find((provider) => provider.id === "ollama");
  const ollamaModel = cloudSelection.provider === "ollama" && cloudSelection.model.trim() ? cloudSelection.model : ollamaProvider?.defaultModel ?? "qwen3.5:4b";
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text;
  const brainSnapshot = useMemo(() => buildBrainSnapshot({
    lastUserMessage,
    conversationCount: messages.length,
    memories: conversationalMemories,
    retrievedMemoryCount: memoryRetrieval.count,
    retrievedMemoryTop: memoryRetrieval.top,
    retrievedMemoryIds: memoryRetrieval.ids,
    observerEnabled: observationEnabled,
    foregroundContext,
    cloudConfigured: cloudStatus.providers.some((provider) => provider.configured),
    cloudPending,
  }), [cloudPending, cloudStatus.providers, conversationalMemories, foregroundContext, lastUserMessage, memoryRetrieval, messages.length, observationEnabled]);

  function recordEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO") {
    setCognitiveEvents((current) => [...current.slice(-199), createCognitiveEvent(module, node, payload, level)]);
  }

  useEffect(() => {
    if (!desktopApp || !observationEnabled) return;
    const refresh = async () => {
      try {
        const [context, rawGateway] = await Promise.all([
          invoke<ForegroundContext | null>("get_foreground_context"),
          invoke<unknown>("permission_gateway_status"),
        ]);
        const gateway = parsePermissionGatewayStatus(rawGateway);
        const active = gateway.grants.some((grant) => grant.capabilityId === "context.foreground.control" && grant.mode === "session" && grant.state === "active");
        setObservationEnabled(active);
        setForegroundContext(active ? context : null);
      } catch {
        setObservationEnabled(false);
        setForegroundContext(null);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [desktopApp, observationEnabled]);

  useEffect(() => {
    if (!desktopApp) return;
    invoke<CloudStatus>("cloud_status").then(setCloudStatus).catch((error) => recordEvent("SECURITY", "CLOUD_STATUS_ERROR", String(error), "WARN"));
  }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp) return;
    invoke<unknown>("owner_profile_status").then((raw) => {
      const snapshot = parseOwnerProfileSnapshot(raw);
      setOwnerProfile(snapshot);
      if (snapshot.state === "available") recordEvent("MEMORY", "OWNER_PROFILE_LOAD", `${snapshot.records.length} recuerdos de perfil confirmados · ${snapshot.sourceFiles.length} fuentes con SHA-256`);
    }).catch((error) => recordEvent("SECURITY", "OWNER_PROFILE_LOAD_ERROR", String(error), "WARN"));
  }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const snapshot = parseWorkingMemorySnapshot(await invoke<unknown>("working_memory_status"));
        if (cancelled) return;
        setWorkingMemory(snapshot);
        if (snapshot.generation !== workingMemoryGeneration.current) {
          workingMemoryGeneration.current = snapshot.generation;
          setMessages(messagesFromWorkingMemory(snapshot));
        }
      } catch (error) {
        if (!cancelled && workingMemoryGeneration.current < 0) {
          workingMemoryGeneration.current = 0;
          recordEvent("SECURITY", "WORKING_MEMORY_STATUS_ERROR", String(error), "WARN");
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => { cancelled = true; window.clearInterval(timer); };
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
    setScreen("puentes");
    recordEvent("SECURITY", "PERMISSION_REQUIRED", observationEnabled
      ? "La detención requiere un grant oneShot en el Gateway R2"
      : "La activación requiere un grant de sesión en el Gateway R2");
  }

  async function sendCloudMessage(request: CloudRequest, recalledMemoryIds: string[]) {
    setCloudPending(true);
    recordEvent("PERCEPTION", "INFERENCE_PREFLIGHT_APPROVED", `${request.provider}/${request.model} · historial ${request.historyCount} · RAG ${request.memoryCount}`);
    try {
      const response = await invoke<CloudResponse>("send_cloud_message", { request });
      const now = new Date().toISOString();
      if (response.workingMemory) {
        try {
          const snapshot = parseWorkingMemorySnapshot(response.workingMemory);
          workingMemoryGeneration.current = snapshot.generation;
          setWorkingMemory(snapshot);
          setMessages(messagesFromWorkingMemory(snapshot));
          recordEvent("MEMORY", "WORKING_MEMORY_RECORDED", `${snapshot.messageCount}/${snapshot.maximumMessages} mensajes reales en RAM · TTL ${snapshot.ttlSeconds}s`);
        } catch (error) {
          setMessages((current) => [...current,
            { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: now },
            { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
          ]);
          recordEvent("SECURITY", "WORKING_MEMORY_CONTRACT_ERROR", String(error), "WARN");
        }
      } else {
        setMessages((current) => [...current,
          { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: now },
          { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
        ]);
      }
      if (response.workingMemoryError) recordEvent("SECURITY", "WORKING_MEMORY_RECORD_ERROR", response.workingMemoryError, "WARN");
      if (recalledMemoryIds.length) recordEvent("MEMORY", "MEMORY_RETRIEVAL_AWAITING_FEEDBACK", `${recalledMemoryIds.length} recuerdo${recalledMemoryIds.length === 1 ? "" : "s"} usado${recalledMemoryIds.length === 1 ? "" : "s"} · utilidad aún no confirmada`);
      recordEvent("OUTPUT", "CLOUD_RESPONSE", `${response.provider}/${response.model} · ${response.inputTokens} entrada · ${response.outputTokens} salida`);
      return response;
    } catch (error) {
      recordEvent("SECURITY", "CLOUD_REQUEST_ERROR", String(error), "WARN");
      throw error;
    } finally {
      setCloudPending(false);
    }
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
      setMessages(messagesFromWorkingMemory(result.snapshot));
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

  const workspace = workspaceForScreen(screen);

  return <main className="shell">
    <header className="hero">
      <div className="brand-line"><div className="monogram" aria-hidden="true">A</div><p className="eyebrow">ALICE · NÚCLEO OBSERVABLE</p><span className="privacy-badge"><i />Local-first</span></div>
      <h1>Una presencia digital,<br /><em>bajo tu control.</em></h1>
    </header>

    <nav className="core-system-selector" aria-label="Sistemas de Alice" role="tablist">
      <button type="button" role="tab" aria-selected={workspace === "cognitive"} className={workspace === "cognitive" ? "selected cognitive" : "cognitive"} onClick={() => setScreen("identificacion")}>
        <span>SYS 01 · MENTE Y CONDUCTA</span><strong>COGNITIVE CORE</strong><small>percepción · memoria · estado · actividad</small>
      </button>
      <button type="button" role="tab" aria-selected={workspace === "body"} className={workspace === "body" ? "selected body" : "body"} onClick={() => setScreen("rostro")}>
        <span>SYS 02 · PRESENCIA FÍSICA</span><strong>EMBODIMENT CORE</strong><small>rostro · cuerpo · avatar · entorno futuro</small>
      </button>
      <button type="button" role="tab" aria-selected={workspace === "governance"} className={workspace === "governance" ? "selected governance" : "governance"} onClick={() => setScreen("puentes")}>
        <span>SYS 00 · CONTROL DEL PROPIETARIO</span><strong>GOVERNANCE CORE</strong><small>capacidades · auditoría · habilidades · procedimientos</small>
      </button>
    </nav>

    <section className={`core-system-frame system-${workspace}`} aria-labelledby="active-system-title">
      <header className="core-system-heading">
        <div><span>{workspace === "cognitive" ? "[SYS.01] COGNITIVE WORKSPACE" : workspace === "body" ? "[SYS.02] EMBODIMENT WORKSPACE" : "[SYS.00] OWNER GOVERNANCE"}</span><h2 id="active-system-title">{workspace === "governance" ? "ALICE_LOCAL_CONTROL" : "ALICE_NEURAL_CORE"} <em>// {workspace === "cognitive" ? "COGNITIVE IDENTIFICATION" : workspace === "body" ? "BODY SOLVER" : "GOVERNANCE"}</em></h2></div>
        <p><i />{workspace === "cognitive" ? "LOCAL COGNITIVE CORE" : workspace === "body" ? "PHYSICAL OUTPUT · SAFE OFF" : "OWNER CONTROL · LOCAL ONLY"}</p>
      </header>

    <nav className="screen-tabs grouped" aria-label={workspace === "cognitive" ? "Pantallas de Cognitive Identification" : workspace === "body" ? "Pantallas de Body Solver" : "Herramientas de gobierno local"}>
      {workspace === "cognitive" && <>
      <button className={screen === "identificacion" ? "selected" : ""} aria-label="Entrada e identificación cognitiva" data-tooltip="Entrada e identificación" aria-current={screen === "identificacion" ? "page" : undefined} onClick={() => setScreen("identificacion")}><NavigationIcon kind="identification" active={screen === "identificacion"} /><span className="screen-tab-label">Entrada e identificación</span></button>
      <button className={screen === "nucleo" ? "selected" : ""} aria-label="Volumen cognitivo" data-tooltip="Volumen cognitivo" aria-current={screen === "nucleo" ? "page" : undefined} onClick={() => setScreen("nucleo")}><NavigationIcon kind="volume" active={screen === "nucleo"} /><span className="screen-tab-label">Volumen cognitivo</span></button>
      <button className={screen === "flujo" ? "selected" : ""} aria-label="Flujo cognitivo" data-tooltip="Flujo cognitivo" aria-current={screen === "flujo" ? "page" : undefined} onClick={() => setScreen("flujo")}><NavigationIcon kind="flow" active={screen === "flujo"} /><span className="screen-tab-label">Flujo cognitivo</span></button>
      <button className={screen === "estado" ? "selected" : ""} aria-label="Estado y controles" data-tooltip="Estado y controles" aria-current={screen === "estado" ? "page" : undefined} onClick={() => setScreen("estado")}><NavigationIcon kind="state" active={screen === "estado"} /><span className="screen-tab-label">Estado y controles</span></button>
      <button className={screen === "planificador" ? "selected" : ""} aria-label="Planificador de acción" data-tooltip="Planificador" aria-current={screen === "planificador" ? "page" : undefined} onClick={() => setScreen("planificador")}><NavigationIcon kind="planner" active={screen === "planificador"} /><span className="screen-tab-label">Planificador</span></button>
      <button className={screen === "memoria" ? "selected" : ""} aria-label={`Memoria, ${conversationalMemories.length} recuerdos`} data-tooltip="Memoria" aria-current={screen === "memoria" ? "page" : undefined} onClick={() => setScreen("memoria")}><NavigationIcon kind="memory" active={screen === "memoria"} /><span className="screen-tab-label">Memoria</span><span className="screen-count">{conversationalMemories.length}</span></button>
      <button className={screen === "actividad" ? "selected" : ""} aria-label={`Actividad, ${cognitiveEvents.length} eventos`} data-tooltip="Actividad" aria-current={screen === "actividad" ? "page" : undefined} onClick={() => setScreen("actividad")}><NavigationIcon kind="activity" active={screen === "actividad"} /><span className="screen-tab-label">Actividad</span><span className="screen-count">{cognitiveEvents.length}</span></button>
      </>}
      {workspace === "body" && <>
      <button className={screen === "rostro" ? "selected" : ""} aria-label="Control facial" data-tooltip="Rostro" aria-current={screen === "rostro" ? "page" : undefined} onClick={() => setScreen("rostro")}><NavigationIcon kind="face" active={screen === "rostro"} /><span className="screen-tab-label">Rostro</span></button>
      <button className={screen === "cuerpo" ? "selected" : ""} aria-label="Solucionador corporal" data-tooltip="Cuerpo" aria-current={screen === "cuerpo" ? "page" : undefined} onClick={() => setScreen("cuerpo")}><NavigationIcon kind="body" active={screen === "cuerpo"} /><span className="screen-tab-label">Cuerpo</span></button>
      <button className={screen === "avatar" ? "selected" : ""} aria-label="Avatar local" data-tooltip="Avatar" aria-current={screen === "avatar" ? "page" : undefined} onClick={() => setScreen("avatar")}><NavigationIcon kind="avatar" active={screen === "avatar"} /><span className="screen-tab-label">Avatar</span></button>
      </>}
      {workspace === "governance" && <>
      <button className={screen === "puentes" ? "selected" : ""} aria-label="Capacidades y permisos" data-tooltip="Capacidades y permisos" aria-current={screen === "puentes" ? "page" : undefined} onClick={() => setScreen("puentes")}><NavigationIcon kind="bridges" active={screen === "puentes"} /><span className="screen-tab-label">Capacidades y permisos</span><span className="screen-count">R1/R2</span></button>
      <button className={screen === "auditoria" ? "selected" : ""} aria-label="Auditoría y diagnóstico" data-tooltip="Auditoría y diagnóstico" aria-current={screen === "auditoria" ? "page" : undefined} onClick={() => setScreen("auditoria")}><NavigationIcon kind="audit" active={screen === "auditoria"} /><span className="screen-tab-label">Auditoría y diagnóstico</span><span className="screen-count">R3</span></button>
      <button className={screen === "habilidades" ? "selected" : ""} aria-label="Taller de habilidades" data-tooltip="Taller" aria-current={screen === "habilidades" ? "page" : undefined} onClick={() => setScreen("habilidades")}><NavigationIcon kind="skills" active={screen === "habilidades"} /><span className="screen-tab-label">Taller</span><span className="screen-count">R4</span></button>
      <button className={screen === "procedimientos" ? "selected" : ""} aria-label="Procedimientos observados" data-tooltip="Procedimientos" aria-current={screen === "procedimientos" ? "page" : undefined} onClick={() => setScreen("procedimientos")}><NavigationIcon kind="procedures" active={screen === "procedimientos"} /><span className="screen-tab-label">Procedimientos</span><span className="screen-count">R5</span></button>
      <button className={screen === "configuracion" ? "selected" : ""} aria-label="Configuración" data-tooltip="Configuración" aria-current={screen === "configuracion" ? "page" : undefined} onClick={() => setScreen("configuracion")}><NavigationIcon kind="settings" active={screen === "configuracion"} /><span className="screen-tab-label">Configuración</span></button>
      </>}
    </nav>

    <div className="core-system-content">
    {screen === "nucleo" && <Volumen snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "flujo" && <Flujo snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "estado" && <Estado snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "planificador" && <Planificador snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "identificacion" && <Identificacion draft={conversationDraft} lastUserMessage={lastUserMessage} messageCount={messages.length} memoryCount={conversationalMemories.length} retrievedMemoryCount={memoryRetrieval.count} observerEnabled={observationEnabled} foregroundContext={foregroundContext} cloudPending={cloudPending} observationAvailable={desktopApp} onToggleObservation={toggleObservation} conversationPanel={<Conversacion embedded desktopApp={desktopApp} draft={conversationDraft} status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model} messages={messages} memories={conversationalMemories} observationEnabled={observationEnabled} foregroundContext={foregroundContext} onToggleObservation={toggleObservation} onDraftChange={setConversationDraft} onMemoryRetrieval={setMemoryRetrieval} onOpenSettings={() => setScreen("configuracion")} onSend={sendCloudMessage} onRetrievalOutcome={assessRetrievalOutcome} />} />}
    {screen === "memoria" && <Memoria sessions={sessions} ownerProfile={ownerProfile} workingMemory={workingMemory} onClearWorkingMemory={clearWorkingMemory} onUpdate={(id, changes) => { updateSessions((current) => current.map((session) => session.id === id ? { ...session, ...changes, ...(session.memoryStatus === "conflict" ? { memoryStatus: "confirmed" as const } : {}) } : session)); recordEvent("MEMORY", "MEMORY_UPDATE", `Recuerdo actualizado: ${id}`); }} onDelete={async (id) => { await updateSessionsVerified((current) => current.filter((session) => session.id !== id)); recordEvent("MEMORY", "MEMORY_DELETE", `Fragmento heredado descartado: ${id}`, "WARN"); return sessionsRef.current.length; }} onReview={reviewMemory} onExport={exportMemory} onRestore={restoreMemory} onReloadMemory={reloadMemoryFromDisk} onOpenDirectory={openMemoryDirectory} storageStatus={memoryStatus} storagePath={memoryPath} />}
    {screen === "actividad" && <Actividad key="cognitive-activity" scope="cognitive" desktopApp={desktopApp} events={cognitiveEvents} onClear={() => setCognitiveEvents([])} />}
    {screen === "auditoria" && <Actividad key="governance-audit" scope="governance" desktopApp={desktopApp} events={cognitiveEvents} onClear={() => setCognitiveEvents([])} />}
    {screen === "habilidades" && <Habilidades desktopApp={desktopApp} />}
    {screen === "procedimientos" && <Procedimientos desktopApp={desktopApp} />}
    {screen === "configuracion" && <Configuracion desktopApp={desktopApp} status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model} onProviderChange={selectCloudProvider} onModelChange={(model) => setCloudSelection((current) => ({ ...current, model }))} />}
    {screen === "puentes" && <Puentes fixedView="overview" onObservationStateChange={setObservationEnabled} />}
    {screen === "rostro" && <Puentes fixedView="face" onObservationStateChange={setObservationEnabled} />}
    {screen === "cuerpo" && <Puentes fixedView="body" onObservationStateChange={setObservationEnabled} />}
    {screen === "avatar" && <Suspense fallback={<section className="avatar-page"><div className="avatar-unavailable"><span>VRM</span><strong>Preparando el visor local…</strong><p>Los componentes 3D se cargan solamente al abrir esta pantalla.</p></div></section>}><Avatar desktopApp={desktopApp} /></Suspense>}
    </div>
    </section>
  </main>;
}
