import { buildCognitiveMemoryNodes, type CognitiveMemoryInput, type CognitiveMemoryLayer, type CognitiveMemoryOrigin } from "./cognitive-memory";

export type MemoryContextMode = "none" | "full" | "limited";
export type RetrievalPhase = "idle" | "prepared" | "sending" | "responded" | "bypassed" | "failed";
export type RetrievalScoreKind = "lexical" | "rank";
type ObservedMemoryInput = CognitiveMemoryInput & { nextStep?: string };
type Reference = { id: string; contentKey: string; score: number | null; scoreKind: RetrievalScoreKind | null };

// Ephemeral request evidence only. Never persisted as memory or sent to a provider.
export type MemoryRetrievalObservation = {
  phase: RetrievalPhase;
  queryPresent: boolean;
  queryKey: string;
  count: number;
  top: string;
  ids: string[];
  references: Reference[];
  contextMode: MemoryContextMode | null;
  responseId: string | null;
};

export type RetrievedMemoryView = {
  phase: RetrievalPhase;
  contextMode: MemoryContextMode | null;
  responseId: string | null;
  count: number;
  ids: string[];
  top: {
    id: string;
    layer: CognitiveMemoryLayer;
    typeLabel: string;
    text: string;
    source: string | null;
    origin: CognitiveMemoryOrigin;
    score: number | null;
    scoreKind: RetrievalScoreKind | null;
  } | null;
};

export function emptyMemoryRetrieval(phase: RetrievalPhase = "idle"): MemoryRetrievalObservation {
  return { phase, queryPresent: false, queryKey: "", count: 0, top: "", ids: [], references: [], contextMode: null, responseId: null };
}

function contentKey(memory: ObservedMemoryInput): string {
  return JSON.stringify([memory.id, memory.kind, memory.intention, memory.summary, memory.nextStep,
    memory.memoryType, memory.source, memory.memoryVersion, memory.studyLearning, memory.automaticLearning, memory.ownerReviewed]);
}

export function prepareMemoryRetrieval(
  matches: { memory: ObservedMemoryInput; score?: number; rank?: number }[],
  scoreKind: RetrievalScoreKind | null,
  queryPresent = true,
  queryKey = "",
): MemoryRetrievalObservation {
  const observation = emptyMemoryRetrieval(queryPresent ? "prepared" : "idle");
  observation.queryPresent = queryPresent;
  observation.queryKey = queryKey;
  if (!queryPresent) return observation;
  const seen = new Set<string>();
  const eligible = buildCognitiveMemoryNodes(matches.map(match => match.memory), matches.flatMap(match => match.memory.id ? [match.memory.id] : []));
  for (const match of matches) {
    const id = match.memory.id?.trim();
    if (!id || seen.has(id) || !eligible.some(node => node.id === id && node.retrieved)) continue;
    seen.add(id);
    const candidate = scoreKind === "rank" ? match.rank : match.score;
    const validScore = scoreKind !== null && typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0
      && (scoreKind !== "rank" || Number.isSafeInteger(candidate) && candidate >= 1);
    observation.references.push({ id, contentKey: contentKey(match.memory), score: validScore ? candidate : null, scoreKind: validScore ? scoreKind : null });
    observation.ids.push(id);
    if (!observation.top) observation.top = match.memory.intention;
  }
  observation.count = observation.ids.length;
  return observation;
}

// Clearing a sent draft keeps the last receipt. A new query replaces it; typing
// while a request is running cannot replace the frozen request evidence.
export function observePreparedMemory(previous: MemoryRetrievalObservation, next: MemoryRetrievalObservation): MemoryRetrievalObservation {
  if (previous.phase === "sending") return previous;
  if (["responded", "bypassed", "failed"].includes(previous.phase)) {
    if (!next.queryPresent) return previous.queryPresent ? { ...previous, queryPresent: false } : previous;
    if (previous.queryPresent && previous.queryKey && previous.queryKey === next.queryKey) return previous;
  }
  if (previous.phase === next.phase && previous.queryPresent === next.queryPresent && previous.queryKey === next.queryKey
    && JSON.stringify(previous.references) === JSON.stringify(next.references)) return previous;
  return next;
}

export function beginMemoryRetrieval(prepared: MemoryRetrievalObservation, queryKey = prepared.queryKey, includeMemories = true): MemoryRetrievalObservation {
  const authorized = includeMemories ? prepared : emptyMemoryRetrieval();
  return { ...authorized, phase: "sending", queryKey, queryPresent: prepared.queryPresent || Boolean(queryKey), ids: [...authorized.ids], references: authorized.references.map(reference => ({ ...reference })), contextMode: null, responseId: null };
}

export function completeMemoryRetrieval(sent: MemoryRetrievalObservation, responseId: string, mode?: MemoryContextMode): MemoryRetrievalObservation {
  if (mode !== "full" && mode !== "limited") {
    return { ...emptyMemoryRetrieval(mode === "none" ? "bypassed" : "responded"), queryKey: sent.queryKey, queryPresent: sent.queryPresent, contextMode: mode === "none" ? "none" : null, responseId };
  }
  return { ...sent, phase: "responded", contextMode: mode, responseId };
}

export function failMemoryRetrieval(sent: MemoryRetrievalObservation): MemoryRetrievalObservation {
  return { ...emptyMemoryRetrieval("failed"), queryKey: sent.queryKey, queryPresent: sent.queryPresent };
}

const labels: Record<CognitiveMemoryLayer, string> = {
  episodic: "EPISÓDICA", semantic: "SEMÁNTICA", procedural: "PROCEDIMENTAL", preference: "PREFERENCIA", self: "PERFIL", unclassified: "SIN CLASIFICAR",
};

export function projectMemoryRetrieval(observation: MemoryRetrievalObservation, memories: ObservedMemoryInput[]): RetrievedMemoryView {
  const view: RetrievedMemoryView = { phase: observation.phase, contextMode: observation.contextMode, responseId: observation.responseId, count: 0, ids: [], top: null };
  if (["idle", "bypassed", "failed"].includes(observation.phase)) return view;
  const nodes = buildCognitiveMemoryNodes(memories, observation.ids);
  for (const reference of observation.references) {
    const memory = memories.find(item => item.id === reference.id);
    const node = nodes.find(item => item.id === reference.id);
    if (!memory || !node?.retrieved || reference.contentKey !== contentKey(memory)) continue;
    view.ids.push(reference.id);
    if (!view.top) view.top = {
      id: node.id, layer: node.layer, typeLabel: labels[node.layer],
      text: memory.kind === "Conversación" ? `USUARIO: ${memory.intention} → Alice` : memory.intention,
      source: node.source, origin: node.origin, score: reference.score, scoreKind: reference.scoreKind,
    };
  }
  view.count = view.ids.length;
  return view;
}
