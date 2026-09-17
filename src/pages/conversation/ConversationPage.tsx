import { useEffect, useMemo, useRef, useState } from "react";
import { buildRetrievalQuery, retrieveMemories } from "../../core/memory/memory-retrieval";
import { buildCloudPayloadReview, type CloudPayloadBudget } from "../../core/conversation/cloud-payload";
import { selectReinforceableMemoryIds } from "../../core/memory/memory-consolidation";
import type { RetrievalOutcome } from "../../core/memory/memory-consolidation";
import type { WorkingMemorySnapshot } from "../../core/memory/working-memory";
import type { ConversationHistorySnapshot } from "../../core/conversation/conversation-history";
import type { ConversationLearningApproval, ConversationLearningCandidate, ConversationLearningPreview } from "../../core/conversation/conversation-learning";
import type { VoiceOutputPreview, VoiceOutputResult } from "../../core/voice/voice-output";
import { bytesToBase64 } from "../../core/voice/voice-input";
import type { VoiceTurnTranscript } from "../../core/voice/voice-input";
import { affectPalette } from "../../core/cognitive/affect";
import "../../styles/conversation-context.css";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  model?: string;
  exchangeId?: string;
};

export type CloudStatus = {
  providers: CloudProvider[];
};

export type CloudProvider = { id: string; label: string; configured: boolean; defaultModel: string; protocol: string; retentionMode: string };

const conversationMemoryTypeLabels: Record<ConversationLearningCandidate["memoryType"], string> = {
  semantic: "SEMÁNTICA",
  preference: "PREFERENCIA",
  episodic: "EPISÓDICA",
};

const INITIAL_VISIBLE_MESSAGES = 12;
const HISTORY_PAGE_MESSAGES = 10;

export type CloudRequest = {
  message: string;
  payload: string;
  provider: string;
  model: string;
  historyCount: number;
  memoryCount: number;
};

export type CloudResponse = {
  text: string;
  provider: string;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  workingMemory: WorkingMemorySnapshot | null;
  workingMemoryError: string | null;
  conversationHistory: ConversationHistorySnapshot | null;
  conversationHistoryError: string | null;
};

export type HybridRetrievalCandidate = { id: string; text: string };

export type HybridRetrievalRequest = {
  query: string;
  candidates: HybridRetrievalCandidate[];
};

export type HybridRetrievalPreview = {
  matches: { id: string; rank: number; reason: string }[];
  model: string;
  elapsedMs: number;
  persisted: boolean;
  truthVerified: boolean;
  requiresOwnerReview: boolean;
};

type MemoryExcerpt = { id?: string; kind?: string; intention: string; summary?: string; nextStep?: string; finishedAt?: string; memoryType?: "semantic" | "procedural" | "preference" | "episodic"; source?: string; memoryStatus?: "confirmed" | "conflict" | "archived"; accessibilityStatus?: "accessible" | "dormant"; suppressionStatus?: "suppressed"; archiveStatus?: "archived"; deletionStatus?: "scheduled" };

type ConversacionProps = {
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
  onTranscribeVoiceTurn: (audioBase64: string, mimeType: string) => Promise<VoiceTurnTranscript>;
  onOpenSettings: () => void;
  onSend: (request: CloudRequest, recalledMemoryIds: string[]) => Promise<CloudResponse>;
  onRetrievalOutcome: (recordId: string, outcome: RetrievalOutcome) => Promise<void>;
};

export function reviewUsesCurrentRoute(request: Pick<CloudRequest, "provider" | "model"> | null, provider: string, model: string) {
  return request !== null && request.provider === provider && request.model === model;
}

export function buildHybridRetrievalCandidates(memories: MemoryExcerpt[], limit = 24): HybridRetrievalCandidate[] {
  return memories
    .filter((memory) => Boolean(memory.id)
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

export function Conversacion({ embedded = false, desktopApp, draft, status, provider, model, messages, memories, observationEnabled, foregroundContext, onToggleObservation, onDraftChange, onMemoryRetrieval, onHybridRetrieve, onPreviewConversationLearning, onConfirmConversationLearning, onPreviewVoiceOutput, onConfirmVoiceOutput, onCancelVoiceOutput, onTranscribeVoiceTurn, onOpenSettings, onSend, onRetrievalOutcome }: ConversacionProps) {
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
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
  const [voiceInputMessage, setVoiceInputMessage] = useState("El micrófono está apagado. Nada se graba ni se envía.");
  const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState(0);
  const [voiceRecordedSeconds, setVoiceRecordedSeconds] = useState<number | null>(null);
  const [voiceTranscriptDurationMs, setVoiceTranscriptDurationMs] = useState<number | null>(null);
  const [voicePlaybackState, setVoicePlaybackState] = useState<"ready" | "playing" | "paused">("ready");
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(INITIAL_VISIBLE_MESSAGES);
  const [error, setError] = useState("");
  const reviewRef = useRef<HTMLDivElement>(null);
  const messageStreamRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTakeRef = useRef<Blob | null>(null);
  const voiceDiscardRef = useRef(false);
  const voiceOperationGenerationRef = useRef(0);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceStartedAtRef = useRef(0);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);

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
  const voiceMessage = voicePreview ? messages.find((item) => item.role === "assistant" && item.exchangeId === voicePreview.exchangeId) : null;
  const visibleMessages = visibleConversationMessages(messages, visibleMessageLimit);
  const hiddenMessageCount = messages.length - visibleMessages.length;

  useEffect(() => {
    onMemoryRetrieval({ count: memoryMatches.length, top: memoryMatches[0]?.memory.intention ?? "", ids: memoryMatches.flatMap((match) => match.memory.id ? [match.memory.id] : []) });
  }, [memoryMatches, onMemoryRetrieval]);

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
    setVisibleMessageLimit(INITIAL_VISIBLE_MESSAGES);
    const frame = window.requestAnimationFrame(() => {
      const stream = messageStreamRef.current;
      if (stream) stream.scrollTop = stream.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => () => {
    voiceOperationGenerationRef.current += 1;
    if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    const recorder = voiceRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
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
    if (!draft.trim()) return;
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
    setVoicePending("preview");
    setVoicePreview(null);
    voiceAudioRef.current?.pause();
    setVoiceAudio(null);
    setVoicePlaybackState("ready");
    setError("");
    try {
      const preview = await onPreviewVoiceOutput(exchangeId);
      setVoicePreview(preview);
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
    setVoicePending("confirm");
    setError("");
    try {
      const audio = await onConfirmVoiceOutput(voicePreview.requestId);
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

  function releaseVoiceMicrophone() {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
    voiceTimerRef.current = null;
  }

  function stopVoiceCapture(discard = false) {
    voiceDiscardRef.current = discard;
    const recorder = voiceRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    releaseVoiceMicrophone();
    if (discard && recorder?.state !== "recording") {
      voiceTakeRef.current = null;
      voiceChunksRef.current = [];
      setVoiceRecordedSeconds(null);
      setVoiceTranscriptDurationMs(null);
      setVoiceCaptureState("idle");
      setVoiceInputMessage("Toma descartada. El micrófono está apagado.");
    }
  }

  async function startVoiceCapture() {
    if (!desktopApp || voiceCaptureState === "requesting" || voiceCaptureState === "recording") return;
    const previousTake = voiceTakeRef.current;
    const generation = ++voiceOperationGenerationRef.current;
    setError("");
    setVoiceInputMessage("Solicitando permiso de micrófono…");
    setVoiceCaptureState("requesting");
    setVoiceTranscriptDurationMs(null);
    voiceDiscardRef.current = false;
    try {
      if (provider !== "llamacpp") throw new Error("Elegí Gemma local en Configuración: la voz usa el mismo modelo y no inicia un segundo motor.");
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este entorno no ofrece captura de micrófono compatible.");
      if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) throw new Error("WebM/Opus no está disponible en este equipo.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (generation !== voiceOperationGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      voiceTakeRef.current = null;
      voiceChunksRef.current = [];
      setVoiceRecordedSeconds(null);
      voiceStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      voiceRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onerror = () => {
        if (generation !== voiceOperationGenerationRef.current) return;
        voiceDiscardRef.current = true;
        releaseVoiceMicrophone();
        voiceTakeRef.current = null;
        setVoiceCaptureState("idle");
        setVoiceInputMessage("La grabación falló y la toma fue descartada.");
      };
      recorder.onstop = () => {
        releaseVoiceMicrophone();
        voiceRecorderRef.current = null;
        if (generation !== voiceOperationGenerationRef.current) {
          voiceChunksRef.current = [];
          return;
        }
        const take = voiceDiscardRef.current ? null : new Blob(voiceChunksRef.current, { type: "audio/webm;codecs=opus" });
        voiceChunksRef.current = [];
        voiceTakeRef.current = take && take.size ? take : null;
        setVoiceRecordedSeconds(voiceTakeRef.current ? Math.max(0.1, Math.min(60, (Date.now() - voiceStartedAtRef.current) / 1000)) : null);
        setVoiceCaptureState(voiceTakeRef.current ? "recorded" : "idle");
        setVoiceInputMessage(voiceTakeRef.current ? "Micrófono apagado. La toma está sólo en RAM; ahora podés transcribirla o descartarla." : "Toma descartada. El micrófono está apagado.");
      };
      recorder.start(250);
      voiceStartedAtRef.current = Date.now();
      setVoiceElapsedSeconds(0);
      setVoiceCaptureState("recording");
      setVoiceInputMessage("Grabando · terminá el turno manualmente. Límite: 60 segundos.");
      voiceTimerRef.current = window.setInterval(() => {
        const elapsed = Math.min(60, Math.floor((Date.now() - voiceStartedAtRef.current) / 1000));
        setVoiceElapsedSeconds(elapsed);
        if (elapsed >= 60 && voiceRecorderRef.current?.state === "recording") stopVoiceCapture(false);
      }, 250);
    } catch (cause) {
      if (generation !== voiceOperationGenerationRef.current) return;
      releaseVoiceMicrophone();
      voiceTakeRef.current = previousTake;
      setVoiceCaptureState(previousTake ? "recorded" : "idle");
      setVoiceInputMessage(String(cause));
    }
  }

  async function transcribeVoiceCapture() {
    const take = voiceTakeRef.current;
    if (!take || voiceCaptureState !== "recorded") return;
    const generation = voiceOperationGenerationRef.current;
    setVoiceCaptureState("transcribing");
    setVoiceInputMessage("Gemma está transcribiendo localmente. Todavía no se envía nada al chat.");
    setError("");
    try {
      const audioBase64 = bytesToBase64(new Uint8Array(await take.arrayBuffer()));
      const result = await onTranscribeVoiceTurn(audioBase64, take.type || "audio/webm");
      if (generation !== voiceOperationGenerationRef.current) return;
      voiceTakeRef.current = null;
      setVoiceTranscriptDurationMs(result.durationMs);
      if (result.noSpeech) {
        setVoiceCaptureState("idle");
        setVoiceInputMessage("No se detectó habla inteligible. El audio fue descartado y no se guardó texto.");
      } else {
        onDraftChange(result.text);
        setVoiceCaptureState("review");
        setVoiceInputMessage("Transcripción colocada en el mensaje. Revisala o corregila antes de procesar el contexto.");
      }
    } catch (cause) {
      if (generation !== voiceOperationGenerationRef.current) return;
      setVoiceCaptureState("recorded");
      setVoiceInputMessage(`No se completó la transcripción: ${String(cause)} La toma sigue sólo en RAM.`);
    }
  }

  function closeVoiceMode() {
    voiceOperationGenerationRef.current += 1;
    voiceDiscardRef.current = true;
    stopVoiceCapture(true);
    voiceTakeRef.current = null;
    setVoiceRecordedSeconds(null);
    setVoiceTranscriptDurationMs(null);
    setVoiceModeOpen(false);
    setVoiceCaptureState("idle");
    setVoiceInputMessage("El micrófono está apagado. Nada se graba ni se envía.");
  }

  function discardVoiceAudio() {
    voiceAudioRef.current?.pause();
    if (voiceAudioRef.current) voiceAudioRef.current.currentTime = 0;
    setVoiceAudio(null);
    setVoicePlaybackState("ready");
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

    <div className="conversation-layout">
      <div className="chat-column">
        <div className="message-stream" aria-live="polite" ref={messageStreamRef}>
          {hiddenMessageCount > 0 && <div className="conversation-history-gate"><button type="button" onClick={() => setVisibleMessageLimit((current) => Math.min(messages.length, current + HISTORY_PAGE_MESSAGES))}>Mostrar {Math.min(HISTORY_PAGE_MESSAGES, hiddenMessageCount)} anteriores</button><span>{hiddenMessageCount} mensajes ocultos para mantener el chat despejado</span><small>Siguen en el historial local; esto no los borra ni los convierte en recuerdos.</small></div>}
          {messages.length === 0 ? <div className="chat-empty"><span>A</span><h3>Estoy lista para conversar.</h3><p>No necesitás iniciar una misión. Podés preguntarme, estudiar conmigo o traer una idea para investigar.</p></div> : visibleMessages.map((item) => <article key={item.id} className={`chat-message ${item.role}`}><div className="message-author">{item.role === "user" ? "CARLOS NUÑEZ" : "ALICE"}<small>{messageTime(item.createdAt)}</small></div><p>{item.text}</p>{item.model && <span className="message-model">{item.model}</span>}{item.role === "assistant" && item.exchangeId === newestExchangeId && <div className="conversation-message-actions"><div className="conversation-voice-trigger"><button type="button" className="secondary" onClick={() => void previewVoiceOutput(item.exchangeId!)} disabled={!desktopApp || Boolean(voicePending)}>{voicePending === "preview" ? "Preparando voz…" : "Escuchar con la voz de Alice"}</button><small>Manual · revisás el texto antes de enviar una copia a Fish Audio.</small></div><div className="conversation-learning-trigger"><button type="button" className="secondary" onClick={() => void previewConversationLearning(item.exchangeId!)} disabled={!desktopApp || provider !== "llamacpp" || Boolean(conversationLearningPending)}>{conversationLearningPending === item.exchangeId ? "Revisando tu mensaje…" : "Proponer recuerdo de este intercambio"}</button><small>Manual · sólo analiza tu mensaje, nunca esta respuesta.</small></div></div>}</article>)}
        </div>
        {voicePreview && <section className="voice-output-review" aria-live="polite"><header><div><strong>VOZ DE ALICE · REVISIÓN EXPLÍCITA</strong><span>Fish Audio · {voicePreview.model} · audio temporal</span></div><button type="button" className="secondary" onClick={() => void cancelVoiceOutput()} disabled={Boolean(voicePending)}>{voicePending === "cancel" ? "Descartando…" : "Cancelar"}</button></header><div className="voice-output-meta"><span>{voicePreview.characterCount}/{voicePreview.characterLimit} caracteres</span><span>SHA-256 registrado sin texto</span><span>Sin memoria · sin archivo</span></div><details open><summary>Texto exacto que se enviará</summary><p>{voiceMessage?.text ?? "La respuesta ya no está disponible en esta vista."}</p></details>{voicePreview.canConfirm ? <footer><small>Al confirmar, se enviará únicamente este texto al proveedor. Cancelar ahora no envía nada.</small><button type="button" className="primary" onClick={() => void confirmVoiceOutput()} disabled={Boolean(voicePending)}>{voicePending === "confirm" ? "Generando audio…" : "Autorizar y generar audio temporal"}</button></footer> : <p className="voice-output-warning">{voicePreview.configuration === "missingApiKey" ? "Falta FISH_API_KEY en el proceso de Alice. Cerrá y abrí Alice después de configurarla." : "Falta ALICE_FISH_REFERENCE_ID: la identidad de voz debe configurarse localmente, fuera del repositorio."}</p>}</section>}
        {voiceAudio && <section className="voice-output-player" aria-live="polite"><header><div><strong>{voicePlaybackState === "playing" ? "ALICE ESTÁ HABLANDO" : voicePlaybackState === "paused" ? "VOZ DE ALICE EN PAUSA" : "AUDIO TEMPORAL LISTO"}</strong><span>{voiceAudio.characterCount} caracteres · generado en {(voiceAudio.durationMs / 1000).toFixed(1)} s · sin archivo ni recuerdo</span></div><button type="button" className="secondary" onClick={discardVoiceAudio}>Detener y descartar</button></header><audio ref={voiceAudioRef} controls autoPlay onPlay={() => setVoicePlaybackState("playing")} onPause={() => setVoicePlaybackState("paused")} onEnded={discardVoiceAudio} onError={() => { setError("El audio temporal no pudo reproducirse y fue descartado."); discardVoiceAudio(); }} src={`data:${voiceAudio.mimeType};base64,${voiceAudio.audioBase64}`}>Tu navegador no puede reproducir este audio temporal.</audio><small>Al terminar la reproducción, el audio se elimina automáticamente de la interfaz.</small></section>}
        {(conversationLearning || conversationLearningMessage) && <section className="conversation-learning-review" aria-live="polite"><header><div><strong>PROPUESTA DE RECUERDO · REVISIÓN HUMANA</strong><span>Gemma local · tu mensaje es la única evidencia</span></div><button type="button" className="secondary" onClick={() => { setConversationLearning(null); setConversationLearningMessage(""); }} disabled={Boolean(conversationLearningPending)}>Cerrar</button></header>{conversationLearning?.candidates.map((candidate) => <article key={candidate.candidateId}><div><strong>{candidate.intention}</strong><span>{conversationMemoryTypeLabels[candidate.memoryType]} · {Math.round(candidate.confidence * 100)}%</span></div><p>{candidate.summary}</p><blockquote><span>EVIDENCIA LITERAL DE TU MENSAJE</span>{candidate.evidence}</blockquote>{!!candidate.affects?.length && <div className="learning-emotions"><strong>Interpretación emocional de tu mensaje · revisá antes de guardar</strong>{candidate.affects.map(item => { const channel = affectPalette.find(candidateChannel => candidateChannel.id === item.emotion); return <p key={item.emotion}><span><i style={{ backgroundColor: channel?.color }} />{channel?.label ?? item.emotion} · intensidad {Math.round(item.intensity * 100)}%</span><q>{item.evidence}</q></p>; })}<small>Confirmar el recuerdo conserva también esta interpretación. No es el estado emocional actual de Alice.</small></div>}<label className="learning-importance">Importancia del recuerdo<select value={learningImportance[candidate.candidateId] ?? 3} disabled={Boolean(conversationLearningPending)} onChange={event => setLearningImportance(current => ({ ...current, [candidate.candidateId]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}/5 · {["Baja", "Menor", "Media", "Alta", "Muy alta"][value - 1]}</option>)}</select><small>Elegí cuánto importa conservarlo. La confianza de Gemma no mide impacto emocional.</small></label><footer><small>Similitud y extracción no verifican verdad. Confirmar es tu decisión.</small><button type="button" className="primary" onClick={() => void confirmConversationLearning(candidate)} disabled={Boolean(conversationLearningPending)}>{conversationLearningPending === candidate.candidateId ? "Confirmando…" : "Confirmar recuerdo"}</button></footer></article>)}{conversationLearning && conversationLearning.candidates.length === 0 && <p className="retrieval-empty">No hay propuesta. El intercambio sigue sólo en el historial local.</p>}{conversationLearningMessage && <p className="memory-operation-message" role="status">{conversationLearningMessage}</p>}</section>}
        {pendingRetrievals.length > 0 && <section className="retrieval-outcome-review" aria-label="Evaluación real de recuerdos recuperados"><header><div><strong>R6.5-F · RESULTADO DE RECUPERACIÓN</strong><span>Confirmación humana · no modifica fuerza ni reposo</span></div><em>{pendingRetrievals.length} pendiente{pendingRetrievals.length === 1 ? "" : "s"}</em></header>{pendingRetrievals.map(({ key, recordId }) => { const memory = memories.find((item) => item.id === recordId); return <article key={key}><div><span>¿ESTE RECUERDO AYUDÓ?</span><strong>{memory?.intention ?? recordId}</strong></div><div><button type="button" className="secondary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "not-helpful")}>No ayudó</button><button type="button" className="primary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "helpful")}>Sí, fue útil</button></div></article>; })}</section>}
        {error && !reviewing && <p className="cloud-error" role="alert">{error}</p>}
        <div className="composer">
          <label htmlFor="alice-message">MENSAJE PARA ALICE</label>
          <div className={`voice-turn ${voiceModeOpen ? "open" : ""}`}>
            <button type="button" className="voice-turn-toggle" aria-expanded={voiceModeOpen} onClick={() => voiceModeOpen ? closeVoiceMode() : setVoiceModeOpen(true)} disabled={!desktopApp || sending}>{voiceModeOpen ? "Cerrar turno de voz" : "Abrir turno de voz"}<span>{voiceCaptureState === "recording" ? `REC ${voiceElapsedSeconds}s` : "MIC APAGADO"}</span></button>
            {voiceModeOpen && <div className="voice-turn-panel" aria-live="polite"><header><div><strong>TURNO DE VOZ LOCAL</strong><span>{voiceCaptureState === "recording" ? `GRABANDO · ${voiceElapsedSeconds}/60 s` : voiceCaptureState === "transcribing" ? "TRANSCRIBIENDO · GEMMA" : "MICRÓFONO APAGADO"}</span></div><i className={voiceCaptureState === "recording" ? "active" : ""} /></header><p>{voiceInputMessage}</p>{(voiceRecordedSeconds !== null || voiceTranscriptDurationMs !== null) && <div className="voice-turn-observation" aria-label="Observación del último turno"><span><strong>{voiceRecordedSeconds?.toFixed(1) ?? "—"} s</strong>toma efímera</span><span><strong>{voiceTranscriptDurationMs === null ? "—" : `${(voiceTranscriptDurationMs / 1000).toFixed(1)} s`}</strong>transcripción</span><span><strong>{voiceCaptureState === "review" ? "REVISAR" : voiceCaptureState === "recorded" ? "LISTA" : voiceCaptureState === "idle" ? "SIN HABLA" : "EN CURSO"}</strong>resultado</span></div>}<div className="voice-turn-actions">{voiceCaptureState !== "recording" && <button type="button" className="secondary" onClick={() => void startVoiceCapture()} disabled={voiceCaptureState === "requesting" || voiceCaptureState === "transcribing"}>{voiceCaptureState === "requesting" ? "Esperando permiso…" : voiceCaptureState === "recorded" ? "Grabar otra toma" : "Grabar mi voz"}</button>}{voiceCaptureState === "recording" && <button type="button" className="primary" onClick={() => stopVoiceCapture(false)}>Terminé de hablar</button>}{voiceCaptureState === "recorded" && <button type="button" className="primary" onClick={() => void transcribeVoiceCapture()}>Transcribir localmente</button>}{(voiceCaptureState === "recording" || voiceCaptureState === "recorded") && <button type="button" className="secondary danger" onClick={() => stopVoiceCapture(true)}>Descartar toma</button>}</div><small>El audio vive sólo en RAM. La transcripción queda como borrador editable: nunca se envía, aprende ni guarda por sí sola.</small></div>}
          </div>
          <textarea id="alice-message" value={draft} onChange={(event) => { onDraftChange(event.target.value); setReviewing(false); setHybridPreview(null); }} placeholder="Preguntá, explicá una idea o pedí ayuda…" />
          <div className="composer-footer"><span>{localInference ? "Primero verás exactamente qué contexto procesará el modelo local." : "Primero verás exactamente qué datos saldrán de tu PC."}</span><button className="primary" title="Abre la previsualización de privacidad; todavía no procesa el mensaje" onClick={prepareReview} disabled={!draft.trim() || sending}>{localInference ? "Revisar contexto local" : "Ver qué se enviará"} <span>→</span></button></div>
        </div>
      </div>

      <aside className="cloud-control">
        <p className="eyebrow">CONTROL DE CONTEXTO</p>
        <h3>{localInference ? "Qué puede procesar" : "Qué puede salir"}</h3>
        <div className="context-section-label"><strong>{localInference ? "CONTEXTO LOCAL AUTORIZADO" : "SALIDA A LA NUBE"}</strong><span>FUENTES SELECCIONADAS · DATOS REALES</span></div>
        <label className={`context-toggle ${recentHistory.length ? "available" : "waiting"}`}><input type="checkbox" checked={includeHistory} onChange={(event) => { setIncludeHistory(event.target.checked); setReviewing(false); }} /><span><strong>Historial reciente</strong><small>{recentHistory.length ? `${recentHistory.filter((item) => item.role === "user").length} mensajes tuyos disponibles · respuestas previas de Alice no se reutilizan como hechos` : "seleccionado · todavía no hay mensajes guardados"}</small></span></label>
        <label className={`context-toggle ${draft.trim() ? "available" : "waiting"}`}><input type="checkbox" checked={includeMemory} onChange={(event) => { setIncludeMemory(event.target.checked); setReviewing(false); }} /><span><strong>{localInference ? "RAG local de recuerdos" : "Recuerdos relevantes"}</strong><small>{draft.trim() ? `${memoryMatches.length} coincidencias de ${memories.length} recuerdos · ${dormantMemoryCount} en reposo · ${suppressedMemoryCount} suprimidos` : "seleccionado · espera un mensaje para buscar"}</small></span></label>
        {draft.trim() && memoryMatches.length > 0 && !includeMemory && <p className="memory-authorization-warning" role="status">Alice encontró {memoryMatches.length} recuerdos, pero no se {localInference ? "procesarán" : "enviarán"} mientras esta casilla siga desmarcada.</p>}
        {draft.trim() && <div className={`memory-retrieval-preview ${hybridActive ? "hybrid" : ""}`} aria-live="polite"><div><strong>RECUPERACIÓN LOCAL</strong><span>{hybridActive ? "GEMMA · TOP 3 · REVISABLE" : "LEXICAL · MÁX. 3 · REPOSO Y SUPRESIÓN EXCLUIDOS"}</span></div>{memoryMatches.length ? memoryMatches.map((match) => <article key={match.memory.id ?? `${match.memory.intention}-${match.score}`}><header><strong>{match.memory.intention}</strong><span>{"rank" in match ? `#${match.rank}` : match.score.toFixed(3)}</span></header><p>{match.reason}</p></article>) : <p className="retrieval-empty">No hay recuerdos accesibles relacionados. No se adjuntará memoria.</p>}{desktopApp && provider === "llamacpp" && hybridCandidates.length >= 3 && <footer className="hybrid-retrieval-control"><button type="button" className="hybrid-retrieval-action" onClick={() => void runHybridPreview()} disabled={hybridPending || sending}>{hybridPending ? "Gemma está revisando…" : hybridActive ? "Revisar otra vez con Gemma" : "Ampliar con Gemma"}</button><small>Acción manual · compara hasta {hybridCandidates.length} recuerdos · no guarda ni confirma contenido</small>{hybridActive && hybridPreview && <em>{hybridPreview.preview.elapsedMs.toLocaleString("es-PY")} ms · requiere tu revisión</em>}</footer>}</div>}
        <label className={`context-toggle ${foregroundContext ? "available" : "waiting"}`}><input type="checkbox" checked={includeWindow} disabled={!observationEnabled || !foregroundContext} onChange={(event) => { setIncludeWindow(event.target.checked); setReviewing(false); }} /><span><strong>Ventana actual</strong><small>{foregroundContext ? `${foregroundContext.processName} · metadatos disponibles` : "no seleccionable · observador sin contexto"}</small></span></label>
        <div className={`conversation-observer-state ${observationEnabled ? "active" : ""}`}><i /><span><strong>{observationEnabled ? "OBSERVADOR LOCAL ACTIVO" : "OBSERVADOR LOCAL INACTIVO"}</strong><small>{observationEnabled ? localInference ? "Hay metadatos locales. Sólo se procesarán al marcar Ventana actual y autorizar." : "Hay metadatos locales. Sólo saldrán al marcar Ventana actual y autorizar." : "No está autorizado ni está capturando metadatos de la ventana."}</small></span></div>
        {desktopApp && <button type="button" className={observationEnabled ? "console-button observing" : "console-button"} onClick={onToggleObservation}>{observationEnabled ? "Administrar observador en Gateway" : "Configurar observador en Gateway"}</button>}
        <p className="context-sensor-boundary">El contexto automático sólo admite nombre del proceso y título de ventana. El micrófono funciona aparte, únicamente durante un turno de voz visible y autorizado; cámara y fotogramas siguen fuera.</p>
        <div className="context-section-label local"><strong>CONTINUIDAD LOCAL</strong><span>HISTORIAL + RAM</span></div>
        <div className="conversation-working-memory"><i /><span><strong>CONVERSACIÓN GUARDADA LOCALMENTE</strong><small>Cada intercambio exitoso se conserva para continuar después de reiniciar. También entra en la RAM inmediata, pero no se convierte automáticamente en recuerdo ni en hecho confirmado.</small></span></div>
        <div className="conversation-route"><strong>MOTOR SELECCIONADO · SIN HERRAMIENTAS</strong><span>{selectedProvider?.label ?? provider}</span><small>{model || "modelo sin configurar"}</small></div>
        <div className="cloud-rule"><strong>{localInference ? "POLÍTICA DE INFERENCIA" : "POLÍTICA DE ENVÍO"}</strong><span>{selectedProvider?.protocol ?? "adaptador nativo"} · {selectedProvider?.retentionMode ?? "retención según proveedor"} · {localInference ? "contexto 4096 · máximo 900 tokens de salida" : "máximo 1200 tokens de salida"} · sin herramientas · previsualización obligatoria</span></div>
        <button type="button" className="conversation-settings-link" onClick={onOpenSettings}>Cambiar proveedor o modelo en Configuración</button>
      </aside>
    </div>

    {reviewing && <div className="send-review" ref={reviewRef} tabIndex={-1}>
      <div className="review-heading"><div><p className="eyebrow">PREVISUALIZACIÓN OBLIGATORIA</p><h3>{localReview ? "Esto se procesará localmente con" : "Esto se enviará a"} {status.providers.find((option) => option.id === reviewRequest?.provider)?.label ?? reviewRequest?.provider}</h3></div><span>{reviewRequest?.model}</span></div>
      <div className="payload-budget" aria-label="Presupuesto exacto del contexto autorizado">
        <header><strong>{localReview ? "PRESUPUESTO DE CONTEXTO LOCAL" : "PRESUPUESTO DE SALIDA"}</strong><span>CARACTERES · BYTES UTF-8</span></header>
        {reviewBudget?.fragments.map((item) => <div key={item.id} className={item.included ? "included" : "excluded"}><span>{item.label}{item.optional ? " · opcional" : ""}</span><strong>{item.characters.toLocaleString("es-PY")}</strong><em>{item.utf8Bytes.toLocaleString("es-PY")} B</em><small>{item.included ? "INCLUIDO" : "NO AUTORIZADO"}</small></div>)}
        <div className="separators"><span>Separadores de secciones</span><strong>{reviewBudget?.separatorCharacters.toLocaleString("es-PY") ?? 0}</strong><em>{reviewBudget?.separatorUtf8Bytes.toLocaleString("es-PY") ?? 0} B</em><small>FORMATO</small></div>
        <footer><span>TOTAL EXACTO DEL PAYLOAD</span><strong>{reviewBudget?.totalCharacters.toLocaleString("es-PY") ?? 0} caracteres</strong><em>{reviewBudget?.totalUtf8Bytes.toLocaleString("es-PY") ?? 0} bytes UTF-8</em></footer>
      </div>
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
