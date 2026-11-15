import { describe, expect, it } from "vitest";
import { memoryOrigin, memoryOriginLabel, memoryReviewProposal } from "./memory-review-proposals";

describe("memory review proposals", () => {
  it("separates an observed episode from a direct teaching", () => {
    const record = { kind: "Enseñanza", memoryType: "episodic", source: "Pantalla compartida · Ollama local" };
    expect(memoryOrigin(record)).toBe("observation");
    expect(memoryOriginLabel(record)).toBe("OBSERVACIÓN · ENTORNO");
    expect(memoryReviewProposal(record)?.label).toBe("ORIGEN POR RECLASIFICAR");
  });

  it("does not interpret confirmed as verified model content", () => {
    const proposal = memoryReviewProposal({ kind: "Conversación", memoryType: "episodic", memoryStatus: "confirmed", summary: "Una respuesta técnica." });
    expect(proposal).toEqual(expect.objectContaining({ label: "CONTENIDO NO CERTIFICADO", state: "review" }));
  });

  it("detects unresolved answers while preserving stronger lifecycle states", () => {
    expect(memoryReviewProposal({ kind: "Conversación", summary: "Necesito un poco más de contexto." })?.label).toBe("REVISAR REPOSO");
    expect(memoryReviewProposal({ kind: "Conversación", memoryStatus: "conflict", summary: "Necesito contexto." })?.state).toBe("blocked");
    expect(memoryReviewProposal({ kind: "Conversación", suppressionStatus: "suppressed" })?.state).toBe("protected");
  });
});
