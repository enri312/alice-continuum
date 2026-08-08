import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Conversacion } from "./Page/Conversacion";
import type { CloudRequest, CloudResponse, CloudStatus, ConversationMessage } from "./Page/Conversacion";
import { Nucleo } from "./Page/Nucleo";
import { Memoria } from "./Page/Memoria";
import { Actividad } from "./Page/Actividad";
import { Puentes } from "./Page/Puentes";
import { buildBrainSnapshot } from "./core/brain";
import { createCognitiveEvent } from "./core/cognitive-events";
import type { CognitiveEvent, CognitiveLevel, CognitiveModule } from "./core/cognitive-events";
import { NavigationIcon } from "./components/NavigationIcon";
import { applyMemoryRetrieval, applyMemoryReview, selectReinforceableMemoryIds } from "./core/memory-consolidation";
import type { ReviewOutcome } from "./core/memory-consolidation";
import { loadCompatibleArray } from "./core/storage-migration";

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
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
  contextEvents?: { type: "screenshot"; recordedAt: string }[];
};

type ForegroundContext = { windowTitle: string; processName: string };
type MemorySnapshot = { sessions: Session[]; storagePath: string; existed: boolean };
type Screen = "conversacion" | "nucleo" | "memoria" | "actividad" | "puentes" | "avatar";

const storageKey = "alice-cognitive-core-sessions-v1";
const legacyStorageKeys = ["proyecto-p-sessions-v1"];
const Avatar = lazy(() => import("./Page/Avatar").then((module) => ({ default: module.Avatar })));

function loadSessions(): Session[] {
  return loadCompatibleArray<Session>(localStorage, storageKey, legacyStorageKeys);
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

export function App() {
  const desktopApp = isTauri();
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationDraft, setConversationDraft] = useState("");
  const [screen, setScreen] = useState<Screen>(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    return (["conversacion", "nucleo", "memoria", "actividad", "puentes", "avatar"] as Screen[]).includes(requested as Screen) ? requested as Screen : "conversacion";
  });
  const [observationEnabled, setObservationEnabled] = useState(false);
  const [foregroundContext, setForegroundContext] = useState<ForegroundContext | null>(null);
  const [cloudPending, setCloudPending] = useState(false);
  const [memoryRetrieval, setMemoryRetrieval] = useState({ count: 0, top: "" });
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({ providers: [
    { id: "openrouter", label: "OpenRouter", configured: false, defaultModel: "openrouter/free", protocol: "Chat Completions · router gratuito", retentionMode: "según OpenRouter y el proveedor enrutado" },
    { id: "openai", label: "OpenAI", configured: false, defaultModel: "gpt-5.6-terra", protocol: "Responses API", retentionMode: "store: false" },
    { id: "anthropic", label: "Anthropic", configured: false, defaultModel: "", protocol: "Messages API", retentionMode: "solicitud sin estado local" },
    { id: "google", label: "Google", configured: false, defaultModel: "gemini-3.5-flash", protocol: "GenerateContent", retentionMode: "retención según Google" },
    { id: "xai", label: "xAI", configured: false, defaultModel: "grok-4.5", protocol: "Responses API", retentionMode: "store: false" },
    { id: "compatible", label: "Compatible", configured: false, defaultModel: "", protocol: "Chat Completions", retentionMode: "definida por el servicio" },
  ] });
  const [cognitiveEvents, setCognitiveEvents] = useState<CognitiveEvent[]>([]);
  const [memoryStatus, setMemoryStatus] = useState<"browser" | "loading" | "native" | "error">(desktopApp ? "loading" : "browser");
  const [memoryPath, setMemoryPath] = useState("");
  const memoryLoadStarted = useRef(false);
  const sessionsRef = useRef(sessions);
  const memorySaveQueue = useRef<Promise<void>>(Promise.resolve());

  const remembered = useMemo(() => sessions.filter((session) => session.finishedAt), [sessions]);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text;
  const brainSnapshot = useMemo(() => buildBrainSnapshot({
    lastUserMessage,
    conversationCount: messages.length,
    memoryCount: remembered.length,
    retrievedMemoryCount: memoryRetrieval.count,
    retrievedMemoryTop: memoryRetrieval.top,
    observerEnabled: observationEnabled,
    foregroundContext,
    cloudConfigured: cloudStatus.providers.some((provider) => provider.configured),
    cloudPending,
  }), [cloudPending, cloudStatus.providers, foregroundContext, lastUserMessage, memoryRetrieval, messages.length, observationEnabled, remembered.length]);

  function recordEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO") {
    setCognitiveEvents((current) => [...current.slice(-199), createCognitiveEvent(module, node, payload, level)]);
  }

  useEffect(() => {
    if (!desktopApp || !observationEnabled) return;
    const refresh = () => invoke<ForegroundContext | null>("get_foreground_context").then(setForegroundContext).catch(() => setForegroundContext(null));
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [desktopApp, observationEnabled]);

  useEffect(() => {
    if (!desktopApp) return;
    invoke<CloudStatus>("cloud_status").then(setCloudStatus).catch((error) => recordEvent("SECURITY", "CLOUD_STATUS_ERROR", String(error), "WARN"));
  }, [desktopApp]);

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

  async function toggleObservation() {
    if (!desktopApp) return;
    try {
      const enabled = await invoke<boolean>("set_context_observation_enabled", { enabled: !observationEnabled });
      setObservationEnabled(enabled);
      if (!enabled) setForegroundContext(null);
      recordEvent(enabled ? "PERCEPTION" : "SECURITY", "WINDOW_OBSERVER", enabled ? "Observación de ventana activada" : "Observación detenida y contexto descartado");
    } catch (error) {
      setObservationEnabled(false);
      setForegroundContext(null);
      recordEvent("SECURITY", "WINDOW_OBSERVER_ERROR", String(error), "WARN");
    }
  }

  async function sendCloudMessage(request: CloudRequest, rememberLocally: boolean, recalledMemoryIds: string[]) {
    setCloudPending(true);
    recordEvent("PERCEPTION", "CLOUD_PREFLIGHT_APPROVED", `${request.provider}/${request.model} · historial ${request.historyCount} · memoria ${request.memoryCount}`);
    try {
      const response = await invoke<CloudResponse>("send_cloud_message", { request });
      const now = new Date().toISOString();
      setMessages((current) => [...current,
        { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: now },
        { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
      ]);
      const recalledIds = new Set(recalledMemoryIds);
      const reinforcedIds = new Set(selectReinforceableMemoryIds(sessionsRef.current.filter((session) => recalledIds.has(session.id))));
      if (rememberLocally || reinforcedIds.size) {
        updateSessions((current) => {
          const reinforced = reinforcedIds.size
            ? current.map((session) => reinforcedIds.has(session.id) ? applyMemoryRetrieval(session) : session)
            : current;
          return rememberLocally
            ? [{ id: crypto.randomUUID(), kind: "Conversación", intention: request.message, startedAt: now, finishedAt: new Date().toISOString(), summary: response.text }, ...reinforced]
            : reinforced;
        });
      }
      if (rememberLocally) {
        recordEvent("MEMORY", "CONVERSATION_COMMIT", "Intercambio aprobado y guardado en memoria local");
      }
      if (reinforcedIds.size) recordEvent("MEMORY", "MEMORY_RECALL_REINFORCED", `${reinforcedIds.size} enseñanza${reinforcedIds.size === 1 ? "" : "s"} autorizada${reinforcedIds.size === 1 ? "" : "s"} reforzada${reinforcedIds.size === 1 ? "" : "s"}`);
      recordEvent("OUTPUT", "CLOUD_RESPONSE", `${response.provider}/${response.model} · ${response.inputTokens} entrada · ${response.outputTokens} salida`);
      return response;
    } catch (error) {
      recordEvent("SECURITY", "CLOUD_REQUEST_ERROR", String(error), "WARN");
      throw error;
    } finally {
      setCloudPending(false);
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

  return <main className="shell">
    <header className="hero">
      <div className="brand-line"><div className="monogram" aria-hidden="true">A</div><p className="eyebrow">ALICE · NÚCLEO OBSERVABLE</p><span className="privacy-badge"><i />Local-first</span></div>
      <h1>Una presencia digital,<br /><em>bajo tu control.</em></h1>
    </header>

    <nav className="screen-tabs" aria-label="Pantallas de Alice">
      <button className={screen === "conversacion" ? "selected" : ""} aria-label="Conversación" data-tooltip="Conversación" aria-current={screen === "conversacion" ? "page" : undefined} onClick={() => setScreen("conversacion")}><NavigationIcon kind="conversation" active={screen === "conversacion"} /><span className="screen-tab-label">Conversación</span></button>
      <button className={screen === "nucleo" ? "selected" : ""} aria-label="Núcleo" data-tooltip="Núcleo" aria-current={screen === "nucleo" ? "page" : undefined} onClick={() => setScreen("nucleo")}><NavigationIcon kind="nucleus" active={screen === "nucleo"} /><span className="screen-tab-label">Núcleo</span></button>
      <button className={screen === "memoria" ? "selected" : ""} aria-label={`Memoria, ${remembered.length} recuerdos`} data-tooltip="Memoria" aria-current={screen === "memoria" ? "page" : undefined} onClick={() => setScreen("memoria")}><NavigationIcon kind="memory" active={screen === "memoria"} /><span className="screen-tab-label">Memoria</span><span className="screen-count">{remembered.length}</span></button>
      <button className={screen === "actividad" ? "selected" : ""} aria-label={`Actividad, ${cognitiveEvents.length} eventos`} data-tooltip="Actividad" aria-current={screen === "actividad" ? "page" : undefined} onClick={() => setScreen("actividad")}><NavigationIcon kind="activity" active={screen === "actividad"} /><span className="screen-tab-label">Actividad</span><span className="screen-count">{cognitiveEvents.length}</span></button>
      <button className={screen === "puentes" ? "selected" : ""} aria-label="Puentes de salida, cero conectados" data-tooltip="Puentes de salida" aria-current={screen === "puentes" ? "page" : undefined} onClick={() => setScreen("puentes")}><NavigationIcon kind="bridges" active={screen === "puentes"} /><span className="screen-tab-label">Puentes de salida</span><span className="screen-count">0</span></button>
      <button className={screen === "avatar" ? "selected" : ""} aria-label="Avatar local" data-tooltip="Avatar" aria-current={screen === "avatar" ? "page" : undefined} onClick={() => setScreen("avatar")}><NavigationIcon kind="avatar" active={screen === "avatar"} /><span className="screen-tab-label">Avatar</span></button>
    </nav>

    {screen === "conversacion" && <Conversacion desktopApp={desktopApp} draft={conversationDraft} status={cloudStatus} messages={messages} memories={remembered} observationEnabled={observationEnabled} foregroundContext={foregroundContext} onToggleObservation={toggleObservation} onDraftChange={setConversationDraft} onMemoryRetrieval={setMemoryRetrieval} onSend={sendCloudMessage} />}
    {screen === "nucleo" && <Nucleo snapshot={brainSnapshot} />}
    {screen === "memoria" && <Memoria sessions={sessions} onCreate={(teaching) => { const now = new Date().toISOString(); const record: Session = { id: crypto.randomUUID(), kind: "Enseñanza", intention: teaching.intention, summary: teaching.summary, startedAt: now, finishedAt: now, memoryType: teaching.memoryType, source: teaching.source, importance: teaching.importance, storageStrength: .18, memoryStatus: "confirmed", successfulRecalls: 0, failedRecalls: 0, successfulReviews: 0, correctionCount: 0 }; updateSessions((current) => [record, ...current]); recordEvent("MEMORY", "TEACHING_COMMIT", `Enseñanza local confirmada: ${teaching.intention}`); }} onUpdate={(id, changes) => { updateSessions((current) => current.map((session) => session.id === id ? { ...session, ...changes, ...(session.memoryStatus === "conflict" ? { memoryStatus: "confirmed" as const } : {}) } : session)); recordEvent("MEMORY", "MEMORY_UPDATE", `Recuerdo actualizado: ${id}`); }} onDelete={(id) => { updateSessions((current) => current.filter((session) => session.id !== id)); recordEvent("MEMORY", "MEMORY_DELETE", `Recuerdo eliminado: ${id}`, "WARN"); }} onReview={reviewMemory} onExport={exportMemory} onRestore={restoreMemory} onOpenDirectory={openMemoryDirectory} storageStatus={memoryStatus} storagePath={memoryPath} />}
    {screen === "actividad" && <Actividad events={cognitiveEvents} onClear={() => setCognitiveEvents([])} />}
    {screen === "puentes" && <Puentes />}
    {screen === "avatar" && <Suspense fallback={<section className="avatar-page"><div className="avatar-unavailable"><span>VRM</span><strong>Preparando el visor local…</strong><p>Los componentes 3D se cargan solamente al abrir esta pantalla.</p></div></section>}><Avatar desktopApp={desktopApp} /></Suspense>}
  </main>;
}
