import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../../../core/cognitive/activity-session";
import { DEFAULT_CONVERSATION_BEHAVIOR } from "../../../core/conversation/behavior-settings";
import type { CloudStatus, ConversationMessage } from "../../../core/conversation/conversation-contracts";
import { messagesFromConversationHistory, parseConversationHistorySnapshot } from "../../../core/conversation/conversation-history";

const cloudSelectionKey = "alice-cognitive-core-cloud-selection-v1";

function loadCloudSelection() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cloudSelectionKey) ?? "null") as { provider?: unknown; model?: unknown } | null;
    return { provider: typeof parsed?.provider === "string" ? parsed.provider : "", model: typeof parsed?.model === "string" ? parsed.model : "" };
  } catch {
    return { provider: "", model: "" };
  }
}

// Former App.tsx wiring kept inactive until the React migration is complete.
export function useLegacyConversation(desktopApp: boolean) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [conversationDraft, setConversationDraft] = useState("");
  const [cloudPending, setCloudPending] = useState(false);
  const [conversationBehavior, setConversationBehavior] = useState(() => ({ ...DEFAULT_CONVERSATION_BEHAVIOR }));
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

  useEffect(() => {
    if (!desktopApp) return;
    invoke<CloudStatus>("cloud_status").then(setCloudStatus).catch((error) => recordEvent("SECURITY", "CLOUD_STATUS_ERROR", String(error), "WARN"));
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

  return {
    messages, setMessages, showFullHistory, setShowFullHistory, conversationDraft, setConversationDraft,
    cloudPending, setCloudPending, conversationBehavior, setConversationBehavior,
    cloudStatus, cloudSelection, setCloudSelection, selectCloudProvider,
  };
}
