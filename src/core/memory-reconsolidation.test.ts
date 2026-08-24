import { describe, expect, it } from "vitest";
import { parseMemoryReconsolidationPreview, parseMemoryReconsolidationResult } from "./memory-reconsolidation";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function lifecycle() {
  return {
    schemaVersion: 1, state: "ready", storagePath: "E:/Alice/data/memory/lifecycle-index-v1.json", sourceSha256: sha("b"), activeRevisionId: null, revisionCount: 0,
    preview: {
      sourceSha256: sha("b"), recordCount: 1, currentCount: 1, conflictCount: 0, archivedCount: 0, notAssessedCount: 0,
      accessibilityAssessedCount: 0, accessibleCount: 0, dormantCount: 0, retrievalEligibleCount: 1, retrievalBlockedCount: 0,
      retrievalOutcomeCount: 0, functionalAssessmentCount: 0, weakeningReviewRequiredCount: 0, retentionAssessedCount: 0, suppressedCount: 0, reconsolidatedCount: 1,
      references: [{ recordId: "memory", recordSha256: sha("d"), validity: "current", accessibility: "notAssessed", retrievalPolicy: "eligible", retention: "notAssessed", suppressed: false, baseVersion: 1, reconsolidationCount: 1 }],
      weakeningAssessments: [{ recordId: "memory", helpfulOutcomes: 0, notHelpfulOutcomes: 0, evidenceCount: 0, state: "notAssessed", automaticAction: false }],
      recordsModified: false, contentCopied: false, automaticInference: false,
    },
    blockedReason: null, migrationRequiresConfirmation: true, lifecycleWritesAvailable: true, recordsModified: false,
  };
}

describe("reconsolidación versionada", () => {
  it("acepta una vista previa sin escrituras y con una sola versión sucesora", () => {
    const parsed = parseMemoryReconsolidationPreview({
      schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-23T10:00:00Z", recordId: "memory", reason: "clarification", noteSha256: sha("e"), sourceSha256: sha("f"),
      recordSha256Before: sha("c"), projectedRecordSha256: sha("d"), previousVersion: 1, projectedVersion: 2, changedFields: ["summary"], recordsModified: false, versionWritten: false, automaticAction: false,
    });
    expect(parsed.projectedVersion).toBe(2);
    expect(parsed.recordsModified).toBe(false);
  });

  it("acepta el resultado sólo si el respaldo, ciclo y versión coinciden", () => {
    const parsed = parseMemoryReconsolidationResult({
      schemaVersion: 1, planId: sha("a"), revisionId: sha("9"), recordId: "memory", reason: "clarification", previousVersion: 1, newVersion: 2,
      sourceSha256Before: sha("f"), sourceSha256After: sha("b"), recordSha256Before: sha("c"), recordSha256After: sha("d"), backupSha256: sha("f"), revisionSha256: sha("8"),
      recordsModified: true, versionWritten: true, auditWritten: true, lifecycle: lifecycle(),
    });
    expect(parsed.lifecycle.preview?.reconsolidatedCount).toBe(1);
  });

  it("rechaza saltos de versión y resultados sin historial", () => {
    expect(() => parseMemoryReconsolidationPreview({
      schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-23T10:00:00Z", recordId: "memory", reason: "newContext", noteSha256: sha("e"), sourceSha256: sha("f"),
      recordSha256Before: sha("c"), projectedRecordSha256: sha("d"), previousVersion: 1, projectedVersion: 3, changedFields: ["summary"], recordsModified: false, versionWritten: false, automaticAction: false,
    })).toThrow();
    const invalid = { schemaVersion: 1, planId: sha("a"), revisionId: sha("9"), recordId: "memory", reason: "clarification", previousVersion: 1, newVersion: 2, sourceSha256Before: sha("f"), sourceSha256After: sha("b"), recordSha256Before: sha("c"), recordSha256After: sha("d"), backupSha256: sha("f"), revisionSha256: sha("8"), recordsModified: true, versionWritten: false, auditWritten: true, lifecycle: lifecycle() };
    expect(() => parseMemoryReconsolidationResult(invalid)).toThrow();
  });
});
