import { useEffect, useId, useRef, useState } from "react";
import { startStateControlsView, type ViewStatus } from "../../components/cognitive/state-controls/lifecycle";
import { createConversationPage, type ConversationPageInputs } from "../../core/conversation/conversation-page-controller";
import { createConversationVision, createDocumentReader } from "../../core/conversation/conversation-tools";
import { observeConversationRetrieval } from "../../core/conversation/conversation-session";
import {
  cancelVoiceOutput, confirmConversationLearning, confirmVoiceOutput, prepareVoiceTurn,
  previewConversationLearning, previewHybridMemoryRetrieval, previewVoiceOutput,
  sendConversationTurn, speakVoiceSession, startVoiceSession, stopVoiceSession, transcribeVoiceTurn,
} from "../../core/conversation/conversation-transport";
import { assessRetrievalOutcome } from "../../core/memory/memory-session";
import { createConversationVoice, measureInputDiagnostics } from "./conversation-voice-controller";
import "../../components/documents/DocumentPreview.css";
import "../../styles/conversation-home.css";
import "../../styles/conversation-context.css";
import "../../styles/conversation-vision.css";

type Props = Omit<ConversationPageInputs,
  "voice" | "onPreviewSpokenResponse" | "onSend" | "onHybridRetrieve" | "onMemoryRetrieval" |
  "onPreviewConversationLearning" | "onConfirmConversationLearning" | "onRetrievalOutcome"> & {
  cloudPending: boolean;
  retrievedMemoryCount: number;
};

export function ConversationHost(props: Props) {
  const root = `alice-conversation-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const container = useRef<HTMLDivElement>(null);
  const source = useRef(props);
  source.current = props;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const synchronize = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    setStatus("loading");
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
        if (next === lastPayload) return;
        lastPayload = next;
        view.update(next);
      });
    };
    const vision = createConversationVision(element, publish);
    const voice = createConversationVoice({
      desktopApp: () => source.current.desktopApp,
      isDisabled: () => source.current.cloudPending || isPageSending(),
      getDraft: () => source.current.draft,
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
      ...source.current,
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
      const { draft, messages, memories, retrievedMemoryCount, observationEnabled, foregroundContext, cloudPending, desktopApp } = source.current;
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
      return JSON.stringify(page.snapshot({
        voice: voice.snapshot(), vision: vision.snapshot(), document: document.snapshot(),
        identification: latestDiagnosis.result,
      }));
    }

    function release() {
      if (!active) return;
      active = false;
      synchronize.current = null;
      voice.dispose();
      vision.dispose();
      document.dispose();
      page.dispose();
    }

    vision.setAvailable(source.current.desktopApp && source.current.provider === "llamacpp");
    lastPayload = snapshot();
    const view = startStateControlsView({
      root,
      initial: lastPayload,
      load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadConversationPageRuntime()),
      onStatus: value => {
        if (value === "error") release();
        setStatus(value);
      },
      onAction: raw => {
        let action: unknown;
        try { action = JSON.parse(raw); } catch { return; }
        if (!action || typeof action !== "object" || !("type" in action) || typeof action.type !== "string") return;
        const value = "value" in action ? action.value : undefined;
        if (action.type === "voice") voice.dispatch("action" in action ? action.action : null);
        else if (action.type.startsWith("vision")) vision.dispatch({ type: action.type, value });
        else if (action.type.startsWith("document")) document.dispatch({ type: action.type, value });
        else page.dispatch(action);
      },
    });
    synchronize.current = () => {
      vision.setAvailable(source.current.desktopApp && source.current.provider === "llamacpp");
      publish();
    };
    return () => {
      release();
      view.dispose();
    };
  }, [root, attempt]);

  useEffect(() => { synchronize.current?.(); });

  return <div data-conversation-renderer={status === "ready" ? "dioxus" : status}>
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando Conversación…</p>}
    {status === "error" && <div className="native-audit-error" role="alert">
      <strong>Conversación no disponible</strong>
      <span>El borrador sigue en esta sesión. Podés volver a abrir la vista.</span>
      <button className="console-button" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar Conversación</button>
    </div>}
    <div id={root} ref={container} hidden={status !== "ready"} />
  </div>;
}
