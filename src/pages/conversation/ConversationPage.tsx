import type { ConversationMessage, CloudStatus, CloudRequest, CloudResponse, HybridRetrievalCandidate, HybridRetrievalRequest, HybridRetrievalPreview } from "../../core/conversation/conversation-contracts";
import { HandsFreeVoice } from "../../components/conversation/HandsFreeVoice";
import { AudioInputSettings } from "../../components/conversation/AudioInputSettings";
import type { MicrophoneSensitivity, NoiseStatus } from "../../core/voice/noise-types";
import type { ReactNode } from "react";
import type { VoiceLoopState } from "../../core/voice/voice-loop";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildRetrievalQuery, retrieveMemories } from "../../core/memory/memory-retrieval";
import { buildCloudPayloadReview, type CloudPayloadBudget } from "../../core/conversation/cloud-payload";
import { selectReinforceableMemoryIds } from "../../core/memory/memory-consolidation";
import type { RetrievalOutcome } from "../../core/memory/memory-consolidation";
import type { ConversationLearningApproval, ConversationLearningCandidate, ConversationLearningPreview } from "../../core/conversation/conversation-learning";
import type { VoiceOutputPreview, VoiceOutputResult } from "../../core/voice/voice-output";
import { bytesToBase64 } from "../../core/voice/voice-input";
import { VoiceCapture } from "../../core/voice/voice-capture";
import type { VoiceTurnTranscript } from "../../core/voice/voice-input";
import { affectPalette } from "../../core/cognitive/affect";
import "../../styles/conversation-context.css";

const conversationMemoryTypeLabels: Record<ConversationLearningCandidate["memoryType"], string> = {
  semantic: "SEMÁNTICA",
  preference: "PREFERENCIA",
  episodic: "EPISÓDICA",
};

const INITIAL_VISIBLE_MESSAGES = 12;

type MemoryExcerpt = { studyLearning?: boolean; automaticLearning?: boolean; ownerReviewed?: boolean; id?: string; kind?: string; intention: string; summary?: string; nextStep?: string; finishedAt?: string; memoryType?: "semantic" | "procedural" | "preference" | "episodic"; source?: string; memoryStatus?: "confirmed" | "conflict" | "archived"; accessibilityStatus?: "accessible" | "dormant"; suppressionStatus?: "suppressed"; archiveStatus?: "archived"; deletionStatus?: "scheduled" };

type ConversacionProps = {
  visionPanel?: ReactNode;
  automaticLearning?: {enabled:boolean;count:number;phase:"idle" | "evaluating" | "error";onOpen:()=>void};
  embedded?: boolean;
  desktopApp: boolean;
  draft: string;
  status: CloudStatus;
  provider: string;
  model: string;
  messages: ConversationMessage[];
  memories: MemoryExcerpt[];
  observationEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  onToggleObservation: () => Promise<void>;
  onDraftChange: (value: string) => void;
  onMemoryRetrieval: (state: { count: number; top: string; ids: string[] }) => void;
  onHybridRetrieve: (request: HybridRetrievalRequest) => Promise<HybridRetrievalPreview>;
  onPreviewConversationLearning: (exchangeId: string) => Promise<ConversationLearningPreview>;
  onConfirmConversationLearning: (preview: ConversationLearningPreview, candidate: ConversationLearningCandidate, approved: ConversationLearningApproval) => Promise<{ recordId: string; recordCount: number; alreadyConfirmed: boolean }>;
  onPreviewVoiceOutput: (exchangeId: string) => Promise<VoiceOutputPreview>;
  onConfirmVoiceOutput: (requestId: string) => Promise<VoiceOutputResult>;
  onCancelVoiceOutput: (requestId: string) => Promise<void>;
  onTranscribeVoiceTurn: (audioBase64: string, mimeType: string, sessionId?: string) => Promise<VoiceTurnTranscript>;
  onStartVoiceSession: () => Promise<string>;
  onStopVoiceSession: (sessionId: string) => Promise<void>;
  onSpeakVoiceSession: (exchangeId: string, sessionId: string) => Promise<VoiceOutputResult>;
  onPrepareVoiceTurn: () => Promise<void>;
  onOpenSettings: () => void;
  showFullHistory?: boolean;
  onSend: (request: CloudRequest, recalledMemoryIds: string[]) => Promise<CloudResponse>;
  onRetrievalOutcome: (recordId: string, outcome: RetrievalOutcome) => Promise<void>;
};

export function VoiceTurnMeasurements({ recordedSeconds, transcriptionMs, model, state }: {
  recordedSeconds: number | null; transcriptionMs: number | null; model: string | null; state: string;
}) {
  if (recordedSeconds === null && transcriptionMs === null) return null;
  return <details className="voice-turn-measurements"><summary>Datos del turno</summary>
    <div className="voice-turn-observation" aria-label="Observación del último turno">
      <span><strong>{recordedSeconds?.toFixed(1) ?? "—"} s</strong>toma efímera</span>
      <span><strong>{transcriptionMs === null ? "—" : `${(transcriptionMs / 1000).toFixed(1)} s`}</strong>transcripción</span>
      <span><strong>{model ?? "—"}</strong>modelo de transcripción</span>
      <span><strong>{state === "review" ? "REVISAR" : state === "recorded" ? "LISTA" : state === "idle" ? "SIN HABLA" : "EN CURSO"}</strong>resultado</span>
    </div>
  </details>;
}

export function reviewUsesCurrentRoute(request: Pick<CloudRequest, "provider" | "model"> | null, provider: string, model: string) {
  return request !== null && request.provider === provider && request.model === model;
}

export function buildHybridRetrievalCandidates(memories: MemoryExcerpt[], limit = 24): HybridRetrievalCandidate[] {
  return memories
    .filter((memory) => !memory.automaticLearning && Boolean(memory.id)
      && (memory.memoryStatus === undefined || memory.memoryStatus === "confirmed")
      && memory.accessibilityStatus !== "dormant"
      && memory.suppressionStatus !== "suppressed"
      && memory.archiveStatus !== "archived"
      && memory.deletionStatus !== "scheduled")
    .slice(0, Math.max(0, limit))
    .map((memory) => ({
      id: memory.id as string,
      text: memory.kind === "Conversación"
        ? memory.intention.trim()
        : [memory.intention, memory.summary, memory.nextStep].filter((value): value is string => Boolean(value?.trim())).join("\n"),
    }))
    .filter((candidate) => Boolean(candidate.text));
}

export function visibleConversationMessages(messages: ConversationMessage[], limit = INITIAL_VISIBLE_MESSAGES) {
  const safeLimit = Number.isSafeInteger(limit) ? Math.max(1, limit) : INITIAL_VISIBLE_MESSAGES;
  return messages.slice(-safeLimit);
}

function messageTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function Conversacion({ visionPanel, automaticLearning, embedded = false, showFullHistory = false, desktopApp, draft, status, provider, model, messages, memories, observationEnabled, foregroundContext, onToggleObservation, onDraftChange, onMemoryRetrieval, onHybridRetrieve, onPreviewConversationLearning, onConfirmConversationLearning, onPreviewVoiceOutput, onConfirmVoiceOutput, onCancelVoiceOutput, onTranscribeVoiceTurn, onPrepareVoiceTurn, onStartVoiceSession, onStopVoiceSession, onSpeakVoiceSession, onOpenSettings, onSend, onRetrievalOutcome }: ConversacionProps) {
  const [handsFreeState, setHandsFreeState] = useState<VoiceLoopState>("idle");
  const voiceHistoryBaseline = useRef(new Set<string>());
  const handsFreeActive = handsFreeState !== "idle" && handsFreeState !== "error";
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(true);
  const [includeWindow, setIncludeWindow] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<CloudRequest | null>(null);
  const [reviewBudget, setReviewBudget] = useState<CloudPayloadBudget | null>(null);
  const [reviewMemoryIds, setReviewMemoryIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingRetrievals, setPendingRetrievals] = useState<{ key: string; recordId: string }[]>([]);
  const [retrievalFeedbackPending, setRetrievalFeedbackPending] = useState<string | null>(null);
  const [hybridPreview, setHybridPreview] = useState<{ query: string; preview: HybridRetrievalPreview } | null>(null);
  const [hybridPending, setHybridPending] = useState(false);
  const [conversationLearning, setConversationLearning] = useState<ConversationLearningPreview | null>(null);
  const [conversationLearningPending, setConversationLearningPending] = useState<string | null>(null);
  const [conversationLearningMessage, setConversationLearningMessage] = useState("");
  const [learningImportance, setLearningImportance] = useState<Record<string, number>>({});
  const [voicePreview, setVoicePreview] = useState<VoiceOutputPreview | null>(null);
  const [voicePending, setVoicePending] = useState<"preview" | "confirm" | "cancel" | null>(null);
  const [voiceAudio, setVoiceAudio] = useState<VoiceOutputResult | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [voiceCaptureState, setVoiceCaptureState] = useState<"idle" | "requesting" | "recording" | "recorded" | "transcribing" | "review">("idle");
  const [microphoneId, setMicrophoneId] = useState("");
  const [microphoneSensitivity, setMicrophoneSensitivity] = useState<MicrophoneSensitivity>("soft");
  const [noiseStatus, setNoiseStatus] = useState<NoiseStatus | null>(null);
  const [voiceInputMessage, setVoiceInputMessage] = useState("El micrófono está apagado. Nada se graba ni se envía.");
  const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState(0);
  const [voiceRecordedSeconds, setVoiceRecordedSeconds] = useState<number | null>(null);
  const [voiceTranscriptDurationMs, setVoiceTranscriptDurationMs] = useState<number | null>(null);
  const [voiceTranscriptModel, setVoiceTranscriptModel] = useState<string | null>(null);
  const [voicePlaybackState, setVoicePlaybackState] = useState<"ready" | "playing" | "paused">("ready");
  const [error, setError] = useState("");
  const reviewRef = useRef<HTMLDivElement>(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const voiceCaptureRef = useRef<VoiceCapture | null>(null);
  const voiceTakeRef = useRef<Blob | null>(null);
  const voiceOperationGenerationRef = useRef(0);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);
  const voiceOutputGenerationRef = useRef(0);
  const voiceOutputPanelRef = useRef<HTMLElement>(null);

  const recentHistory = messages.slice(-10);
  const retrievalQuery = useMemo(() => buildRetrievalQuery(draft, recentHistory), [draft, recentHistory]);
  const lexicalMatches = useMemo(() => retrieveMemories(retrievalQuery, memories, 3), [memories, retrievalQuery]);
  const hybridCandidates = useMemo(() => buildHybridRetrievalCandidates(memories), [memories]);
  const hybridMatches = useMemo(() => {
    if (!hybridPreview || hybridPreview.query !== retrievalQuery) return [];
    return hybridPreview.preview.matches.flatMap((match) => {
      const memory = memories.find((item) => item.id === match.id);
      return memory ? [{ memory, score: 4 - match.rank, matchedTerms: [], reason: match.reason, rank: match.rank }] : [];
    });
  }, [hybridPreview, memories, retrievalQuery]);
  const hybridActive = hybridMatches.length === 3;
  const memoryMatches = hybridActive ? hybridMatches : lexicalMatches;
  const dormantMemoryCount = useMemo(() => memories.filter((memory) => memory.accessibilityStatus === "dormant").length, [memories]);
  const suppressedMemoryCount = useMemo(() => memories.filter((memory) => memory.suppressionStatus === "suppressed").length, [memories]);
  const retrievedMemories = memoryMatches.map((match) => match.memory);
  const selectedProvider = status.providers.find((option) => option.id === provider) ?? status.providers[0];
  const localInference = selectedProvider?.id === "ollama" || selectedProvider?.id === "llamacpp";
  const localReview = reviewRequest?.provider === "ollama" || reviewRequest?.provider === "llamacpp";
  const configuredCount = status.providers.filter((option) => option.configured).length;
  const newestExchangeId = messages.at(-1)?.exchangeId;
  const visibleMessages = showFullHistory ? messages : visibleConversationMessages(messages);
  const voiceBusy = ["requesting", "recording", "transcribing"].includes(voiceCaptureState);
  const handsFreeLabels: Partial<Record<VoiceLoopState, string>> = { preparing: "Preparando la escucha", standby: "En espera · di Alice", transcribing: "Entendiendo tu frase", thinking: "Alice está respondiendo", synthesizing: "Preparando la voz", speaking: "Alice está hablando" };
  const turnStatus = handsFreeActive ? { label: handsFreeLabels[handsFreeState] ?? "Conversación activa", tone: handsFreeState === "standby" ? "recording" : handsFreeState === "speaking" ? "speaking" : "busy" }
    : voiceCaptureState === "recording" ? { label: "Te escucho", tone: "recording" }
    : voiceCaptureState === "transcribing" ? { label: "Transcribiendo tu voz", tone: "busy" }
    : voiceCaptureState === "requesting" ? { label: "Preparando el micrófono", tone: "busy" }
    : voicePending === "confirm" ? { label: "Generando la voz de Alice", tone: "busy" }
    : voicePlaybackState === "playing" ? { label: "Alice está hablando", tone: "speaking" }
    : voicePlaybackState === "paused" ? { label: "Voz de Alice en pausa", tone: "idle" }
    : sending ? { label: "Preparando la respuesta", tone: "busy" }
    : error ? { label: "Hay un problema que revisar", tone: "error" }
    : voicePreview ? { label: "Respuesta lista para autorizar su voz", tone: "idle" }
    : reviewing ? { label: "Revisa el mensaje antes de enviarlo", tone: "idle" }
    : { label: "Micrófono apagado", tone: "idle" };


  useEffect(() => {
    if (handsFreeActive) return;
    onMemoryRetrieval({ count: includeMemory ? memoryMatches.length : 0, top: includeMemory ? memoryMatches[0]?.memory.intention ?? "" : "", ids: includeMemory ? memoryMatches.flatMap((match) => match.memory.id ? [match.memory.id] : []) : [] });
  }, [memoryMatches, onMemoryRetrieval, handsFreeActive, includeMemory]);

  useEffect(() => {
    const enableLocalContext = selectedProvider?.id === "ollama" || selectedProvider?.id === "llamacpp";
    setIncludeHistory(enableLocalContext);
    setIncludeMemory(enableLocalContext);
    setReviewing(false);
    setHybridPreview(null);
  }, [selectedProvider?.id]);

  useEffect(() => {
    setHybridPreview(null);
  }, [memories, model]);

  useEffect(() => {
    if (!reviewRequest || reviewUsesCurrentRoute(reviewRequest, provider, model)) return;
    setReviewing(false);
    setReviewRequest(null);
    setReviewBudget(null);
    setReviewMemoryIds([]);
    setError("Cambió el motor seleccionado. Revisá nuevamente el contexto antes de procesarlo.");
  }, [model, provider, reviewRequest]);

  useEffect(() => {
    if (observationEnabled) return;
    setIncludeWindow(false);
    setReviewing(false);
  }, [observationEnabled]);

  useEffect(() => {
    if (!reviewing) return;
    const frame = window.requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reviewing]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    if (messages.length <= previousCount) return;
    const frame = window.requestAnimationFrame(() => {
      const stream = messageStreamRef.current;
      if (stream) stream.scrollTop = stream.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => {
    if (!voicePreview && !voiceAudio) return;
    const frame = window.requestAnimationFrame(() => {
      voiceOutputPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      voiceOutputPanelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [voicePreview?.requestId, voiceAudio?.requestId]);

  useEffect(() => () => {
    voiceOperationGenerationRef.current += 1;
    voiceOutputGenerationRef.current += 1;
    voiceCaptureRef.current?.cancel();
    voiceTakeRef.current = null;
  }, []);

  const payloadReview = useMemo(() => buildCloudPayloadReview({
    draft,
    includeHistory,
    recentHistory,
    includeMemory,
    memories: retrievedMemories,
    includeWindow,
    observationEnabled,
    foregroundContext,
  }), [draft, foregroundContext, includeHistory, includeMemory, includeWindow, observationEnabled, recentHistory, retrievedMemories]);

  function prepareReview() {
    if (!draft.trim() || voiceBusy || handsFreeActive) return;
    setError("");
    setReviewRequest({
      message: draft.trim(),
      payload: payloadReview.payload,
      provider,
      model,
      historyCount: includeHistory ? recentHistory.filter((item) => item.role === "user").length : 0,
      memoryCount: includeMemory ? retrievedMemories.length : 0,
    });
    setReviewBudget(payloadReview.budget);
    setReviewMemoryIds(includeMemory ? selectReinforceableMemoryIds(retrievedMemories) : []);
    setReviewing(true);
  }

  async function runHybridPreview() {
    if (!desktopApp || provider !== "llamacpp" || !retrievalQuery.trim() || hybridCandidates.length < 3) return;
    setHybridPending(true);
    setReviewing(false);
    setError("");
    try {
      const preview = await onHybridRetrieve({ query: retrievalQuery, candidates: hybridCandidates });
      const validIds = new Set(hybridCandidates.map((candidate) => candidate.id));
      if (preview.persisted || preview.truthVerified || !preview.requiresOwnerReview
        || preview.matches.length !== 3
        || new Set(preview.matches.map((match) => match.id)).size !== 3
        || preview.matches.some((match) => !validIds.has(match.id))) {
        throw new Error("Gemma devolvió una previsualización que no cumple el contrato local de R8.3.");
      }
      setHybridPreview({ query: retrievalQuery, preview });
    } catch (cause) {
      setHybridPreview(null);
      setError(`No se pudo ampliar la búsqueda con Gemma: ${String(cause)}`);
    } finally {
      setHybridPending(false);
    }
  }

  async function previewConversationLearning(exchangeId: string) {
    if (!desktopApp || provider !== "llamacpp" || conversationLearningPending) return;
    setConversationLearningPending(exchangeId);
    setConversationLearningMessage("");
    setError("");
    try {
      const preview = await onPreviewConversationLearning(exchangeId);
      setConversationLearning(preview);
      setLearningImportance({});
      setConversationLearningMessage(preview.candidates.length
        ? "Propuesta lista: no se guardó nada. Revisá cada candidato antes de confirmar."
        : "Gemma no detectó información estable y explícita para proponer desde tu mensaje.");
    } catch (cause) {
      setConversationLearning(null);
      setError(`No se pudo revisar el intercambio para aprendizaje: ${String(cause)}`);
    } finally {
      setConversationLearningPending(null);
    }
  }

  async function confirmConversationLearning(candidate: ConversationLearningCandidate) {
    if (!conversationLearning || conversationLearningPending) return;
    if (!window.confirm(`¿Confirmás guardar este recuerdo para Alice?\n\n${candidate.intention}\n\nLa propuesta se basó sólo en tu mensaje; no en la respuesta de Alice.`)) return;
    setConversationLearningPending(candidate.candidateId);
    setConversationLearningMessage("");
    setError("");
    try {
      const result = await onConfirmConversationLearning(conversationLearning, candidate, {
        intention: candidate.intention,
        summary: candidate.summary,
        memoryType: candidate.memoryType,
        importance: learningImportance[candidate.candidateId] ?? 3,
      });
      setConversationLearning(null);
      setConversationLearningMessage(result.alreadyConfirmed
        ? "Ese recuerdo ya estaba confirmado; no se duplicó."
        : `Recuerdo confirmado y guardado localmente. Memoria actual: ${result.recordCount} registros.`);
    } catch (cause) {
      setError(`No se confirmó el recuerdo: ${String(cause)}`);
    } finally {
      setConversationLearningPending(null);
    }
  }

  async function previewVoiceOutput(exchangeId: string) {
    if (!desktopApp || voicePending) return;
    const generation = ++voiceOutputGenerationRef.current;
    setVoicePending("preview");
    setVoicePreview(null);
    voiceAudioRef.current?.pause();
    setVoiceAudio(null);
    setVoicePlaybackState("ready");
    setError("");
    try {
      const preview = await onPreviewVoiceOutput(exchangeId);
      if (generation === voiceOutputGenerationRef.current) setVoicePreview(preview);
      else void onCancelVoiceOutput(preview.requestId).catch(() => undefined);
    } catch (cause) {
      setError(`No se pudo preparar la voz: ${String(cause)}`);
    } finally {
      setVoicePending(null);
    }
  }

  async function cancelVoiceOutput() {
    if (!voicePreview || voicePending) return;
    setVoicePending("cancel");
    setError("");
    try {
      await onCancelVoiceOutput(voicePreview.requestId);
      setVoicePreview(null);
    } catch (cause) {
      setError(`No se pudo descartar la vista previa de voz: ${String(cause)}`);
    } finally {
      setVoicePending(null);
    }
  }

  async function confirmVoiceOutput() {
    if (!voicePreview || !voicePreview.canConfirm || voicePending) return;
    const generation = ++voiceOutputGenerationRef.current;
    setVoicePending("confirm");
    setError("");
    try {
      const audio = await onConfirmVoiceOutput(voicePreview.requestId);
      if (generation !== voiceOutputGenerationRef.current) return;
      setVoiceAudio(audio);
      setVoicePlaybackState("ready");
      setVoicePreview(null);
    } catch (cause) {
      setError(`No se pudo generar la voz: ${String(cause)}`);
      setVoicePreview(null);
    } finally {
      setVoicePending(null);
    }
  }

  function stopVoiceCapture(discard = false) {
    if (!discard) {
      voiceCaptureRef.current?.finish();
      return;
    }
    voiceOperationGenerationRef.current += 1;
    voiceCaptureRef.current?.cancel();
    voiceTakeRef.current = null;
    setVoiceRecordedSeconds(null);
    setVoiceTranscriptDurationMs(null);
    setVoiceTranscriptModel(null);
    setVoiceCaptureState("idle");
    setVoiceInputMessage("Toma descartada. El micrófono está apagado.");
  }

  async function startVoiceCapture() {
    if (!desktopApp || voiceBusy || sending || voicePending) return;
    const previousTake = voiceTakeRef.current;
    const generation = ++voiceOperationGenerationRef.current;
    const draftBeforeCapture = draft;
    let recordingStarted = false;
    discardVoiceAudio();
    setVoicePreview(null);
    setReviewing(false);
    setError("");
    setVoiceInputMessage("Preparando Gemma local antes de abrir el micrófono…");
    setVoiceCaptureState("requesting");
    setVoiceRecordedSeconds(null);
    setVoiceTranscriptDurationMs(null);
    setVoiceTranscriptModel(null);
    try {
      await onPrepareVoiceTurn();
      if (generation !== voiceOperationGenerationRef.current) return;
      setVoiceInputMessage("Preparando micrófono y filtro de ruido…");
      const capture = new VoiceCapture({
        onStarted: () => {
          if (generation !== voiceOperationGenerationRef.current) return;
          recordingStarted = true;
          voiceTakeRef.current = null;
          setVoiceRecordedSeconds(null);
          setVoiceElapsedSeconds(0);
          setVoiceCaptureState("recording");
          setVoiceInputMessage("Te escucho. Puedes hacer pausas: esta toma no termina por silencio. Al terminar, pulsa Terminé de hablar y transcribir. Máximo: 60 segundos.");
        },
        onElapsed: setVoiceElapsedSeconds,
        onProcessed: setNoiseStatus,
        onRecorded: (take, seconds, transcribe) => {
          if (generation !== voiceOperationGenerationRef.current) return;
          voiceTakeRef.current = take;
          setVoiceRecordedSeconds(seconds);
          setVoiceCaptureState("recorded");
          setVoiceInputMessage("Micrófono apagado. La toma está lista para transcribir localmente.");
          if (transcribe) void transcribeVoiceCapture(take, generation, draftBeforeCapture);
        },
        onError: message => {
          if (generation !== voiceOperationGenerationRef.current) return;
          voiceTakeRef.current = recordingStarted ? null : previousTake;
          setVoiceCaptureState(voiceTakeRef.current ? "recorded" : "idle");
          setVoiceInputMessage(message);
        },
      }, undefined, false, { deviceId: microphoneId, sensitivity: microphoneSensitivity });
      voiceCaptureRef.current = capture;
      await capture.start();
    } catch (cause) {
      if (generation !== voiceOperationGenerationRef.current) return;
      setVoiceCaptureState(previousTake ? "recorded" : "idle");
      setVoiceInputMessage(`No se abrió el micrófono: ${String(cause)}`);
    }
  }

  async function transcribeVoiceCapture(takeOverride?: Blob, generation = voiceOperationGenerationRef.current, draftBeforeCapture = draft) {
    const take = takeOverride ?? voiceTakeRef.current;
    if (!take || (!takeOverride && voiceCaptureState !== "recorded")) return;
    setVoiceCaptureState("transcribing");
    setVoiceTranscriptDurationMs(null);
    setVoiceTranscriptModel(null);
    setVoiceInputMessage("Transcribiendo tu voz localmente. Todavía no se envía nada al chat.");
    setError("");
    try {
      const audioBase64 = bytesToBase64(new Uint8Array(await take.arrayBuffer()));
      if (generation !== voiceOperationGenerationRef.current) return;
      const result = await onTranscribeVoiceTurn(audioBase64, take.type || "audio/webm");
      if (generation !== voiceOperationGenerationRef.current) return;
      voiceTakeRef.current = null;
      setVoiceTranscriptDurationMs(result.durationMs);
      setVoiceTranscriptModel(result.model);
      if (result.noSpeech) {
        setVoiceCaptureState("idle");
        setVoiceInputMessage("No se detectó habla inteligible. Probá otra toma hablando cerca del micrófono.");
      } else {
        onDraftChange([draftBeforeCapture.trim(), result.text].filter(Boolean).join("\n"));
        setVoiceCaptureState("review");
        setVoiceInputMessage("Revisá lo que entendí en el mensaje y pulsá Revisar mensaje. Tu respuesta tendrá una vista previa de voz para autorizarla.");
      }
    } catch (cause) {
      if (generation !== voiceOperationGenerationRef.current) return;
      setVoiceCaptureState("recorded");
      setVoiceInputMessage(`No se completó la transcripción: ${String(cause)} Podés reintentar o descartar la toma.`);
    }
  }

  function closeVoiceMode() {
    stopVoiceCapture(true);
    voiceOutputGenerationRef.current += 1;
    if (voicePreview && !voicePending) void onCancelVoiceOutput(voicePreview.requestId).catch(() => undefined);
    setVoicePreview(null);
    discardVoiceAudio();
    setVoiceModeOpen(false);
    setVoiceInputMessage("El micrófono está apagado. Nada se graba ni se envía.");
  }

  function discardVoiceAudio() {
    voiceAudioRef.current?.pause();
    if (voiceAudioRef.current) voiceAudioRef.current.currentTime = 0;
    setVoiceAudio(null);
    setVoicePlaybackState("ready");
  }

  async function processSpokenTurn(text: string, sessionId: string) {
    const history = (includeHistory ? messages : messages.filter(item => !voiceHistoryBaseline.current.has(item.id))).slice(-10);
    const matches = includeMemory ? retrieveMemories(buildRetrievalQuery(text, history), memories, 3).map(match => match.memory) : [];
    const review = buildCloudPayloadReview({ draft: text, includeHistory: history.length > 0, includeAssistantDialogue: true,
      recentHistory: history, includeMemory, memories: matches, includeWindow: false, observationEnabled: false, foregroundContext: null });
    onMemoryRetrieval({count: matches.length, top:matches[0]?.intention ?? "", ids:matches.flatMap(memory => memory.id ? [memory.id] : [])});
    setSending(true);
    setError("");
    try {
      const response = await onSend({ message: text, payload: review.payload, provider: "llamacpp",
        model: "gemma-4-E2B-it-Q4_K_M", voiceSessionId: sessionId,
        historyCount: history.filter(item => item.role === "user").length, memoryCount: matches.length }, []);
      const exchangeId = response.conversationHistory?.exchanges.find(item => item.responseId === response.responseId)?.exchangeId;
      if (!exchangeId) throw Error("La respuesta llegó, pero no pudo guardarse el historial para darle voz.");
      return { exchangeId };
    } finally { setSending(false); }
  }

  async function authorizeAndSend() {
    if (!reviewRequest) return;
    if (!reviewUsesCurrentRoute(reviewRequest, provider, model)) {
      setReviewing(false);
      setReviewRequest(null);
      setReviewBudget(null);
      setReviewMemoryIds([]);
      setError("Cambió el motor seleccionado. Revisá nuevamente el contexto antes de procesarlo.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await onSend(reviewRequest, reviewMemoryIds);
      if (reviewMemoryIds.length) setPendingRetrievals((current) => [...current, ...reviewMemoryIds.map((recordId) => ({ key: `${response.responseId}:${recordId}:${crypto.randomUUID()}`, recordId }))]);
      if (response.workingMemoryError) setError(`La respuesta llegó, pero la memoria de trabajo informó: ${response.workingMemoryError}`);
      if (response.conversationHistoryError) setError(`La respuesta llegó, pero el historial local no pudo guardarse: ${response.conversationHistoryError}`);
      onDraftChange("");
      setHybridPreview(null);
      setReviewing(false);
      setReviewBudget(null);
      setReviewMemoryIds([]);
      if (voiceModeOpen) {
        setVoiceCaptureState("idle");
        const exchangeId = response.conversationHistory?.exchanges.find(item => item.responseId === response.responseId)?.exchangeId;
        if (exchangeId) await previewVoiceOutput(exchangeId);
        else setVoiceInputMessage("La respuesta está en el chat, pero no se pudo verificar su historial para preparar la voz.");
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSending(false);
    }
  }

  async function recordRetrievalOutcome(key: string, recordId: string, outcome: RetrievalOutcome) {
    setRetrievalFeedbackPending(key);
    setError("");
    try {
      await onRetrievalOutcome(recordId, outcome);
      setPendingRetrievals((current) => current.filter((item) => item.key !== key));
    } catch (cause) {
      setError(`No se guardó la evaluación del recuerdo: ${String(cause)}`);
    } finally {
      setRetrievalFeedbackPending(null);
    }
  }

  return <section className={`conversation-page ${embedded ? "embedded" : ""}`} aria-labelledby={embedded ? undefined : "conversation-title"} aria-label={embedded ? "Conversación real con Alice" : undefined}>
    {!embedded && <div className="conversation-heading">
      <div><p className="eyebrow">CANAL AUTORIZADO · CONVERSACIÓN</p><h2 id="conversation-title">Conversación con Alice</h2><p>Escribí normalmente. Antes de procesarse localmente o salir de tu computadora, el contenido pasa por una revisión visible y requiere tu autorización.</p></div>
      <div className={`cloud-status ${configuredCount ? "ready" : "offline"}`}><i />{configuredCount ? `${configuredCount} PROVEEDOR${configuredCount > 1 ? "ES" : ""} DISPONIBLE${configuredCount > 1 ? "S" : ""}` : "SIN PROVEEDOR LISTO"}</div>
    </div>}

    <div className={`conversation-status is-${turnStatus.tone}`} role="status" aria-live="polite">
      <i aria-hidden="true" /><strong>{turnStatus.label}</strong><span>{selectedProvider?.label ?? "Selecciona un modelo en Configuración"}</span>
    </div>

    {visionPanel}
    {desktopApp && provider === "llamacpp" && <p className="conversation-delegated-actions">Acciones autorizadas: Spotify · Tus me gusta · playlist configurada en Windows · YouTube en Chrome · discos D: y E: en Windows. Pide «abre Spotify y reproduce la playlist [nombre]», «pausa Spotify» o «reproduce [canción] en YouTube».</p>}
    <div className="conversation-layout conversation-layout-focused">
      <div className="chat-column">
        <div className={`message-stream ${messages.length ? "has-messages" : "is-empty"}`} aria-live="polite" ref={messageStreamRef}>
          {messages.length === 0 ? <div className="chat-empty"><span>A</span><h3>Estoy lista para conversar.</h3><p>Puedes escribir una pregunta o comenzar un turno de voz.</p></div> : visibleMessages.map((item) => <article key={item.id} className={`chat-message ${item.role}`}><div className="message-author">{item.role === "user" ? "CARLOS NUÑEZ" : "ALICE"}<small>{messageTime(item.createdAt)}</small></div><p>{item.text}</p>{item.model && <span className="message-model">{item.model}</span>}{item.role === "assistant" && item.exchangeId === newestExchangeId && <div className="conversation-message-actions"><div className="conversation-voice-trigger"><button type="button" className="secondary" onClick={() => void previewVoiceOutput(item.exchangeId!)} disabled={!desktopApp || handsFreeActive || voiceBusy || sending || Boolean(voicePending)}>{voicePending === "preview" ? "Preparando voz…" : "Escuchar con la voz de Alice"}</button><small>Manual · revisás el texto antes de enviar una copia a Fish Audio.</small></div><div className="conversation-learning-trigger"><button type="button" className="secondary" onClick={() => void previewConversationLearning(item.exchangeId!)} disabled={!desktopApp || provider !== "llamacpp" || Boolean(conversationLearningPending)}>{conversationLearningPending === item.exchangeId ? "Revisando tu mensaje…" : "Proponer recuerdo de este intercambio"}</button><small>Manual · sólo analiza tu mensaje, nunca esta respuesta.</small></div></div>}</article>)}
        </div>
        {voicePreview && <section ref={voiceOutputPanelRef} tabIndex={-1} className="voice-output-review" aria-live="polite"><header><div><strong>VOZ DE ALICE · REVISIÓN EXPLÍCITA</strong><span>Fish Audio · {voicePreview.model} · audio temporal</span></div><button type="button" className="secondary" onClick={() => void cancelVoiceOutput()} disabled={Boolean(voicePending)}>{voicePending === "cancel" ? "Descartando…" : "Cancelar"}</button></header><div className="voice-output-meta"><span>{voicePreview.characterCount}/{voicePreview.characterLimit} caracteres</span><span>SHA-256 registrado sin texto</span><span>Sin memoria · sin archivo</span></div><details open><summary>Texto exacto que se enviará</summary><p>{voicePreview.spokenText}</p></details>{voicePreview.canConfirm ? <footer><small>Al confirmar, se enviará únicamente este texto al proveedor. El aviso de verificación permanece en el chat y no se pronuncia. Cancelar ahora no envía nada.</small><button type="button" className="primary" onClick={() => void confirmVoiceOutput()} disabled={Boolean(voicePending)}>{voicePending === "confirm" ? "Generando audio…" : "Autorizar y generar audio temporal"}</button></footer> : <p className="voice-output-warning">{voicePreview.configuration === "missingApiKey" ? "Falta FISH_API_KEY en el proceso de Alice. Cerrá y abrí Alice después de configurarla." : "Falta ALICE_FISH_REFERENCE_ID: la identidad de voz debe configurarse localmente, fuera del repositorio."}</p>}</section>}
        {voiceAudio && <section ref={voiceOutputPanelRef} tabIndex={-1} className="voice-output-player" aria-live="polite"><header><div><strong>{voicePlaybackState === "playing" ? "ALICE ESTÁ HABLANDO" : voicePlaybackState === "paused" ? "VOZ DE ALICE EN PAUSA" : "AUDIO TEMPORAL LISTO"}</strong><span>{voiceAudio.characterCount} caracteres · generado en {(voiceAudio.durationMs / 1000).toFixed(1)} s · sin archivo ni recuerdo</span></div><button type="button" className="secondary" onClick={discardVoiceAudio}>Detener y descartar</button></header><audio ref={voiceAudioRef} controls autoPlay onPlay={() => setVoicePlaybackState("playing")} onPause={() => setVoicePlaybackState("paused")} onEnded={discardVoiceAudio} onError={() => { setError("El audio temporal no pudo reproducirse y fue descartado."); discardVoiceAudio(); }} src={`data:${voiceAudio.mimeType};base64,${voiceAudio.audioBase64}`}>Tu navegador no puede reproducir este audio temporal.</audio><small>Al terminar la reproducción, el audio se elimina automáticamente de la interfaz.</small></section>}
        {(conversationLearning || conversationLearningMessage) && <section className="conversation-learning-review" aria-live="polite"><header><div><strong>PROPUESTA DE RECUERDO · REVISIÓN HUMANA</strong><span>Gemma local · tu mensaje es la única evidencia</span></div><button type="button" className="secondary" onClick={() => { setConversationLearning(null); setConversationLearningMessage(""); }} disabled={Boolean(conversationLearningPending)}>Cerrar</button></header>{conversationLearning?.candidates.map((candidate) => <article key={candidate.candidateId}><div><strong>{candidate.intention}</strong><span>{conversationMemoryTypeLabels[candidate.memoryType]} · {Math.round(candidate.confidence * 100)}%</span></div><p>{candidate.summary}</p><blockquote><span>EVIDENCIA LITERAL DE TU MENSAJE</span>{candidate.evidence}</blockquote>{!!candidate.affects?.length && <div className="learning-emotions"><strong>Interpretación emocional de tu mensaje · revisá antes de guardar</strong>{candidate.affects.map(item => { const channel = affectPalette.find(candidateChannel => candidateChannel.id === item.emotion); return <p key={item.emotion}><span><i style={{ backgroundColor: channel?.color }} />{channel?.label ?? item.emotion} · intensidad {Math.round(item.intensity * 100)}%</span><q>{item.evidence}</q></p>; })}<small>Confirmar el recuerdo conserva también esta interpretación. No es el estado emocional actual de Alice.</small></div>}<label className="learning-importance">Importancia del recuerdo<select value={learningImportance[candidate.candidateId] ?? 3} disabled={Boolean(conversationLearningPending)} onChange={event => setLearningImportance(current => ({ ...current, [candidate.candidateId]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5 · {["Baja", "Menor", "Media", "Alta", "Muy alta"][value - 1]}</option>)}</select><small>Elegí cuánto importa conservarlo. La confianza de Gemma no mide impacto emocional.</small></label><footer><small>Similitud y extracción no verifican verdad. Confirmar es tu decisión.</small><button type="button" className="primary" onClick={() => void confirmConversationLearning(candidate)} disabled={Boolean(conversationLearningPending)}>{conversationLearningPending === candidate.candidateId ? "Confirmando…" : "Confirmar recuerdo"}</button></footer></article>)}{conversationLearning && conversationLearning.candidates.length === 0 && <p className="retrieval-empty">No hay propuesta. El intercambio sigue sólo en el historial local.</p>}{conversationLearningMessage && <p className="memory-operation-message" role="status">{conversationLearningMessage}</p>}</section>}
        {pendingRetrievals.length > 0 && <section className="retrieval-outcome-review" aria-label="Evaluación real de recuerdos recuperados"><header><div><strong>R6.5-F · RESULTADO DE RECUPERACIÓN</strong><span>Confirmación humana · no modifica fuerza ni reposo</span></div><em>{pendingRetrievals.length} pendiente{pendingRetrievals.length === 1 ? "" : "s"}</em></header>{pendingRetrievals.map(({ key, recordId }) => { const memory = memories.find((item) => item.id === recordId); return <article key={key}><div><span>¿ESTE RECUERDO AYUDÓ?</span><strong>{memory?.intention ?? recordId}</strong></div><div><button type="button" className="secondary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "not-helpful")}>No ayudó</button><button type="button" className="primary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "helpful")}>Sí, fue útil</button></div></article>; })}</section>}
        {error && !reviewing && <p className="cloud-error" role="alert">{error}</p>}
        <div className="composer">
          {automaticLearning && <div className="conversation-learning-status"><span><i />{automaticLearning.phase === "evaluating" ? "Alice está evaluando qué recordar…" : automaticLearning.phase === "error" ? "No pudo evaluar este turno · revisa Memoria" : automaticLearning.enabled ? provider !== "llamacpp" ? `Aprendizaje preparado · usa Gemma local · ${automaticLearning.count} recuerdos` : `Aprendizaje automático activo · ${automaticLearning.count} recuerdos` : "Aprendizaje automático pausado"}</span><button type="button" onClick={automaticLearning.onOpen}>Ver memoria</button></div>}
          <label htmlFor="alice-message">Tu mensaje</label>
          <div className="voice-turn automatic-voice-entry">
            <HandsFreeVoice desktopApp={desktopApp} disabled={voiceBusy || sending || Boolean(voicePending)}
              microphone={{ deviceId: microphoneId, sensitivity: microphoneSensitivity }} onProcessed={setNoiseStatus}
              onStart={async () => { closeVoiceMode(); setReviewing(false); voiceHistoryBaseline.current = new Set(messages.map(item => item.id)); return onStartVoiceSession(); }} onStop={onStopVoiceSession}
              onTranscribe={onTranscribeVoiceTurn} onTurn={processSpokenTurn} onSpeak={onSpeakVoiceSession}
              onActiveChange={(_active, state) => setHandsFreeState(state)} />
            <AudioInputSettings disabled={!desktopApp || handsFreeActive || voiceBusy} deviceId={microphoneId} onDeviceChange={setMicrophoneId} sensitivity={microphoneSensitivity} onSensitivityChange={setMicrophoneSensitivity} status={noiseStatus} />
            {!handsFreeActive && <details className="manual-voice-options"><summary>Dictado con revisión manual</summary>
          <div className={`voice-turn ${voiceModeOpen ? "open" : ""}`}>
            <button type="button" className="voice-turn-toggle" aria-expanded={voiceModeOpen} onClick={() => voiceModeOpen ? closeVoiceMode() : setVoiceModeOpen(true)} disabled={!desktopApp || sending}>{voiceModeOpen ? "Cerrar conversación por voz" : "Hablar con Alice"}<span>{voiceCaptureState === "recording" ? `REC ${voiceElapsedSeconds}s` : "MIC APAGADO"}</span></button>
            {voiceModeOpen && <div className="voice-turn-panel" aria-live="polite"><header><div><strong>CONVERSACIÓN POR VOZ · GEMMA 4</strong><span>{voiceCaptureState === "recording" ? `GRABANDO · ${voiceElapsedSeconds}/60 s` : voiceCaptureState === "transcribing" ? "TRANSCRIPCIÓN LOCAL" : "MICRÓFONO APAGADO"}</span></div><i className={voiceCaptureState === "recording" ? "active" : ""} /></header><p>{voiceInputMessage}</p><VoiceTurnMeasurements recordedSeconds={voiceRecordedSeconds} transcriptionMs={voiceTranscriptDurationMs} model={voiceTranscriptModel} state={voiceCaptureState} /><div className="voice-turn-actions">{voiceCaptureState !== "recording" && <button type="button" className="secondary" onClick={() => void startVoiceCapture()} disabled={voiceBusy || sending || Boolean(voicePending)}>{voiceCaptureState === "requesting" ? "Preparando micrófono…" : voiceCaptureState === "recorded" ? "Grabar otra toma" : "Empezar a hablar"}</button>}{voiceCaptureState === "recording" && <button type="button" className="primary" onClick={() => stopVoiceCapture(false)}>Terminé de hablar y transcribir</button>}{voiceCaptureState === "recorded" && <button type="button" className="primary" onClick={() => void transcribeVoiceCapture()}>Transcribir localmente</button>}{(voiceBusy || voiceCaptureState === "recorded") && <button type="button" className="secondary danger" onClick={() => stopVoiceCapture(true)}>Descartar toma</button>}</div><small>Al iniciar se prepara Gemma y se solicita el micrófono. Al terminar se transcribe localmente; revisás el mensaje antes de enviarlo. Fish recibe sólo la respuesta que autorices escuchar.</small></div>}
          </div>
            </details>}
          </div>
          <textarea id="alice-message" disabled={voiceBusy || sending || handsFreeActive} value={draft} onChange={(event) => { onDraftChange(event.target.value); setReviewing(false); setHybridPreview(null); }} placeholder="Preguntá, explicá una idea o pedí ayuda…" />
          <div className="composer-footer"><span>{localInference ? "Revisa el contexto del mensaje. Las vistas activas toman una imagen al procesarlo." : "Primero verás exactamente qué datos saldrán de tu PC."}</span><button className="primary" title="Abre la previsualización de privacidad; todavía no procesa el mensaje" onClick={prepareReview} disabled={!draft.trim() || sending || voiceBusy || handsFreeActive}>{localInference ? "Revisar mensaje" : "Ver qué se enviará"} <span>→</span></button></div>
        </div>
      </div>

      <details className="conversation-context-drawer">
        <summary>Contexto y permisos <span>{includeHistory ? "Historial activo" : "Sin historial"} · {includeMemory ? "Recuerdos activos" : "Sin recuerdos"} · {includeWindow && observationEnabled && foregroundContext ? "Ventana incluida" : "Sin ventana"}</span></summary>
        <aside className="cloud-control">
        <p className="eyebrow">CONTROL DE CONTEXTO</p>
        <h3>{localInference ? "Qué puede procesar" : "Qué puede salir"}</h3>
        <div className="context-section-label"><strong>{localInference ? "CONTEXTO LOCAL AUTORIZADO" : "SALIDA A LA NUBE"}</strong><span>FUENTES SELECCIONADAS · DATOS REALES</span></div>
        <label className={`context-toggle ${recentHistory.length ? "available" : "waiting"}`}><input type="checkbox" disabled={handsFreeActive} checked={includeHistory} onChange={(event) => { setIncludeHistory(event.target.checked); setReviewing(false); }} /><span><strong>Historial reciente</strong><small>{recentHistory.length ? `${recentHistory.filter((item) => item.role === "user").length} mensajes tuyos disponibles · respuestas previas de Alice no se reutilizan como hechos` : "seleccionado · todavía no hay mensajes guardados"}</small></span></label>
        <label className={`context-toggle ${draft.trim() ? "available" : "waiting"}`}><input type="checkbox" disabled={handsFreeActive} checked={includeMemory} onChange={(event) => { setIncludeMemory(event.target.checked); setReviewing(false); }} /><span><strong>{localInference ? "RAG local de recuerdos" : "Recuerdos relevantes"}</strong><small>{draft.trim() ? `${memoryMatches.length} coincidencias de ${memories.length} recuerdos · ${dormantMemoryCount} en reposo · ${suppressedMemoryCount} suprimidos` : "seleccionado · espera un mensaje para buscar"}</small></span></label>
        {draft.trim() && memoryMatches.length > 0 && !includeMemory && <p className="memory-authorization-warning" role="status">Alice encontró {memoryMatches.length} recuerdos, pero no se {localInference ? "procesarán" : "enviarán"} mientras esta casilla siga desmarcada.</p>}
        {draft.trim() && <div className={`memory-retrieval-preview ${hybridActive ? "hybrid" : ""}`} aria-live="polite"><div><strong>RECUPERACIÓN LOCAL</strong><span>{hybridActive ? "GEMMA · TOP 3 · REVISABLE" : "LEXICAL · MÁX. 3 · REPOSO Y SUPRESIÓN EXCLUIDOS"}</span></div>{memoryMatches.length ? memoryMatches.map((match) => <article key={match.memory.id ?? `${match.memory.intention}-${match.score}`}><header><strong>{match.memory.intention}</strong><span>{"rank" in match ? `#${match.rank}` : match.score.toFixed(3)}</span></header><p>{match.reason}</p></article>) : <p className="retrieval-empty">No hay recuerdos accesibles relacionados. No se adjuntará memoria.</p>}{desktopApp && provider === "llamacpp" && hybridCandidates.length >= 3 && <footer className="hybrid-retrieval-control"><button type="button" className="hybrid-retrieval-action" onClick={() => void runHybridPreview()} disabled={hybridPending || sending}>{hybridPending ? "Gemma está revisando…" : hybridActive ? "Revisar otra vez con Gemma" : "Ampliar con Gemma"}</button><small>Acción manual · compara hasta {hybridCandidates.length} recuerdos · no guarda ni confirma contenido</small>{hybridActive && hybridPreview && <em>{hybridPreview.preview.elapsedMs.toLocaleString("es-PY")} ms · requiere tu revisión</em>}</footer>}</div>}
        <label className={`context-toggle ${foregroundContext ? "available" : "waiting"}`}><input type="checkbox" checked={includeWindow} disabled={!observationEnabled || !foregroundContext} onChange={(event) => { setIncludeWindow(event.target.checked); setReviewing(false); }} /><span><strong>Ventana actual</strong><small>{foregroundContext ? `${foregroundContext.processName} · metadatos disponibles` : "no seleccionable · observador sin contexto"}</small></span></label>
        <div className={`conversation-observer-state ${observationEnabled ? "active" : ""}`}><i /><span><strong>{observationEnabled ? "OBSERVADOR LOCAL ACTIVO" : "OBSERVADOR LOCAL INACTIVO"}</strong><small>{observationEnabled ? localInference ? "Hay metadatos locales. Sólo se procesarán al marcar Ventana actual y autorizar." : "Hay metadatos locales. Sólo saldrán al marcar Ventana actual y autorizar." : "No está autorizado ni está capturando metadatos de la ventana."}</small></span></div>
        {desktopApp && <button type="button" className={observationEnabled ? "console-button observing" : "console-button"} onClick={onToggleObservation}>{observationEnabled ? "Administrar observador en Gateway" : "Configurar observador en Gateway"}</button>}
        <p className="context-sensor-boundary">El observador aporta metadatos. Para imágenes de cámara y escritorio usa Vista de Alice; se procesan con Gemma mientras la vista está activa.</p>
        <div className="context-section-label local"><strong>CONTINUIDAD LOCAL</strong><span>HISTORIAL + RAM</span></div>
        <div className="conversation-working-memory"><i /><span><strong>CONVERSACIÓN GUARDADA LOCALMENTE</strong><small>Cada intercambio exitoso se conserva para continuar después de reiniciar. También entra en la RAM inmediata, pero no se convierte automáticamente en recuerdo ni en hecho confirmado.</small></span></div>
        <div className="conversation-route"><strong>MOTOR SELECCIONADO · SIN HERRAMIENTAS</strong><span>{selectedProvider?.label ?? provider}</span><small>{model || "modelo sin configurar"}</small></div>
        <div className="cloud-rule"><strong>{localInference ? "POLÍTICA DE INFERENCIA" : "POLÍTICA DE ENVÍO"}</strong><span>{selectedProvider?.protocol ?? "adaptador nativo"} · {selectedProvider?.retentionMode ?? "retención según proveedor"} · {localInference ? "contexto 4096 · máximo 900 tokens de salida" : "máximo 1200 tokens de salida"} · sin herramientas · previsualización obligatoria</span></div>
        <button type="button" className="conversation-settings-link" onClick={onOpenSettings}>Cambiar proveedor o modelo en Configuración</button>
      </aside>
      </details>
    </div>

    {reviewing && <div className="send-review" ref={reviewRef} tabIndex={-1}>
      <div className="review-heading"><div><p className="eyebrow">PREVISUALIZACIÓN OBLIGATORIA</p><h3>{localReview ? "Esto se procesará localmente con" : "Esto se enviará a"} {status.providers.find((option) => option.id === reviewRequest?.provider)?.label ?? reviewRequest?.provider}</h3></div><span>{reviewRequest?.model}</span></div>
      <div className="payload-budget" aria-label="Presupuesto del texto autorizado">
        <header><strong>{localReview ? "PRESUPUESTO DE CONTEXTO LOCAL" : "PRESUPUESTO DE SALIDA"}</strong><span>CARACTERES · BYTES UTF-8</span></header>
        {reviewBudget?.fragments.map((item) => <div key={item.id} className={item.included ? "included" : "excluded"}><span>{item.label}{item.optional ? " · opcional" : ""}</span><strong>{item.characters.toLocaleString("es-PY")}</strong><em>{item.utf8Bytes.toLocaleString("es-PY")} B</em><small>{item.included ? "INCLUIDO" : "NO AUTORIZADO"}</small></div>)}
        <div className="separators"><span>Separadores de secciones</span><strong>{reviewBudget?.separatorCharacters.toLocaleString("es-PY") ?? 0}</strong><em>{reviewBudget?.separatorUtf8Bytes.toLocaleString("es-PY") ?? 0} B</em><small>FORMATO</small></div>
        <footer><span>TOTAL DEL TEXTO REVISADO</span><strong>{reviewBudget?.totalCharacters.toLocaleString("es-PY") ?? 0} caracteres</strong><em>{reviewBudget?.totalUtf8Bytes.toLocaleString("es-PY") ?? 0} bytes UTF-8</em></footer>
      </div>
      {localReview && <p className="review-note">Con Vista de Alice activa se agregan imágenes recientes al procesar. Gemma recibe hasta 700 caracteres finales de las referencias y el mensaje actual completo (hasta 1600 caracteres). El presupuesto de arriba corresponde sólo al texto revisado antes de ese ajuste.</p>}
      <details className="payload-detail">
        <summary>Ver texto exacto autorizado</summary>
        <p>El resumen de arriba ya indica qué fuentes se incluirán. Abrí este detalle sólo si querés revisar el contenido literal antes de enviarlo.</p>
        <pre>{reviewRequest?.payload}</pre>
      </details>
      <p className="review-note">Además se incluye una política breve: responder en español, no afirmar acciones no realizadas y pedir aprobación antes de acciones externas o costosas. Si la respuesta llega, el intercambio se guardará en el historial local de Alice sin promoverlo automáticamente a recuerdo.</p>
      {!desktopApp && <p className="cloud-error">La inferencia sólo funciona desde la aplicación de escritorio.</p>}
      {desktopApp && !selectedProvider?.configured && <p className="cloud-error">{localInference ? "Ollama local no está iniciado. Abrí Alice mediante Iniciar Alice Continuum.cmd." : "Este proveedor todavía no tiene sus variables de entorno configuradas. Alice no puede enviar la consulta."}</p>}
      {error && <p className="cloud-error">{error}</p>}
      <div className="review-actions"><button className="secondary" onClick={() => setReviewing(false)} disabled={sending}>Volver a editar</button><button className="primary" onClick={authorizeAndSend} disabled={sending || !reviewRequest || !desktopApp || !selectedProvider?.configured || !reviewRequest?.model.trim()}>{sending ? "Consultando…" : localInference ? "Autorizar y procesar localmente" : "Autorizar y enviar a la nube"}</button></div>
    </div>}
  </section>;
}
