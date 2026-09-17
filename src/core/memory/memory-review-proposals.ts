export type ReviewableMemoryRecord = {
  kind: string;
  summary?: string;
  source?: string;
  memoryType?: string;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  suppressionStatus?: "suppressed";
};

export type MemoryOrigin = "conversation" | "observation" | "teaching" | "other";

export type MemoryReviewProposal = {
  state: "blocked" | "protected" | "review";
  label: string;
  reason: string;
};

function normalized(value?: string) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function memoryOrigin(record: ReviewableMemoryRecord): MemoryOrigin {
  if (record.kind === "Conversación") return "conversation";
  const source = normalized(record.source);
  if (record.memoryType === "episodic" && /(pantalla|camara|microfono|observacion)/u.test(source)) return "observation";
  if (record.kind === "Enseñanza") return "teaching";
  return "other";
}

export function memoryOriginLabel(record: ReviewableMemoryRecord) {
  const origin = memoryOrigin(record);
  if (origin === "conversation") return "EPISODIO · CONVERSACIÓN";
  if (origin === "observation") return "OBSERVACIÓN · ENTORNO";
  if (origin === "teaching") return "ENSEÑANZA REGISTRADA";
  return `REGISTRO · ${record.kind.toLocaleUpperCase("es")}`;
}

export function memoryReviewProposal(record: ReviewableMemoryRecord): MemoryReviewProposal | null {
  if (record.memoryStatus === "conflict") return { state: "blocked", label: "CONFLICTO YA REGISTRADO", reason: "Permanece fuera del RAG hasta que el propietario corrija o confirme una versión." };
  if (record.suppressionStatus === "suppressed") return { state: "protected", label: "SUPRESIÓN ACTIVA", reason: "Se conserva como episodio, pero no aparece espontáneamente en la conversación." };
  if (memoryOrigin(record) === "observation" && record.kind === "Enseñanza") return { state: "review", label: "ORIGEN POR RECLASIFICAR", reason: "El contenido proviene de una observación episódica y figura históricamente como enseñanza." };
  if (record.kind !== "Conversación") return null;

  const summary = normalized(record.summary);
  const unresolved = /(necesito (un poco mas de )?contexto|por favor.{0,40}(indica|dime)|podrias aclar|no tengo acceso|sin acceso a herramientas|antes de proceder)/u.test(summary);
  if (unresolved) return { state: "review", label: "REVISAR REPOSO", reason: "La respuesta quedó en aclaración o sin acceso; sirve como episodio, pero puede interferir con respuestas futuras." };
  return { state: "review", label: "CONTENIDO NO CERTIFICADO", reason: "La vigencia del episodio está registrada; las afirmaciones de la respuesta requieren evidencia aparte." };
}
