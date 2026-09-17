export type PayloadMessage = { role: "user" | "assistant"; text: string };
export type PayloadMemory = {
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
  const source = memory.source ? ` · Fuente: ${memory.source}` : "";
  if (memory.kind === "Conversación") {
    return `- [${memoryEvidenceLabel(memory)}] Carlos dijo o preguntó: ${memory.intention}. La respuesta histórica del modelo no se incorpora como conocimiento.${source}`;
  }
  return `- [${memoryEvidenceLabel(memory)}] ${memory.intention}: ${memory.summary || "sin resumen"}${memory.nextStep ? ` · Próximo paso: ${memory.nextStep}` : ""}${source}`;
}

// Devuelve la cadena exacta y un presupuesto Unicode/UTF-8 derivado de esa misma
// composición. No estima tokens: esa tokenización depende del proveedor y modelo.
export function buildCloudPayloadReview(input: CloudPayloadInput): CloudPayloadReview {
  // Las respuestas previas del modelo siguen visibles en la interfaz y en el
  // historial local, pero no vuelven a entrar al prompt como supuesta evidencia.
  const ownerHistory = input.recentHistory.filter((item) => item.role === "user");
  const fragments = [
    fragment("history", "Historial reciente", true, input.includeHistory && ownerHistory.length
      ? `HISTORIAL LOCAL AUTORIZADO · SOLO MENSAJES DEL PROPIETARIO\n${ownerHistory.map((item) => `Carlos Nuñez: ${item.text}`).join("\n")}`
      : null),
    fragment("memory", "Recuerdos relevantes", true, input.includeMemory && input.memories.length
      ? `RECUERDOS LOCALES RECUPERADOS Y AUTORIZADOS\n${input.memories.map(formatMemory).join("\n")}`
      : null),
    fragment("window", "Ventana actual", true, input.includeWindow && input.observationEnabled && input.foregroundContext
      ? `VENTANA AUTORIZADA\nPrograma: ${input.foregroundContext.processName}\nTítulo: ${input.foregroundContext.windowTitle}`
      : null),
    fragment("message", "Mensaje actual", false, `MENSAJE ACTUAL\n${input.draft.trim()}`),
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
