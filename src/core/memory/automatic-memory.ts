export type AutomaticMemoryRecord = {
  id: string;
  evidence: string;
  content: string;
  memoryType: "semantic" | "preference" | "episodic" | "procedural";
  importance: number;
  reason: "personalFact" | "taughtKnowledge" | "taughtProcedure" | "stablePreference" | "conversationPreference" | "importantExperience";
  sourceExchangeId: string;
  sourceSha256: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  ownerCorrected: boolean;
  revisions: string[];
};
export type AutomaticMemorySnapshot = {
  schemaVersion: 1;
  enabled: boolean;
  records: AutomaticMemoryRecord[];
  lastOutcome: string | null;
  activeCount: number;
};
export type AutomaticMemoryReview = { id: string; action: "withdraw" | "restore" | "correct"; content?: string };
export type AutomaticLearningPhase = "idle" | "evaluating" | "error";

export function parseAutomaticMemorySnapshot(value: unknown): AutomaticMemorySnapshot {
  const input = value as AutomaticMemorySnapshot;
  if (!input || input.schemaVersion !== 1 || typeof input.enabled !== "boolean" || !Array.isArray(input.records)
    || input.records.length > 2000 || !Number.isSafeInteger(input.activeCount)) throw Error("La memoria automática no tiene un formato válido.");
  const ids = new Set<string>();
  for (const r of input.records) {
    if (!r || typeof r.id !== "string" || ids.has(r.id) || !/^[0-9a-f-]{36}$/i.test(r.id)
      || typeof r.content !== "string" || !r.content.trim() || Array.from(r.content).length > 1000
      || typeof r.evidence !== "string" || !r.evidence.trim() || Array.from(r.evidence).length > 320
      || !["semantic", "preference", "episodic", "procedural"].includes(r.memoryType) || !Number.isInteger(r.importance) || r.importance < 1 || r.importance > 5
      || !["personalFact", "taughtKnowledge", "taughtProcedure", "stablePreference", "conversationPreference", "importantExperience"].includes(r.reason)
      || typeof r.active !== "boolean" || typeof r.ownerCorrected !== "boolean"
      || !/^[0-9a-f-]{36}$/i.test(r.sourceExchangeId) || !/^sha256:[0-9a-f]{64}$/i.test(r.sourceSha256)
      || !Number.isFinite(Date.parse(r.createdAt)) || !Number.isFinite(Date.parse(r.updatedAt))
      || !Array.isArray(r.revisions) || r.revisions.some(s => typeof s !== "string")) throw Error("La memoria automática contiene un registro inválido.");
    ids.add(r.id);
  }
  if (input.activeCount !== input.records.filter(r => r.active).length) throw Error("El conteo de memoria automática no coincide.");
  return input;
}

export function automaticMemoryForConversation(snapshot: AutomaticMemorySnapshot | null) {
  return (snapshot?.records ?? []).map(r => ({
    id: r.id, kind: "Enseñanza" as const,
    intention: Array.from(r.content).slice(0, 84).join("") + (Array.from(r.content).length > 84 ? "…" : ""),
    summary: r.content, memoryType: r.memoryType, importance: r.importance,
    startedAt: r.createdAt, finishedAt: r.createdAt,
    source: `${r.ownerCorrected ? "Corregido por Carlos" : "Selección automática de Alice · declaración literal de Carlos"} · ${r.updatedAt} · intercambio ${r.sourceExchangeId}`,
    automaticLearning: true,
    accessibilityStatus: "accessible" as const,
    conversationExchangeId: r.sourceExchangeId,
    ownerReviewed: r.ownerCorrected,
    archiveStatus: r.active ? undefined : "archived" as const,
  }));
}
