import { invoke, isTauri } from "@tauri-apps/api/core";
import { DioxusRouteHost, type RouteTransport } from "../../components/cognitive/state-controls/DioxusRouteHost";
import type { CloudStatus } from "../../../core/conversation/conversation-contracts";
import {
  conversationSnapshot, selectCloudProvider, selectConversationModel, setFullConversationHistory,
} from "../../../core/conversation/conversation-session";
import "../../../styles/settings-runtime.css";

type Props = {
  desktopApp: boolean;
  status: CloudStatus;
  provider: string;
  model: string;
  showFullHistory: boolean;
};
type Operation = "start" | "stop";
type Runtime = { running: boolean; pending: Operation | null; message: string };
let runtime: Runtime = { running: false, pending: null, message: "" };
let runtimeRevision = 0;
let runtimeReply: ((value: unknown) => void) | undefined;

function publish(next: Runtime) {
  runtime = next;
  runtimeReply?.({ type: "runtime", runtime });
}

async function readRuntime(command: "local_runtime_status" | "start_local_runtime" | "stop_local_runtime") {
  const result = await invoke<{ running?: unknown }>(command);
  if (typeof result?.running !== "boolean") throw new Error("Estado de Gemma inválido.");
  return result.running;
}

function createSettingsTransport(): RouteTransport {
  let mountedReply: typeof runtimeReply;
  const dispatch: RouteTransport["dispatch"] = (raw, reply) => {
    let action;
    try { action = JSON.parse(raw); } catch { return; }
    if (action?.type === "connect") {
      mountedReply = reply;
      runtimeReply = reply;
      reply({ type: "runtime", runtime });
      if (!isTauri() || runtime.pending) return;
      const revision = ++runtimeRevision;
      void readRuntime("local_runtime_status").then(running => {
        if (revision !== runtimeRevision) return;
        if (running && conversationSnapshot().cloudSelection.provider !== "llamacpp") selectCloudProvider("llamacpp");
        publish({ running, pending: null, message: "" });
      }).catch(error => {
        if (revision === runtimeRevision) publish({ ...runtime, message: String(error) });
      });
      return;
    }
    const selection = conversationSnapshot().cloudSelection;
    if (action?.type === "provider" && typeof action.id === "string" && (!runtime.running || action.id === "llamacpp")) selectCloudProvider(action.id);
    if (action?.type === "model" && typeof action.model === "string" && selection.provider !== "llamacpp") selectConversationModel(action.model);
    if (action?.type === "history" && typeof action.enabled === "boolean") setFullConversationHistory(action.enabled);
    if (action?.type === "runtime" && (action.operation === "start" || action.operation === "stop") && isTauri()) {
      const operation: Operation = action.operation;
      const start = operation === "start";
      if (start ? runtime.running || runtime.pending : runtime.pending === "stop" || (!runtime.running && runtime.pending !== "start")) return;
      const revision = ++runtimeRevision;
      publish({ ...runtime, pending: operation, message: start ? "Iniciando Gemma… No se activa el micrófono." : "Cerrando el motor propio…" });
      void readRuntime(start ? "start_local_runtime" : "stop_local_runtime").then(running => {
        if (revision !== runtimeRevision) return;
        if (running) selectCloudProvider("llamacpp");
        else if (conversationSnapshot().cloudSelection.provider === "llamacpp") selectCloudProvider("ollama");
        publish({ running, pending: null, message: running
          ? "Gemma iniciado y seleccionado como proveedor de conversación."
          : "Gemma apagado. Ollama quedó seleccionado, pero no se cargó ningún modelo automáticamente." });
      }).catch(error => {
        if (revision === runtimeRevision) publish({ ...runtime, pending: null, message: String(error) });
      });
    }
  };
  return { dispatch, dispose() { if (runtimeReply === mountedReply) runtimeReply = undefined; } };
}

const loadSettings = () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadSettingsPageRuntime());

export function Configuracion({ status, ...selection }: Props) {
  return <DioxusRouteHost renderer="settings" name="Configuración" load={loadSettings} createTransport={createSettingsTransport}
    configuration={JSON.stringify({ type: "configure", settings: { ...selection, providers: status.providers } })} />;
}
