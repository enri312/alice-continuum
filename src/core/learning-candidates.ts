export type LearningCandidateKind = "fact" | "preference" | "habit" | "experience";
export type LearningMemoryType = "semantic" | "procedural" | "preference" | "episodic";

export type LearningCandidate = {
  candidateId: string;
  candidateKind: LearningCandidateKind;
  memoryType: LearningMemoryType;
  intention: string;
  summary: string;
  evidence: string;
  confidence: number;
};

export type LearningCandidatePreview = {
  sourceRecordId: string;
  sourceTitle: string;
  sourceSha256: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  candidates: LearningCandidate[];
  persisted: false;
};

export type LearningCandidateConfirmation = {
  recordId: string;
  recordCount: number;
  sourceSha256: string;
  backupSha256: string;
  storagePath: string;
  alreadyConfirmed: boolean;
  auditWritten: boolean;
};

const candidateKinds = new Set<LearningCandidateKind>(["fact", "preference", "habit", "experience"]);
const memoryTypes = new Set<LearningMemoryType>(["semantic", "procedural", "preference", "episodic"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Vista de aprendizaje inválida: ${label}`);
  return value;
}
function requiredSha256(value: unknown, label: string): string {
  const digest = requiredString(value, label);
  if (!/^sha256:[a-f\d]{64}$/i.test(digest)) throw new Error(`Huella de aprendizaje inválida: ${label}`);
  return digest;
}

export function parseLearningCandidatePreview(value: unknown): LearningCandidatePreview {
  if (!isObject(value) || !Array.isArray(value.candidates) || value.persisted !== false) {
    throw new Error("Vista de aprendizaje local inválida");
  }
  const candidates = value.candidates.map((candidate, index): LearningCandidate => {
    if (!isObject(candidate)) throw new Error(`Candidato ${index + 1} inválido`);
    const candidateKind = requiredString(candidate.candidateKind, "tipo") as LearningCandidateKind;
    const memoryType = requiredString(candidate.memoryType, "memoria") as LearningMemoryType;
    if (!candidateKinds.has(candidateKind) || !memoryTypes.has(memoryType)) throw new Error(`Candidato ${index + 1} fuera del contrato`);
    if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
      throw new Error(`Confianza del candidato ${index + 1} inválida`);
    }
    return {
      candidateId: requiredString(candidate.candidateId, "huella"),
      candidateKind,
      memoryType,
      intention: requiredString(candidate.intention, "título"),
      summary: requiredString(candidate.summary, "contenido"),
      evidence: requiredString(candidate.evidence, "evidencia"),
      confidence: candidate.confidence,
    };
  });
  if (candidates.length > 4) throw new Error("La vista excede cuatro candidatos");
  if (typeof value.inputTokens !== "number" || typeof value.outputTokens !== "number") throw new Error("Conteo de tokens inválido");
  return {
    sourceRecordId: requiredString(value.sourceRecordId, "recuerdo de origen"),
    sourceTitle: requiredString(value.sourceTitle, "título de origen"),
    sourceSha256: requiredSha256(value.sourceSha256, "huella de origen"),
    model: requiredString(value.model, "modelo"),
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
    candidates,
    persisted: false,
  };
}

export function parseLearningCandidateConfirmation(value: unknown): LearningCandidateConfirmation {
  if (!isObject(value)
    || typeof value.recordCount !== "number"
    || !Number.isInteger(value.recordCount)
    || value.recordCount < 1
    || typeof value.alreadyConfirmed !== "boolean"
    || typeof value.auditWritten !== "boolean") {
    throw new Error("Confirmación de aprendizaje inválida");
  }
  return {
    recordId: requiredString(value.recordId, "registro confirmado"),
    recordCount: value.recordCount,
    sourceSha256: requiredSha256(value.sourceSha256, "huella resultante"),
    backupSha256: requiredSha256(value.backupSha256, "huella respaldada"),
    storagePath: requiredString(value.storagePath, "ruta de memoria"),
    alreadyConfirmed: value.alreadyConfirmed,
    auditWritten: value.auditWritten,
  };
}
