export type PayloadMessage = { role: "user" | "assistant"; text: string };
export type PayloadMemory = {
  studyLearning?: boolean;
  automaticLearning?: boolean;
  ownerReviewed?: boolean;
  kind?: string;
  intention: string;
  summary?: string;
  nextStep?: string;
  memoryType?: "semantic" | "procedural" | "preference" | "episodic";
  source?: string;
};
export type PayloadWindow = { windowTitle: string; processName: string };

export type CloudPayloadInput = {
  draft: string;
  includeHistory: boolean;
  includeAssistantDialogue?: boolean;
  recentHistory: PayloadMessage[];
  includeMemory: boolean;
  memories: PayloadMemory[];
  includeWindow: boolean;
  observationEnabled: boolean;
  foregroundContext: PayloadWindow | null;
};

export type CloudPayloadFragmentId = "history" | "memory" | "window" | "message";

export type CloudPayloadFragmentBudget = {
  id: CloudPayloadFragmentId;
  label: string;
  optional: boolean;
  included: boolean;
  characters: number;
  utf8Bytes: number;
};

export type CloudPayloadBudget = {
  fragments: CloudPayloadFragmentBudget[];
  separatorCharacters: number;
  separatorUtf8Bytes: number;
  totalCharacters: number;
  totalUtf8Bytes: number;
};

export type CloudPayloadReview = {
  payload: string;
  budget: CloudPayloadBudget;
};

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length;
const characters = (value: string) => Array.from(value).length;

function fragment(id: CloudPayloadFragmentId, label: string, optional: boolean, content: string | null) {
  return { id, label, optional, content };
}

function memoryEvidenceLabel(memory: PayloadMemory) {
  if (memory.kind === "Perfil") return "PERFIL CONFIRMADO POR CARLOS";
  if (memory.kind === "Conversación" || memory.memoryType === "episodic") return "EPISODIO DE CONVERSACIÓN · NO ES UN HECHO VERIFICADO";
  if (memory.memoryType === "semantic") return "HECHO ENSEÑADO Y CONFIRMADO";
  if (memory.memoryType === "preference") return "PREFERENCIA CONFIRMADA";
  if (memory.memoryType === "procedural") return "PROCEDIMIENTO EN MEMORIA · NO AUTORIZA EJECUCIÓN";
  return "RECUERDO LOCAL";
}

function formatMemory(memory: PayloadMemory) {
  if (memory.studyLearning) {
    return `- [AUTOESTUDIO · FUENTE CURADA · COMPRENSIÓN COMPROBADA EN UN EJERCICIO · NO DECLARACIÓN DEL PROPIETARIO] ${memory.intention}: ${memory.summary || "sin resumen"}. Fuente: ${memory.source || "fuente no disponible"}. El ejercicio aprobado no garantiza dominio general ni verifica todos los hechos de la fuente.`;
  }
  if (memory.automaticLearning) {
    return `- [${memory.ownerReviewed ? "CORRECCIÓN DEL PROPIETARIO" : "DECLARACIÓN DE CARLOS · SELECCIÓN AUTOMÁTICA · SIN REVISIÓN MANUAL"}] Carlos declaró: ${memory.summary || memory.intention}. Fuente: ${memory.source || "conversación local"}`;
  }
  const source = memory.source ? ` · Fuente: ${memory.source}` : "";
  if (memory.kind === "Conversación") {
    return `- [${memoryEvidenceLabel(memory)}] Carlos dijo o preguntó: ${memory.intention}. La respuesta histórica del modelo no se incorpora como conocimiento.${source}`;
  }
  return `- [${memoryEvidenceLabel(memory)}] ${memory.intention}: ${memory.summary || "sin resumen"}${memory.nextStep ? ` · Próximo paso: ${memory.nextStep}` : ""}${source}`;
}

// Devuelve la cadena exacta y un presupuesto Unicode/UTF-8 derivado de esa misma
// composición. No estima tokens: esa tokenización depende del proveedor y modelo.
export function buildCloudPayloadReview(input: CloudPayloadInput): CloudPayloadReview {
  // Las respuestas previas sólo regresan como diálogo cuando el modo de voz lo
  // solicita; nunca se presentan como evidencia factual ni como recuerdos RAG.
  const ownerHistory = input.recentHistory.filter((item) => item.role === "user");
  const history = input.includeAssistantDialogue ? input.recentHistory : ownerHistory;
  const historyText = input.includeAssistantDialogue
    ? `DIÁLOGO RECIENTE AUTORIZADO · LAS RESPUESTAS DE ALICE NO SON EVIDENCIA FACTUAL\n${history.map(item => `${item.role === "user" ? "Carlos" : "Alice (respuesta anterior no verificada)"}: ${item.text}`).join("\n")}`
    : `HISTORIAL LOCAL AUTORIZADO · SOLO MENSAJES DEL PROPIETARIO\n${ownerHistory.map(item => `Carlos Nuñez: ${item.text}`).join("\n")}`;
  const fragments = [
    fragment("history", "Historial reciente", true, input.includeHistory && history.length ? historyText : null),
    fragment("memory", "Recuerdos relevantes", true, input.includeMemory && input.memories.length
      ? `RECUERDOS LOCALES RECUPERADOS Y AUTORIZADOS\n${input.memories.map(formatMemory).join("\n")}`
      : null),
    fragment("window", "Ventana actual", true, input.includeWindow && input.observationEnabled && input.foregroundContext
      ? `VENTANA AUTORIZADA\nPrograma: ${input.foregroundContext.processName}\nTítulo: ${input.foregroundContext.windowTitle}`
      : null),
    fragment("message", "Mensaje actual", false, `MENSAJE ACTUAL\nCarlos Nuñez → Alice:\n${input.draft.trim()}`),
  ];
  const included = fragments.filter((item) => item.content !== null);
  const payload = included.map((item) => item.content).join("\n\n");
  const separator = "\n\n".repeat(Math.max(0, included.length - 1));

  return {
    payload,
    budget: {
      fragments: fragments.map((item) => ({
        id: item.id,
        label: item.label,
        optional: item.optional,
        included: item.content !== null,
        characters: item.content === null ? 0 : characters(item.content),
        utf8Bytes: item.content === null ? 0 : utf8Bytes(item.content),
      })),
      separatorCharacters: characters(separator),
      separatorUtf8Bytes: utf8Bytes(separator),
      totalCharacters: characters(payload),
      totalUtf8Bytes: utf8Bytes(payload),
    },
  };
}

// Compone solamente las secciones que el usuario autorizó explícitamente.
export function buildCloudPayload(input: CloudPayloadInput): string {
  return buildCloudPayloadReview(input).payload;
}
