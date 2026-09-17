import { parseMemoryAffects, type MemoryAffect } from "../cognitive/affect";
export type ConversationLearningKind = "fact" | "preference" | "experience";
export type ConversationLearningMemoryType = "semantic" | "preference" | "episodic";

export type ConversationLearningCandidate = {
  affects?: MemoryAffect[];
  candidateId: string;
  candidateKind: ConversationLearningKind;
  memoryType: ConversationLearningMemoryType;
  intention: string;
  summary: string;
  evidence: string;
  confidence: number;
};

export type ConversationLearningPreview = {
  exchangeId: string;
  sourceSha256: string;
  memorySha256: string;
  model: string;
  candidates: ConversationLearningCandidate[];
  rejectedCandidateCount: number;
  persisted: false;
  truthVerified: false;
  requiresOwnerReview: true;
};

export type ConversationLearningApproval = {
  memoryType: ConversationLearningMemoryType;
  intention: string;
  summary: string;
  importance: number;
};

export type ConversationLearningConfirmation = {
  recordId: string;
  recordCount: number;
  alreadyConfirmed: boolean;
};

const candidateKinds = new Set<ConversationLearningKind>(["fact", "preference", "experience"]);
const memoryTypes = new Set<ConversationLearningMemoryType>(["semantic", "preference", "episodic"]);
const sha256 = /^sha256:[a-f\d]{64}$/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Vista de aprendizaje conversacional inválida");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum = 10_000) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`Vista de aprendizaje inválida: ${field}`);
  return value;
}

export function parseConversationLearningPreview(value: unknown): ConversationLearningPreview {
  const input = object(value);
  if (!Array.isArray(input.candidates) || input.candidates.length > 3 || input.persisted !== false || input.truthVerified !== false || input.requiresOwnerReview !== true) {
    throw new Error("La propuesta de conversación no respeta sus garantías");
  }
  const candidates = input.candidates.map((item, index) => {
    const candidate = object(item);
    const candidateKind = text(candidate.candidateKind, `candidato ${index + 1}.tipo`) as ConversationLearningKind;
    const memoryType = text(candidate.memoryType, `candidato ${index + 1}.memoria`) as ConversationLearningMemoryType;
    if (!candidateKinds.has(candidateKind) || !memoryTypes.has(memoryType)) throw new Error(`Candidato ${index + 1} fuera del alcance`);
    if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) throw new Error(`Confianza inválida en candidato ${index + 1}`);
    return {
      candidateId: text(candidate.candidateId, `candidato ${index + 1}.id`, 71),
      affects: parseMemoryAffects(candidate.affects, text(candidate.evidence, "evidencia emocional", 240)),
      candidateKind,
      memoryType,
      intention: text(candidate.intention, `candidato ${index + 1}.título`, 100),
      summary: text(candidate.summary, `candidato ${index + 1}.contenido`, 420),
      evidence: text(candidate.evidence, `candidato ${index + 1}.evidencia`, 240),
      confidence: candidate.confidence,
    };
  });
  if (new Set(candidates.map((candidate) => candidate.candidateId)).size !== candidates.length) throw new Error("La propuesta repite candidatos");
  const sourceSha256 = text(input.sourceSha256, "huella del intercambio", 71);
  const memorySha256 = text(input.memorySha256, "huella de memoria", 71);
  if (!sha256.test(sourceSha256) || !sha256.test(memorySha256)) throw new Error("La propuesta no contiene huellas válidas");
  if (typeof input.rejectedCandidateCount !== "number" || !Number.isInteger(input.rejectedCandidateCount) || input.rejectedCandidateCount < 0) throw new Error("Conteo de descartes inválido");
  return {
    exchangeId: text(input.exchangeId, "intercambio", 36),
    sourceSha256,
    memorySha256,
    model: text(input.model, "modelo", 160),
    candidates,
    rejectedCandidateCount: input.rejectedCandidateCount,
    persisted: false,
    truthVerified: false,
    requiresOwnerReview: true,
  };
}

export function parseConversationLearningConfirmation(value: unknown): ConversationLearningConfirmation {
  const input = object(value);
  if (typeof input.recordCount !== "number" || !Number.isInteger(input.recordCount) || input.recordCount < 1 || typeof input.alreadyConfirmed !== "boolean") {
    throw new Error("Confirmación de recuerdo conversacional inválida");
  }
  return {
    recordId: text(input.recordId, "registro confirmado", 36),
    recordCount: input.recordCount,
    alreadyConfirmed: input.alreadyConfirmed,
  };
}
