import { describe, expect, it } from "vitest";
import { parseConsolidationPreview } from "./memory-consolidation-preview";

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;
function validSnapshot() {
  return {
    schemaVersion: 1,
    state: "ready",
    storagePath: "E:\\Alice Cognitive Core\\data\\memory\\records.json",
    sourceSha256: sha("a"),
    recordCount: 3,
    eligibleRecordCount: 3,
    archivedRecordCount: 0,
    candidateCount: 2,
    exactDuplicateCount: 1,
    reviewRequiredCount: 1,
    candidates: [
      { candidateId: sha("b"), kind: "exactDuplicate", recordIds: ["a", "b"], reasonCode: "exactNormalizedContent", requiresHumanReview: true },
      { candidateId: sha("c"), kind: "reviewRequired", recordIds: ["a", "c"], reasonCode: "sameNormalizedIntentionDifferentContent", requiresHumanReview: true },
    ],
    blockedReason: null,
    automaticMerge: false,
    recordsModified: false,
    modelUsed: false,
  };
}

describe("vista previa R6.3", () => {
  it("acepta candidatos cerrados y sin efectos", () => {
    const parsed = parseConsolidationPreview(validSnapshot());
    expect(parsed.exactDuplicateCount).toBe(1);
    expect(parsed.reviewRequiredCount).toBe(1);
    expect(parsed.candidates.every((item) => item.requiresHumanReview)).toBe(true);
  });

  it("rechaza conteos, campos y clasificaciones incoherentes", () => {
    expect(() => parseConsolidationPreview({ ...validSnapshot(), candidateCount: 3 })).toThrow();
    expect(() => parseConsolidationPreview({ ...validSnapshot(), automaticMerge: true })).toThrow();
    expect(() => parseConsolidationPreview({ ...validSnapshot(), unknown: true })).toThrow();
    const mismatched = validSnapshot();
    mismatched.candidates[0].kind = "reviewRequired";
    expect(() => parseConsolidationPreview(mismatched)).toThrow();
  });

  it("acepta ausencia honesta y exige una razón al bloquear", () => {
    const empty = validSnapshot();
    Object.assign(empty, { state: "unavailable", sourceSha256: null, recordCount: 0, eligibleRecordCount: 0, candidateCount: 0, exactDuplicateCount: 0, reviewRequiredCount: 0, candidates: [] });
    expect(parseConsolidationPreview(empty).state).toBe("unavailable");
    expect(() => parseConsolidationPreview({ ...empty, state: "blocked" })).toThrow();
    expect(parseConsolidationPreview({ ...empty, state: "blocked", blockedReason: "Fuente inválida" }).blockedReason).toBe("Fuente inválida");
  });
});
