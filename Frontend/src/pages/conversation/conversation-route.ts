import { createConversationPage } from "../../core/conversation/conversation-page-controller";
import { createConversationVision, createDocumentReader } from "../../core/conversation/conversation-tools";
import { conversationSnapshot, observeConversationRetrieval, setConversationDraft } from "../../core/conversation/conversation-session";
import {
  cancelVoiceOutput, confirmConversationLearning, confirmVoiceOutput, prepareVoiceTurn,
  previewConversationLearning, previewHybridMemoryRetrieval, previewVoiceOutput,
  sendConversationTurn, speakVoiceSession, startVoiceSession, stopVoiceSession, transcribeVoiceTurn,
} from "../../core/conversation/conversation-transport";
import { assessRetrievalOutcome } from "../../core/memory/memory-session";
import { createConversationVoice, measureInputDiagnostics } from "./conversation-voice-controller";
import { observationSnapshot } from "../../core/governance/observation-session";
import { appData, desktopApp, toggleObservation } from "../../core/navigation/app-sources";
import { navigate } from "../../core/navigation/app-session";
import type { Reply, RouteOptions } from "../../core/navigation/view-mount";
import "../../components/documents/DocumentPreview.css";
import "../../styles/conversation-home.css";
import "../../styles/conversation-context.css";
import "../../styles/conversation-vision.css";

function inputs() {
  const { catalog, learning } = appData();
  const { cloudStatus, cloudSelection, draft, showFullHistory, messages, pending, retrieval } = conversationSnapshot();
  const { grant, foregroundContext } = observationSnapshot();
  return {
    desktopApp, draft, showFullHistory, status: cloudStatus, provider: cloudSelection.provider, model: cloudSelection.model,
    messages, memories: catalog.conversationalMemories, cloudPending: pending, foregroundContext, observationEnabled: Boolean(grant),
    retrievedMemoryCount: retrieval.count, onDraftChange: setConversationDraft, onToggleObservation: toggleObservation,
    onOpenSettings: () => navigate("configuracion"),
    automaticLearning: learning.automaticMemory ? {
      enabled: learning.automaticMemory.enabled, count: learning.automaticMemory.activeCount,
      phase: learning.automaticPhase, onOpen: () => navigate("memoria"),
    } : undefined,
  };
}

function connect(element: HTMLDivElement, reply: Reply) {
  let active = true;
  let queued = false;
  let lastPayload = "";
  let latestDiagnosis: { key: string; result: ReturnType<typeof measureInputDiagnostics> } | null = null;
  let isPageSending = () => false;

  const publish = () => {
    if (!active || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!active) return;
      page.observeRetrieval();
      const next = snapshot();
      const serialized = JSON.stringify(next);
      if (serialized === lastPayload) return;
      lastPayload = serialized;
      reply(next);
    });
  };
  const vision = createConversationVision(element, publish);
  const voice = createConversationVoice({
    desktopApp: () => inputs().desktopApp,
    isDisabled: () => inputs().cloudPending || isPageSending(),
    getDraft: () => inputs().draft,
    setDraft: value => page.setVoiceDraft(value),
    invalidateReview: () => page.invalidateReview(),
    prepare: prepareVoiceTurn,
    start: () => {
      page.startVoiceSession();
      return startVoiceSession();
    },
    stop: stopVoiceSession,
    transcribe: transcribeVoiceTurn,
    respond: (text, id) => page.processSpokenTurn(text, id),
    speak: speakVoiceSession,
    preview: previewVoiceOutput,
    confirm: confirmVoiceOutput,
    cancel: cancelVoiceOutput,
  }, publish);
  const page: ReturnType<typeof createConversationPage> = createConversationPage(() => ({
    ...inputs(),
    voice: voice.snapshot(),
    onSend: (request, ids, retrieval, authorization) => sendConversationTurn(request, ids, retrieval, vision.capture, authorization),
    onMemoryRetrieval: observeConversationRetrieval,
    onHybridRetrieve: previewHybridMemoryRetrieval,
    onPreviewConversationLearning: previewConversationLearning,
    onConfirmConversationLearning: confirmConversationLearning,
    onRetrievalOutcome: assessRetrievalOutcome,
    onPreviewSpokenResponse: id => voice.previewSpokenResponse(id),
  }), publish);
  isPageSending = page.isSending;
  const document = createDocumentReader(element, publish);

  function snapshot() {
    const { draft, messages, memories, retrievedMemoryCount, observationEnabled, foregroundContext, cloudPending, desktopApp } = inputs();
    const analysis = {
      draft,
      lastUserMessage: [...messages].reverse().find(message => message.role === "user")?.text,
      messageCount: messages.length,
      memoryCount: memories.length,
      retrievedMemoryCount,
      observerEnabled: observationEnabled,
      foregroundContext,
      cloudPending,
    };
    const key = JSON.stringify([analysis, desktopApp]);
    if (latestDiagnosis?.key !== key) {
      latestDiagnosis = { key, result: measureInputDiagnostics(analysis, desktopApp) };
    }
    return page.snapshot({
      voice: voice.snapshot(), vision: vision.snapshot(), document: document.snapshot(),
      identification: latestDiagnosis.result,
    });
  }

  function release() {
    if (!active) return;
    active = false;
      voice.dispose();
    vision.dispose();
    document.dispose();
    page.dispose();
  }
  const refresh = () => {
    const { desktopApp, provider } = inputs();
    vision.setAvailable(desktopApp && provider === "llamacpp");
    publish();
  };
  refresh();
  return {
    initial: snapshot,
    refresh,
    dispose: release,
    dispatch(raw: string) {
      let action: unknown;
      try { action = JSON.parse(raw); } catch { return; }
      if (!action || typeof action !== "object" || !("type" in action) || typeof action.type !== "string") return;
      const value = "value" in action ? action.value : undefined;
      if (action.type === "voice") voice.dispatch("action" in action ? action.action : null);
      else if (action.type.startsWith("vision")) vision.dispatch({ type: action.type, value });
      else if (action.type.startsWith("document")) document.dispatch({ type: action.type, value });
      else page.dispatch(action);
    },
  };
}

export const conversationRoute: RouteOptions = {
  renderer: "conversation", name: "Conversación",
  load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadConversationPageRuntime()),
  errorTitle: "Conversación no disponible", retry: "Reintentar Conversación",
  errorDetail: "El borrador sigue en esta sesión. Podés volver a abrir la vista.",
  createTransport: connect,
};
