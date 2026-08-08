export type PayloadMessage = { role: "user" | "assistant"; text: string };
export type PayloadMemory = { intention: string; summary?: string; nextStep?: string };
export type PayloadWindow = { windowTitle: string; processName: string };

type CloudPayloadInput = {
  draft: string;
  includeHistory: boolean;
  recentHistory: PayloadMessage[];
  includeMemory: boolean;
  memories: PayloadMemory[];
  includeWindow: boolean;
  observationEnabled: boolean;
  foregroundContext: PayloadWindow | null;
};

// Compone solamente las secciones que el usuario autorizó explícitamente.
export function buildCloudPayload(input: CloudPayloadInput): string {
  const sections: string[] = [];
  if (input.includeHistory && input.recentHistory.length) {
    sections.push(`HISTORIAL LOCAL AUTORIZADO\n${input.recentHistory.map((item) => `${item.role === "user" ? "Enrique" : "Alice"}: ${item.text}`).join("\n")}`);
  }
  if (input.includeMemory && input.memories.length) {
    sections.push(`RECUERDOS LOCALES RECUPERADOS Y AUTORIZADOS\n${input.memories.map((item) => `- ${item.intention}: ${item.summary || "sin resumen"}${item.nextStep ? ` · Próximo paso: ${item.nextStep}` : ""}`).join("\n")}`);
  }
  if (input.includeWindow && input.observationEnabled && input.foregroundContext) {
    sections.push(`VENTANA AUTORIZADA\nPrograma: ${input.foregroundContext.processName}\nTítulo: ${input.foregroundContext.windowTitle}`);
  }
  sections.push(`MENSAJE ACTUAL\n${input.draft.trim()}`);
  return sections.join("\n\n");
}
