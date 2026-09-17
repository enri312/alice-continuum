import { describe, expect, it } from "vitest";
import { parseConsolidationMergePreview, parseConsolidationPreview, parseConsolidationRecoveryStatus, parseConsolidationResolutionResult, parseConsolidationRestorationResult } from "./memory-consolidation-preview";

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

function validMergePreview() {
  return {
    schemaVersion: 4,
    sourceSha256: sha("a"),
    candidateId: sha("b"),
    candidateKind: "exactDuplicate",
    reasonCode: "exactNormalizedContent",
    recordIds: ["a", "b"],
    survivorRecordId: "a",
    duplicateRecordId: "b",
    currentRecordCount: 3,
    projectedRecordCount: 2,
    projectedSourceSha256: sha("e"),
    projectedSourceByteLength: 2048,
    normalizedContentEqual: true,
    differingFields: ["intention", "startedAt", "source"],
    sourceBackupPath: "E:\\data\\memory\\backups\\consolidation-source.json",
    sourceBackupStatus: "missing",
    layerImpact: "absent",
    activeLayerRevisionId: null,
    recoveryProtocolVersion: 1,
    recoverySteps: ["verifySource", "createOrVerifyBackup", "prepareProjectedSource", "atomicReplace", "verifyProjectedSource", "writeAudit", "restoreBackupOnFailure", "verifyRestoredSource"],
    byteExactBackupRequired: true,
    atomicReplaceRequired: true,
    auditRequired: true,
    restoredSourceVerificationRequired: true,
    activeLayerExecutionBlocked: false,
    transactionReceiptVersion: 1,
    transactionReceiptFile: "consolidation-merge-transactions-v1.json",
    durableReceiptRequired: true,
    restartRecoveryRequired: true,
    executionAvailable: false,
    requiresFinalConfirmation: true,
    restorationCommandAvailable: true,
    recordsModified: false,
    filesCreated: false,
    auditWritten: false,
    modelUsed: false,
  };
}

function validRecoveryStatus() {
  return {
    schemaVersion: 1,
    state: "recoveryRequired",
    receiptPath: "E:\\data\\memory\\consolidation-merge-transactions-v1.json",
    receiptFileExists: true,
    transactionCount: 1,
    receipt: {
      transactionId: sha("1"),
      candidateId: sha("2"),
      sourceSha256: sha("3"),
      projectedSourceSha256: sha("4"),
      sourceBackupFile: `consolidation-source-${"3".repeat(64)}.json`,
      state: "projected",
      createdAt: "2026-08-20T20:00:00Z",
      restoredAt: null,
    },
    sourceRelation: "projected",
    currentSourceSha256: sha("4"),
    blockedReason: null,
    restorationAvailable: true,
    restorationRequiresConfirmation: true,
    automaticRecovery: false,
    mergeExecutionAvailable: false,
    recordsModified: false,
    filesCreated: false,
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

  it("valida una vista R6.3-C cerrada y sin ejecución", () => {
    const parsed = parseConsolidationMergePreview(validMergePreview());
    expect(parsed.survivorRecordId).toBe("a");
    expect(parsed.projectedRecordCount).toBe(2);
    expect(parsed.differingFields).toEqual(["intention", "startedAt", "source"]);
    expect(parsed.recoverySteps).toHaveLength(8);
    expect(parsed.transactionReceiptFile).toBe("consolidation-merge-transactions-v1.json");
    expect(parsed.executionAvailable).toBe(false);
  });

  it("rechaza efectos, selección o impacto de capas incoherentes en R6.3-C", () => {
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), recordsModified: true })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), survivorRecordId: "c" })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), differingFields: ["source", "source"] })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), layerImpact: "activeRevisionWillBecomeStale" })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), recoverySteps: ["verifySource", "writeAudit"] })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), atomicReplaceRequired: false })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), restartRecoveryRequired: false })).toThrow();
    expect(() => parseConsolidationMergePreview({ ...validMergePreview(), restorationCommandAvailable: false })).toThrow();
    expect(parseConsolidationMergePreview({ ...validMergePreview(), layerImpact: "activeRevisionWillBecomeStale", activeLayerRevisionId: sha("f"), activeLayerExecutionBlocked: true }).activeLayerRevisionId).toBe(sha("f"));
  });

  it("valida el estado nativo R6.3-F sin atribuir una fusión ejecutable", () => {
    const pending = parseConsolidationRecoveryStatus(validRecoveryStatus());
    expect(pending.state).toBe("recoveryRequired");
    expect(pending.sourceRelation).toBe("projected");
    expect(pending.restorationAvailable).toBe(true);
    expect(pending.mergeExecutionAvailable).toBe(false);

    const restoredStatus = {
      ...validRecoveryStatus(),
      state: "restored",
      receipt: { ...validRecoveryStatus().receipt, state: "restored", restoredAt: "2026-08-20T20:05:00Z" },
      sourceRelation: "original",
      currentSourceSha256: sha("3"),
      restorationAvailable: false,
    };
    expect(parseConsolidationRecoveryStatus(restoredStatus).state).toBe("restored");
    expect(parseConsolidationRestorationResult({ schemaVersion: 1, transactionId: sha("1"), sourceSha256: sha("3"), sourceRestored: true, auditWritten: true, alreadyRestored: false, receiptState: "restored", status: restoredStatus }).status.restorationAvailable).toBe(false);
  });

  it("bloquea estados R6.3-F corruptos, divergentes o con efectos inventados", () => {
    expect(() => parseConsolidationRecoveryStatus({ ...validRecoveryStatus(), currentSourceSha256: sha("5") })).toThrow();
    expect(() => parseConsolidationRecoveryStatus({ ...validRecoveryStatus(), automaticRecovery: true })).toThrow();
    expect(() => parseConsolidationRecoveryStatus({ ...validRecoveryStatus(), mergeExecutionAvailable: true })).toThrow();
    expect(() => parseConsolidationRecoveryStatus({ ...validRecoveryStatus(), receipt: { ...validRecoveryStatus().receipt, sourceBackupFile: "..\\records.json" } })).toThrow();
    expect(parseConsolidationRecoveryStatus({ ...validRecoveryStatus(), state: "blocked", sourceRelation: "diverged", currentSourceSha256: sha("5"), blockedReason: "Huella desconocida", restorationAvailable: false }).state).toBe("blocked");
  });
});
