import { invoke, isTauri } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../cognitive/activity-session";
import { emptyMemoryRetrieval, type MemoryContextMode, type MemoryRetrievalObservation } from "../memory/retrieval-observation";
import { DEFAULT_CONVERSATION_BEHAVIOR, type ConversationBehaviorKey } from "./behavior-settings";
import type { CloudRequest, CloudResponse, CloudStatus, ConversationMessage } from "./conversation-contracts";
import { messagesFromConversationHistory, parseConversationHistorySnapshot } from "./conversation-history";

const cloudSelectionKey = "alice-cognitive-core-cloud-selection-v1";
const initialCloudStatus: CloudStatus = { providers: [
    { id: "llamacpp", label: "Gemma local · llama.cpp", configured: false, defaultModel: "gemma-4-E2B-it-Q4_K_M", protocol: "Local · inicio por autoestudio o desde Configuración", retentionMode: "Sin nube" },
    { id: "ollama", label: "Ollama local", configured: false, defaultModel: "qwen3.5:4b", protocol: "Chat local · loopback", retentionMode: "inferencia local; sin salida a Internet" },
    { id: "openai", label: "OpenAI", configured: false, defaultModel: "gpt-5.6-terra", protocol: "Responses API", retentionMode: "store: false" },
    { id: "anthropic", label: "Anthropic", configured: false, defaultModel: "", protocol: "Messages API", retentionMode: "solicitud sin estado local" },
    { id: "google", label: "Google", configured: false, defaultModel: "gemini-3.5-flash", protocol: "GenerateContent", retentionMode: "retención según Google" },
    { id: "xai", label: "xAI", configured: false, defaultModel: "grok-4.5", protocol: "Responses API", retentionMode: "store: false" },
    { id: "compatible", label: "Compatible", configured: false, defaultModel: "", protocol: "Chat Completions", retentionMode: "definida por el servicio" },
  ] };
type Selection = { provider: string; model: string };

function loadCloudSelection(): Selection {
  try {
    const parsed: { provider?: unknown; model?: unknown } | null = JSON.parse(localStorage.getItem(cloudSelectionKey) ?? "null");
    return {
      provider: typeof parsed?.provider === "string" ? parsed.provider : "",
      model: typeof parsed?.model === "string" ? parsed.model : "",
    };
  } catch {
    return { provider: "", model: "" };
  }
}

const listeners = new Set<() => void>();
let current = {
  cloudStatus: initialCloudStatus,
  cloudSelection: loadCloudSelection(),
  draft: "",
  showFullHistory: false,
  behavior: DEFAULT_CONVERSATION_BEHAVIOR,
  pending: false,
  retrieval: emptyMemoryRetrieval(),
  messages: [] as ConversationMessage[],
};
type Snapshot = typeof current;
type Projection = Omit<Snapshot, "cloudStatus" | "messages" | "retrieval"> & {
  cloudStatus: CloudStatus | null;
  messages: ConversationMessage[] | null;
  retrieval: MemoryRetrievalObservation | null;
  persistSelection: boolean;
};
type Action =
  | { type: "status"; status: CloudStatus }
  | { type: "resolveSelection" | "endTurn" | "resetRetrieval" }
  | { type: "beginTurn"; prepared?: MemoryRetrievalObservation; query: string; includeMemories: boolean }
  | { type: "observeRetrieval"; observation: MemoryRetrievalObservation }
  | { type: "completeRetrieval"; responseId: string; mode?: MemoryContextMode }
  | { type: "selectProvider"; provider: string }
  | { type: "selectModel"; model: string }
  | { type: "draft"; draft: string }
  | { type: "showFullHistory"; enabled: boolean }
  | { type: "behavior"; key: ConversationBehaviorKey; value: number }
  | { type: "initialHistory" | "replaceHistory"; messages: ConversationMessage[] }
  | { type: "appendTurn"; messages: [ConversationMessage, ConversationMessage] };
let initialized = false;
let transport: ((input: string) => string) | undefined;
let savedSelection = JSON.stringify(current.cloudSelection);

function project(raw: string, retrievalOnly = false) {
  const next: Projection = JSON.parse(raw);
  if (retrievalOnly && !next.retrieval) return;
  current = {
    cloudStatus: next.cloudStatus ?? current.cloudStatus,
    cloudSelection: next.cloudSelection,
    draft: next.draft,
    showFullHistory: next.showFullHistory,
    behavior: next.behavior,
    pending: next.pending,
    retrieval: next.retrieval ?? current.retrieval,
    messages: next.messages ?? current.messages,
  };
  const selection = JSON.stringify(next.cloudSelection);
  if (next.persistSelection && next.cloudSelection.provider && selection !== savedSelection) {
    try {
      localStorage.setItem(cloudSelectionKey, selection);
      savedSelection = selection;
    } catch (error) {
      recordEvent("SECURITY", "CONVERSATION_PREFERENCES_SAVE_ERROR", String(error), "WARN");
    }
  }
  for (const listener of listeners) listener();
}

function send(action: Action) {
  if (transport) project(transport(JSON.stringify(action)), action.type === "observeRetrieval");
}

function readHistory() {
  void invoke<unknown>("conversation_history_status").then(raw => {
    const history = parseConversationHistorySnapshot(raw);
    if (history.state === "invalid") {
      recordEvent("SECURITY", "CONVERSATION_HISTORY_INVALID", history.error ?? "Historial bloqueado", "WARN");
      return;
    }
    send({ type: "initialHistory", messages: messagesFromConversationHistory(history) });
    if (history.state === "ready") {
      recordEvent("MEMORY", "CONVERSATION_HISTORY_LOADED", `${history.messageCount} mensajes locales recuperados · sin promoción automática a recuerdo`);
    }
  }).catch(error => recordEvent("SECURITY", "CONVERSATION_HISTORY_LOAD_ERROR", String(error), "WARN"));
}

// Transport for the browser's storage and Tauri. Rust applies session actions.
export function connectConversationSession(initialize: (raw: string) => string, apply: (raw: string) => string) {
  if (initialized) return;
  const desktopApp = isTauri();
  const snapshot = initialize(JSON.stringify({ desktopApp, cloudStatus: initialCloudStatus, cloudSelection: current.cloudSelection }));
  initialized = true;
  transport = apply;
  project(snapshot);
  if (!desktopApp) return;
  void invoke<CloudStatus>("cloud_status").then(status => send({ type: "status", status })).catch(error => {
    recordEvent("SECURITY", "CLOUD_STATUS_ERROR", String(error), "WARN");
    send({ type: "resolveSelection" });
  });
  readHistory();
}

export function subscribeToConversation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const conversationSnapshot = () => current;
export const setConversationDraft = (draft: string) => send({ type: "draft", draft });
export const setFullConversationHistory = (enabled: boolean) => send({ type: "showFullHistory", enabled });
export const selectConversationModel = (model: string) => send({ type: "selectModel", model });
export const changeConversationBehavior = (key: ConversationBehaviorKey, value: number) => send({ type: "behavior", key, value });

export function selectCloudProvider(provider: string) {
  const selected = current.cloudStatus.providers.find(item => item.id === provider);
  if (!selected || !transport) return;
  send({ type: "selectProvider", provider });
  recordEvent("SYSTEM", "INFERENCE_ROUTE_SELECTED", `${selected.label} · ${selected.defaultModel || "sin modelo"}`);
}

export const observeConversationRetrieval = (observation: MemoryRetrievalObservation) => send({ type: "observeRetrieval", observation });
export const resetConversationRetrieval = () => send({ type: "resetRetrieval" });
export function completeConversationRetrieval(responseId: string, mode?: MemoryContextMode) {
  const verifiedMode = mode === "full" || mode === "limited" || mode === "none" ? mode : undefined;
  send({ type: "completeRetrieval", responseId, mode: verifiedMode });
}

export function beginConversationTurn(query: string, includeMemories: boolean, prepared?: MemoryRetrievalObservation) {
  if (!transport) throw new Error("La sesión de Conversación todavía no está disponible.");
  send({ type: "beginTurn", query, prepared, includeMemories });
  return current.behavior;
}

export const endConversationTurn = () => send({ type: "endTurn" });

export function recordConversationResponse(request: CloudRequest, response: CloudResponse, startedAt: string) {
  if (response.conversationHistory) {
    try {
      const history = parseConversationHistorySnapshot(response.conversationHistory);
      if (history.state !== "ready") throw new Error(history.error || "No se recibió un historial vigente.");
      send({ type: "replaceHistory", messages: messagesFromConversationHistory(history) });
      recordEvent("MEMORY", "CONVERSATION_HISTORY_APPENDED", `${history.messageCount} mensajes persistentes · aprendizaje automático se evalúa aparte`);
      return;
    } catch (error) {
      recordEvent("SECURITY", "CONVERSATION_HISTORY_CONTRACT_ERROR", String(error), "WARN");
    }
  }
  send({ type: "appendTurn", messages: [
    { id: crypto.randomUUID(), role: "user", text: request.message, createdAt: startedAt },
    { id: crypto.randomUUID(), role: "assistant", text: response.text, createdAt: new Date().toISOString(), model: `${response.provider} · ${response.model}` },
  ] });
}
