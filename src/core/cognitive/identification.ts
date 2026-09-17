export type IdentificationSource = "draft" | "last-user-message" | "none";
export type EvidenceKind = "observed" | "heuristic" | "unavailable";

export type IdentificationField = {
  label: string;
  value: string;
  evidence: EvidenceKind;
  detail: string;
};

export type SocialHypothesis = {
  id: "cooperation" | "correction" | "uncertainty";
  label: string;
  score: number | null;
  matches: string[];
};

export type IdentificationSnapshot = {
  source: IdentificationSource;
  input: string;
  tokens: string[];
  intent: string;
  intentConfidence: number | null;
  intentMatches: string[];
  fields: IdentificationField[];
  hypotheses: SocialHypothesis[];
};

export type IdentificationInputs = {
  draft: string;
  lastUserMessage?: string;
  messageCount: number;
  memoryCount: number;
  retrievedMemoryCount: number;
  observerEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  cloudPending: boolean;
};

const questionWords = new Set(["como", "cuando", "cual", "cuales", "donde", "por", "porque", "que", "quien"]);
const correctionWords = new Set(["error", "falla", "fallo", "falló", "incorrecto", "no", "pero", "revisar", "salio", "salió"]);
const instructionWords = new Set(["agrega", "añade", "construye", "crea", "haz", "modifica", "procede"]);
const friendlyWords = new Set(["amigo", "amiga", "broma", "conmigo", "gracias", "juntos", "tranquilo", "tranquila"]);
const cooperationWords = new Set(["hagamos", "juntos", "podemos", "procedamos", "seguimos", "vamos"]);
const uncertaintyWords = new Set(["creo", "duda", "parece", "quizas", "quizás", "tal", "vez"]);

function normalized(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchedTokens(tokens: string[], dictionary: Set<string>) {
  const matches = tokens.filter((token) => dictionary.has(normalized(token)));
  return [...new Set(matches.map(normalized))];
}

export function tokenizeIdentificationInput(value: string, limit = 32) {
  return (value.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).slice(0, limit);
}

function classifyIntent(input: string, tokens: string[]) {
  if (!tokens.length) return { intent: "SIN_ENTRADA", confidence: null, matches: [] as string[] };

  const questionMatches = matchedTokens(tokens, questionWords);
  const correctionMatches = matchedTokens(tokens, correctionWords);
  const instructionMatches = matchedTokens(tokens, instructionWords);
  const friendlyMatches = matchedTokens(tokens, friendlyWords);
  const questionEvidence = input.includes("?") ? ["?"] : questionMatches;

  const candidates = [
    { intent: "CONSULTA", matches: questionEvidence, threshold: 1 },
    { intent: "AJUSTE / REVISIÓN", matches: correctionMatches, threshold: 2 },
    { intent: "INSTRUCCIÓN", matches: instructionMatches, threshold: 1 },
    { intent: "FRIENDLY", matches: friendlyMatches, threshold: 1 },
  ].filter((candidate) => candidate.matches.length >= candidate.threshold)
    .sort((left, right) => right.matches.length - left.matches.length);

  const winner = candidates[0];
  if (!winner) return { intent: "NO_CLASIFICADO", confidence: null, matches: [] as string[] };

  return {
    intent: winner.intent,
    confidence: Math.min(.95, .55 + winner.matches.length * .1),
    matches: winner.matches,
  };
}

function evidenceScore(matches: string[], denominator: number) {
  return Math.min(1, matches.length / denominator);
}

export function buildIdentificationSnapshot(inputs: IdentificationInputs): IdentificationSnapshot {
  const draft = inputs.draft.trim();
  const lastUserMessage = inputs.lastUserMessage?.trim() ?? "";
  const source: IdentificationSource = draft ? "draft" : lastUserMessage ? "last-user-message" : "none";
  const input = source === "draft" ? draft : source === "last-user-message" ? lastUserMessage : "";
  const tokens = tokenizeIdentificationInput(input);
  const classification = classifyIntent(input, tokens);
  const cooperationMatches = matchedTokens(tokens, cooperationWords);
  const correctionMatches = matchedTokens(tokens, correctionWords);
  const uncertaintyMatches = matchedTokens(tokens, uncertaintyWords);

  const sourceValue = source === "draft" ? "BORRADOR_LOCAL" : source === "last-user-message" ? "ÚLTIMO_USUARIO" : "SIN_ENTRADA";
  const speakerValue = input ? "USUARIO_LOCAL" : "NO_IDENTIFICADO";

  return {
    source,
    input,
    tokens,
    intent: classification.intent,
    intentConfidence: classification.confidence,
    intentMatches: classification.matches,
    fields: [
      { label: "SOURCE", value: sourceValue, evidence: "observed", detail: "Origen exacto del texto real activo mostrado" },
      { label: "SPEAKER", value: speakerValue, evidence: "observed", detail: "Rol de conversación local; identidad personal aún no conectada" },
      { label: "INTENT TOP-1", value: classification.intent, evidence: classification.confidence === null ? "unavailable" : "heuristic", detail: classification.matches.length ? `Reglas activadas: ${classification.matches.join(", ")}` : "Sin evidencia suficiente para asignar intención" },
      { label: "INTENT CONF", value: classification.confidence === null ? "N/D" : classification.confidence.toFixed(2), evidence: classification.confidence === null ? "unavailable" : "heuristic", detail: "Índice de coincidencia de reglas; no es probabilidad de un modelo" },
    ],
    hypotheses: [
      { id: "cooperation", label: "COOPERACIÓN", score: input ? evidenceScore(cooperationMatches, 3) : null, matches: cooperationMatches },
      { id: "correction", label: "CORRECCIÓN", score: input ? evidenceScore(correctionMatches, 4) : null, matches: correctionMatches },
      { id: "uncertainty", label: "INCERTIDUMBRE", score: input ? evidenceScore(uncertaintyMatches, 3) : null, matches: uncertaintyMatches },
    ],
  };
}
