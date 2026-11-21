import type { CloudRequest, CloudResponse, CloudStatus, ConversationMessage, HybridRetrievalPreview, HybridRetrievalRequest, SendAuthorization } from "./conversation-contracts";
import type { ConversationLearningApproval, ConversationLearningCandidate, ConversationLearningPreview } from "./conversation-learning";
import { buildCloudPayloadReview } from "./cloud-payload";
import { affectPalette } from "../cognitive/affect";
import { buildRetrievalQuery, retrieveMemories } from "../memory/memory-retrieval";
import type { CognitiveMemoryInput } from "../memory/cognitive-memory";
import { prepareMemoryRetrieval, type MemoryRetrievalObservation } from "../memory/retrieval-observation";
import { selectReinforceableMemoryIds, type RetrievalOutcome } from "../memory/memory-consolidation";

type MemoryExcerpt = CognitiveMemoryInput & { nextStep?: string };

type VoiceStatus = {
  busy: boolean;
  active: boolean;
  pending: string | null;
  captureState: string;
  statusLabel: string;
  statusTone: string;
  modeOpen?: boolean;
};

export type ConversationPageInputs = {
  desktopApp: boolean;
  cloudPending?: boolean;
  draft: string;
  status: CloudStatus;
  provider: string;
  model: string;
  messages: ConversationMessage[];
  memories: MemoryExcerpt[];
  showFullHistory?: boolean;
  observationEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  automaticLearning?: { enabled: boolean; count: number; phase: "idle" | "evaluating" | "error"; onOpen: () => void };
  voice: VoiceStatus;
  onToggleObservation: () => void | Promise<void>;
  onDraftChange: (draft: string) => void;
  onMemoryRetrieval: (observation: MemoryRetrievalObservation) => void;
  onHybridRetrieve: (request: HybridRetrievalRequest) => Promise<HybridRetrievalPreview>;
  onPreviewConversationLearning: (exchangeId: string) => Promise<ConversationLearningPreview>;
  onConfirmConversationLearning: (preview: ConversationLearningPreview, candidate: ConversationLearningCandidate, approval: ConversationLearningApproval) => Promise<{ recordId: string; recordCount: number; alreadyConfirmed: boolean }>;
  onSend: (request: CloudRequest, recalledMemoryIds: string[], retrieval?: MemoryRetrievalObservation, authorization?: SendAuthorization) => Promise<CloudResponse>;
  onRetrievalOutcome: (recordId: string, outcome: RetrievalOutcome) => Promise<void>;
  onOpenSettings: () => void;
  onPreviewSpokenResponse: (exchangeId: string) => void;
};

type ExternalView = { voice: unknown; vision: unknown; document: unknown; identification: unknown };
type PreparedReview = {
  request: CloudRequest;
  fragments: ReturnType<typeof buildCloudPayloadReview>["budget"];
  memoryIds: string[];
  retrieval: MemoryRetrievalObservation;
};

const time = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit" });
const memoryTypes = { semantic: "SEMÁNTICA", preference: "PREFERENCIA", episodic: "EPISÓDICA" };
const isLocal = (provider: string) => provider === "ollama" || provider === "llamacpp";
const formatCount = (value: number) => value.toLocaleString("es-PY");

function retrievalCandidates(memories: MemoryExcerpt[]) {
  return memories.filter(memory => !memory.automaticLearning && Boolean(memory.id)
    && (memory.memoryStatus === undefined || memory.memoryStatus === "confirmed")
    && memory.accessibilityStatus !== "dormant" && memory.suppressionStatus !== "suppressed"
    && memory.archiveStatus !== "archived" && memory.deletionStatus !== "scheduled")
    .slice(0, 24).map(memory => ({
      id: memory.id!,
      text: memory.kind === "Conversación" ? memory.intention.trim()
        : [memory.intention, memory.summary, memory.nextStep].filter(value => value?.trim()).join("\n"),
    })).filter(candidate => candidate.text.length > 0);
}

export function createConversationPage(getInputs: () => ConversationPageInputs, onChange: () => void) {
  let previousInputs = getInputs();
  let includeHistory = isLocal(previousInputs.provider);
  let includeMemory = includeHistory;
  let includeWindow = false;
  let review: PreparedReview | null = null;
  let sending = false;
  let error = "";
  let disposed = false;
  let hybridPending = false;
  let hybrid: { query: string; input: ConversationPageInputs; preview: HybridRetrievalPreview } | null = null;
  let learning: ConversationLearningPreview | null = null;
  let learningPending: string | null = null;
  let learningMessage = "";
  let importance: Record<string, number> = Object.create(null) as Record<string, number>;
  let retrievals: { key: string; recordId: string }[] = [];
  let feedbackPending: string | null = null;
  let voiceHistoryBaseline = new Set<string>();
  let enteredDraft: { base: string; value: string } | null = null;
  let lastRetrieval = "";

  function isSending(cloudPending = false) {
    return sending || cloudPending;
  }

  function read() {
    const input = getInputs();
    if (input.provider !== previousInputs.provider) {
      includeHistory = isLocal(input.provider);
      includeMemory = includeHistory;
      review = null;
      hybrid = null;
    }
    if (input.model !== previousInputs.model || input.memories !== previousInputs.memories) {
      review = null;
      hybrid = null;
    }
    if (previousInputs.observationEnabled && !input.observationEnabled) {
      includeWindow = false;
      review = null;
    }
    previousInputs = input;
    if (enteredDraft?.base === input.draft && enteredDraft.value !== input.draft) {
      return { ...input, draft: enteredDraft.value };
    }
    enteredDraft = null;
    return input;
  }

  function changed() {
    if (!disposed) onChange();
  }

  function invalidateReview() {
    review = null;
  }

  function setDraft(value: string) {
    const inputs = getInputs();
    enteredDraft = { base: inputs.draft, value };
    inputs.onDraftChange(value);
    review = null;
    hybrid = null;
    changed();
  }

  function setVoiceDraft(value: string) {
    if (!disposed) setDraft(value);
  }

  function startVoiceSession() {
    voiceHistoryBaseline = new Set(read().messages.map(message => message.id));
    review = null;
    changed();
  }

  function context(input: ConversationPageInputs) {
    const history = input.messages.slice(-10);
    const query = buildRetrievalQuery(input.draft, history);
    const lexical = retrieveMemories(query, input.memories, 3);
    const ranked = hybrid && hybrid.query === query && hybrid.input.memories === input.memories
      && hybrid.input.provider === input.provider && hybrid.input.model === input.model
      ? hybrid.preview.matches.flatMap(match => {
        const memory = input.memories.find(item => item.id === match.id);
        return memory ? [{ memory, score: 4 - match.rank, matchedTerms: [], reason: match.reason, rank: match.rank }] : [];
      }) : [];
    const hybridActive = ranked.length === 3;
    const matches = hybridActive ? ranked : lexical;
    return { history, query, matches, hybridActive };
  }

  function prepare(input: ConversationPageInputs) {
    const { history, matches, hybridActive } = context(input);
    const memories = matches.map(match => match.memory);
    const payload = buildCloudPayloadReview({
      draft: input.draft, includeHistory, recentHistory: history, includeMemory, memories,
      includeWindow, observationEnabled: input.observationEnabled, foregroundContext: input.foregroundContext,
    });
    return {
      request: {
        message: input.draft.trim(), payload: payload.payload, provider: input.provider, model: input.model,
        historyCount: includeHistory ? history.filter(item => item.role === "user").length : 0,
        memoryCount: includeMemory ? memories.length : 0,
      },
      fragments: payload.budget,
      memoryIds: includeMemory ? selectReinforceableMemoryIds(memories) : [],
      retrieval: prepareMemoryRetrieval(includeMemory ? matches : [], hybridActive ? "rank" : "lexical", true, input.draft.trim()),
    } satisfies PreparedReview;
  }

  async function runHybrid(input: ConversationPageInputs) {
    const { query } = context(input);
    const candidates = retrievalCandidates(input.memories);
    if (isSending(input.cloudPending) || hybridPending || !input.desktopApp || input.provider !== "llamacpp" || !query.trim() || candidates.length < 3) return;
    hybridPending = true;
    review = null;
    error = "";
    changed();
    try {
      const preview = await input.onHybridRetrieve({ query, candidates });
      if (disposed) return;
      const validIds = new Set(candidates.map(candidate => candidate.id));
      if (preview.persisted || preview.truthVerified || !preview.requiresOwnerReview || preview.matches.length !== 3
          || new Set(preview.matches.map(match => match.id)).size !== 3 || preview.matches.some(match => !validIds.has(match.id))) {
        throw new Error("Gemma devolvió una previsualización que no cumple el contrato local de R8.3.");
      }
      hybrid = { query, input, preview };
    } catch (cause) {
      hybrid = null;
      error = `No se pudo ampliar la búsqueda con Gemma: ${String(cause)}`;
    } finally {
      hybridPending = false;
      changed();
    }
  }

  async function propose(input: ConversationPageInputs, exchangeId: string) {
    if (!input.desktopApp || input.provider !== "llamacpp" || learningPending || input.messages.at(-1)?.exchangeId !== exchangeId) return;
    learningPending = exchangeId;
    learningMessage = "";
    error = "";
    changed();
    try {
      learning = await input.onPreviewConversationLearning(exchangeId);
      importance = Object.create(null) as Record<string, number>;
      learningMessage = learning.candidates.length
        ? "Propuesta lista: no se guardó nada. Revisá cada candidato antes de confirmar."
        : "Gemma no detectó información estable y explícita para proponer desde tu mensaje.";
    } catch (cause) {
      learning = null;
      error = `No se pudo revisar el intercambio para aprendizaje: ${String(cause)}`;
    } finally {
      learningPending = null;
      changed();
    }
  }

  async function confirmLearning(input: ConversationPageInputs, id: string) {
    const candidate = learning?.candidates.find(item => item.candidateId === id);
    if (!input.desktopApp || !learning || !candidate || learningPending) return;
    if (!window.confirm(`¿Confirmás guardar este recuerdo para Nyxia?\n\n${candidate.intention}\n\nLa propuesta se basó sólo en tu mensaje. También se guardará cualquier interpretación emocional que figure en la propuesta.`)) return;
    learningPending = id;
    learningMessage = "";
    error = "";
    changed();
    try {
      const result = await input.onConfirmConversationLearning(learning, candidate, {
        intention: candidate.intention, summary: candidate.summary, memoryType: candidate.memoryType, importance: importance[id] ?? 3,
      });
      learning = null;
      learningMessage = result.alreadyConfirmed ? "Ese recuerdo ya estaba confirmado; no se duplicó."
        : `Recuerdo confirmado y guardado localmente. Memoria actual: ${result.recordCount} registros.`;
    } catch (cause) {
      error = `No se confirmó el recuerdo: ${String(cause)}`;
    } finally {
      learningPending = null;
      changed();
    }
  }

  async function rate(input: ConversationPageInputs, key: string, outcome: RetrievalOutcome) {
    const item = retrievals.find(entry => entry.key === key);
    if (!input.desktopApp || !item || feedbackPending) return;
    feedbackPending = key;
    error = "";
    changed();
    try {
      await input.onRetrievalOutcome(item.recordId, outcome);
      retrievals = retrievals.filter(entry => entry.key !== key);
    } catch (cause) {
      error = `No se guardó la evaluación del recuerdo: ${String(cause)}`;
    } finally {
      feedbackPending = null;
      changed();
    }
  }

  async function authorize(input: ConversationPageInputs) {
    if (!review || isSending(input.cloudPending) || input.voice.active || input.voice.busy || !input.desktopApp
        || !input.status.providers.find(item => item.id === input.provider)?.configured || !review.request.model.trim()) return;
    const prepared = review;
    // Toggling a source or changing the engine invalidates the reviewed text.
    function stillMatches(inputs: ConversationPageInputs) {
      const current = prepare(inputs);
      return prepared.request.provider === inputs.provider && prepared.request.model === inputs.model
        && prepared.request.message === current.request.message && prepared.request.payload === current.request.payload
        && JSON.stringify(prepared.memoryIds) === JSON.stringify(current.memoryIds);
    }
    const reviewChanged = "Cambió el motor o el contexto. Revisá nuevamente el mensaje antes de procesarlo.";
    if (!stillMatches(input)) {
      review = null;
      error = reviewChanged;
      changed();
      return;
    }
    sending = true;
    error = "";
    changed();
    try {
      const includesWindow = prepared.fragments.fragments.some(fragment => fragment.id === "window" && fragment.included);
      const response = await input.onSend(prepared.request, prepared.memoryIds, prepared.retrieval, {
        window: includesWindow ? input.foregroundContext ?? undefined : undefined,
        verifyReview: () => {
          const latest = read();
          if (disposed || review !== prepared || !stillMatches(latest)) {
            review = null;
            throw new Error(reviewChanged);
          }
        },
      });
      if (prepared.memoryIds.length && response.memoryContextMode === "full") {
        retrievals.push(...prepared.memoryIds.map(recordId => ({ key: `${response.responseId}:${recordId}:${crypto.randomUUID()}`, recordId })));
      }
      if (response.workingMemoryError) error = `La respuesta llegó, pero la memoria de trabajo informó: ${response.workingMemoryError}`;
      if (response.conversationHistoryError) error = `La respuesta llegó, pero el historial local no pudo guardarse: ${response.conversationHistoryError}`;
      if (!disposed && read().draft === input.draft) setDraft("");
      review = null;
      if (!disposed && (input.voice.modeOpen || input.voice.captureState === "review")) {
        const exchangeId = response.conversationHistory?.exchanges.find(item => item.responseId === response.responseId)?.exchangeId;
        if (exchangeId) input.onPreviewSpokenResponse(exchangeId);
        else error ||= "La respuesta está en el chat, pero no se pudo verificar su historial para preparar la voz.";
      }
    } catch (cause) {
      error = String(cause);
    } finally {
      sending = false;
      changed();
    }
  }

  async function processSpokenTurn(text: string, sessionId: string) {
    const input = read();
    if (disposed || isSending(input.cloudPending)) throw new Error("Ya hay un turno en curso.");
    const history = (includeHistory ? input.messages : input.messages.filter(item => !voiceHistoryBaseline.has(item.id))).slice(-10);
    const matches = includeMemory ? retrieveMemories(buildRetrievalQuery(text, history), input.memories, 3) : [];
    const retrieval = prepareMemoryRetrieval(matches, "lexical", true, text.trim());
    const payload = buildCloudPayloadReview({
      draft: text, includeHistory: history.length > 0, includeAssistantDialogue: true, recentHistory: history,
      includeMemory, memories: matches.map(match => match.memory), includeWindow: false, observationEnabled: false, foregroundContext: null,
    });
    input.onMemoryRetrieval(retrieval);
    sending = true;
    error = "";
    changed();
    try {
      const response = await input.onSend({
        message: text, payload: payload.payload, provider: "llamacpp", model: "gemma-4-E2B-it-Q4_K_M", voiceSessionId: sessionId,
        historyCount: history.filter(item => item.role === "user").length, memoryCount: matches.length,
      }, [], retrieval);
      const exchangeId = response.conversationHistory?.exchanges.find(item => item.responseId === response.responseId)?.exchangeId;
      if (!exchangeId) throw new Error("La respuesta llegó, pero no pudo guardarse el historial para darle voz.");
      return { exchangeId };
    } finally {
      sending = false;
      changed();
    }
  }

  function dispatch(rawAction: unknown) {
    if (disposed || !rawAction || typeof rawAction !== "object" || !("type" in rawAction)) return false;
    const action = rawAction as { type: unknown; value?: unknown; key?: unknown; included?: unknown };
    const input = read();
    const sendPending = isSending(input.cloudPending);
    switch (action.type) {
      case "draft":
        if (!sendPending && !input.voice.busy && !input.voice.active && typeof action.value === "string") setDraft(action.value);
        return true;
      case "history":
      case "memory":
      case "window":
        if (sendPending || input.voice.active || typeof action.included !== "boolean") return true;
        if (action.type === "history") includeHistory = action.included;
        if (action.type === "memory") includeMemory = action.included;
        if (action.type === "window" && input.observationEnabled && input.foregroundContext) includeWindow = action.included;
        invalidateReview();
        break;
      case "review":
        if (!sendPending && !hybridPending && input.draft.trim() && !input.voice.busy && !input.voice.active) {
          error = "";
          review = prepare(input);
          input.onMemoryRetrieval(review.retrieval);
        }
        break;
      case "cancelReview":
        if (!sendPending) invalidateReview();
        break;
      case "authorize":
        void authorize(input);
        return true;
      case "hybrid":
        void runHybrid(input);
        return true;
      case "propose":
        if (typeof action.value === "string") void propose(input, action.value);
        return true;
      case "importance":
        if (typeof action.key === "string" && learning?.candidates.some(item => item.candidateId === action.key)
            && typeof action.value === "number" && Number.isInteger(action.value) && action.value >= 1 && action.value <= 5 && !learningPending) {
          importance[action.key] = action.value;
        }
        break;
      case "confirmLearning":
        if (typeof action.value === "string") void confirmLearning(input, action.value);
        return true;
      case "closeLearning":
        if (!learningPending) { learning = null; learningMessage = ""; }
        break;
      case "feedback":
        if (typeof action.key === "string" && (action.value === "helpful" || action.value === "not-helpful")) void rate(input, action.key, action.value);
        return true;
      case "openMemory": input.automaticLearning?.onOpen(); return true;
      case "openSettings": input.onOpenSettings(); return true;
      case "toggleObservation": void input.onToggleObservation(); return true;
      default: return false;
    }
    changed();
    return true;
  }

  function snapshot(external: ExternalView) {
    const input = read();
    const sendPending = isSending(input.cloudPending);
    const { history, matches, hybridActive } = context(input);
    const provider = input.status.providers.find(item => item.id === input.provider);
    const localInference = isLocal(input.provider);
    const configured = Boolean(provider?.configured);
    const newestExchangeId = input.messages.at(-1)?.exchangeId;
    const latest = input.showFullHistory ? input.messages : input.messages.slice(-12);
    const auto = input.automaticLearning;
    const automaticLabel = auto?.phase === "evaluating" ? "Nyxia está evaluando qué recordar…"
      : auto?.phase === "error" ? "No pudo evaluar este turno · revisa Memoria"
      : auto?.enabled ? `${input.provider === "llamacpp" ? "Aprendizaje automático activo" : "Aprendizaje preparado · usa Gemma local"} · ${auto.count} recuerdos`
      : auto ? "Aprendizaje automático pausado" : null;
    const reviewProvider = input.status.providers.find(item => item.id === review?.request.provider);
    const reviewView = review && {
      model: review.request.model, provider: reviewProvider?.label ?? review.request.provider,
      local: isLocal(review.request.provider), payload: review.request.payload,
      canSend: !sendPending && !input.voice.active && !input.voice.busy && input.desktopApp
        && configured && Boolean(review.request.model.trim()),
      fragments: review.fragments.fragments.map(item => ({
        id: item.id, label: item.optional ? item.label + " · opcional" : item.label, included: item.included,
        characters: formatCount(item.characters), bytes: formatCount(item.utf8Bytes),
      })),
      separatorCharacters: formatCount(review.fragments.separatorCharacters),
      separatorBytes: formatCount(review.fragments.separatorUtf8Bytes),
      totalCharacters: formatCount(review.fragments.totalCharacters),
      totalBytes: formatCount(review.fragments.totalUtf8Bytes),
    };
    return {
      ...external, draft: input.draft, sending: sendPending, error, configured, desktopApp: input.desktopApp,
      localInference, configuredProvider: provider?.label ?? input.provider,
      model: input.model, protocol: provider?.protocol ?? "adaptador nativo",
      retention: provider?.retentionMode ?? "retención según proveedor",
      automaticLabel, includeHistory, includeMemory, includeWindow,
      observationEnabled: input.observationEnabled, windowProcess: input.foregroundContext?.processName ?? null,
      delegatedActions: input.desktopApp && input.provider === "llamacpp",
      voiceBusy: input.voice.busy || input.voice.active, voicePending: input.voice.pending,
      statusLabel: input.voice.statusLabel || (sendPending ? "Nyxia está respondiendo"
        : error ? "Hay un problema que revisar"
        : review ? "Revisa el mensaje antes de enviarlo" : "Micrófono apagado"),
      statusTone: input.voice.statusLabel ? input.voice.statusTone : sendPending ? "busy" : error ? "error" : "idle",
      canReview: Boolean(input.draft.trim()) && !sendPending && !hybridPending && !input.voice.busy && !input.voice.active,
      review: reviewView, historyAvailable: history.length > 0, historyCount: history.filter(item => item.role === "user").length,
      memoryCount: input.memories.length, dormantCount: input.memories.filter(item => item.accessibilityStatus === "dormant").length,
      suppressedCount: input.memories.filter(item => item.suppressionStatus === "suppressed").length,
      memoryMatches: matches.map(match => ({
        title: match.memory.intention, rank: "rank" in match ? `#${match.rank}` : match.score.toFixed(3), reason: match.reason,
      })),
      hybridCount: input.desktopApp && input.provider === "llamacpp" ? retrievalCandidates(input.memories).length : 0,
      hybridActive, hybridPending, hybridElapsed: hybridActive && hybrid ? formatCount(hybrid.preview.elapsedMs) : null,
      messages: latest.map(item => ({
        id: item.id, role: item.role, text: item.text, model: item.model ?? null,
        time: Number.isFinite(Date.parse(item.createdAt)) ? time.format(new Date(item.createdAt)) : "",
        exchangeId: item.role === "assistant" && item.exchangeId === newestExchangeId ? item.exchangeId ?? null : null,
      })),
      canLearn: input.desktopApp && input.provider === "llamacpp",
      learningMessage, learningPending,
      learning: learning?.candidates.map(candidate => ({
        id: candidate.candidateId, title: candidate.intention, description: candidate.summary,
        score: `${memoryTypes[candidate.memoryType]} · ${Math.round(candidate.confidence * 100)}%`,
        evidence: candidate.evidence, importance: importance[candidate.candidateId] ?? 3,
        affects: (candidate.affects ?? []).map(item => {
          const channel = affectPalette.find(option => option.id === item.emotion);
          return { id: item.emotion, color: channel?.color ?? "", label: channel?.label ?? item.emotion,
            intensity: Math.round(item.intensity * 100), evidence: item.evidence };
        }),
      })) ?? null,
      retrievals: retrievals.map(item => ({ key: item.key, title: input.memories.find(memory => memory.id === item.recordId)?.intention ?? item.recordId })),
      feedbackPending,
    };
  }

  function observeRetrieval() {
    if (disposed) return;
    const input = read();
    if (input.voice.active || isSending(input.cloudPending)) return;
    const { matches, hybridActive } = context(input);
    const observation = prepareMemoryRetrieval(includeMemory ? matches : [], hybridActive ? "rank" : "lexical", Boolean(input.draft.trim()), input.draft.trim());
    const key = JSON.stringify(observation);
    if (key !== lastRetrieval) {
      lastRetrieval = key;
      input.onMemoryRetrieval(observation);
    }
  }

  return { dispatch, snapshot, processSpokenTurn, startVoiceSession, setVoiceDraft, invalidateReview, isSending,
    observeRetrieval, dispose: () => { disposed = true; } };
}
