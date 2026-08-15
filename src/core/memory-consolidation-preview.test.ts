import { describe, expect, it } from "vitest";
import { parseConsolidationPreview, parseConsolidationResolutionResult } from "./memory-consolidation-preview";

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;
function validSnapshot() {
  return {
    schemaVersion: 2,
    state: "ready",
    storagePath: "E:\\Alice Cognitive Core\\data\\memory\\records.json",
    sourceSha256: sha("a"),
    recordCount: 3,
    eligibleRecordCount: 3,
    archivedRecordCount: 0,
    candidateCount: 2,
    pendingCandidateCount: 1,
    keptSeparateCount: 1,
    exactDuplicateCount: 1,
    reviewRequiredCount: 1,
    candidates: [
      { candidateId: sha("b"), kind: "exactDuplicate", recordIds: ["a", "b"], reasonCode: "exactNormalizedContent", requiresHumanReview: true, resolution: null, decisionId: null },
      { candidateId: sha("c"), kind: "reviewRequired", recordIds: ["a", "c"], reasonCode: "sameNormalizedIntentionDifferentContent", requiresHumanReview: true, resolution: "keepSeparate", decisionId: sha("d") },
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
    expect(parsed.keptSeparateCount).toBe(1);
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
    Object.assign(empty, { state: "unavailable", sourceSha256: null, recordCount: 0, eligibleRecordCount: 0, candidateCount: 0, pendingCandidateCount: 0, keptSeparateCount: 0, exactDuplicateCount: 0, reviewRequiredCount: 0, candidates: [] });
    expect(parseConsolidationPreview(empty).state).toBe("unavailable");
    expect(() => parseConsolidationPreview({ ...empty, state: "blocked" })).toThrow();
    expect(parseConsolidationPreview({ ...empty, state: "blocked", blockedReason: "Fuente inválida" }).blockedReason).toBe("Fuente inválida");
  });

  it("valida una resolución mantener-separados contra la vista releída", () => {
    const preview = validSnapshot();
    const result = {
      schemaVersion: 1,
      decision: { decisionId: sha("d"), candidateId: sha("c"), sourceSha256: sha("a"), candidateKind: "reviewRequired", reasonCode: "sameNormalizedIntentionDifferentContent", recordIds: ["a", "c"], action: "keepSeparate", decidedAt: "2026-08-15T15:00:00Z" },
      sourceBackupPath: "E:\\data\\memory\\backups\\source.json",
      ledgerPath: "E:\\data\\memory\\consolidation-decisions-v1.json",
      backupCreated: true,
      recordsModified: false,
      modelUsed: false,
      preview,
    };
    expect(parseConsolidationResolutionResult(result).decision.action).toBe("keepSeparate");
    expect(() => parseConsolidationResolutionResult({ ...result, recordsModified: true })).toThrow();
    expect(() => parseConsolidationResolutionResult({ ...result, decision: { ...result.decision, candidateId: sha("e") } })).toThrow();
  });
});
