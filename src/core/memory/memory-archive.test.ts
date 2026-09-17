import { describe, expect, it } from "vitest";
import { parseMemoryArchivePreview, parseMemoryArchiveResult } from "./memory-archive";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const reference = (archived: boolean) => ({ recordId: "memory", recordSha256: sha("d"), validity: "current", accessibility: "accessible", retrievalPolicy: archived ? "blockedByArchive" : "eligible", retention: "notAssessed", suppressed: false, archived, baseVersion: 1, reconsolidationCount: 0 });
const lifecycle = (archived: boolean) => ({
  schemaVersion: 1, state: "ready", storagePath: "E:/Alice/data/memory/lifecycle-index-v1.json", sourceSha256: sha("b"), activeRevisionId: null, revisionCount: 0,
  preview: { sourceSha256: sha("b"), recordCount: 1, currentCount: 1, conflictCount: 0, archivedCount: archived ? 1 : 0, notAssessedCount: 0, accessibilityAssessedCount: 1, accessibleCount: 1, dormantCount: 0, retrievalEligibleCount: archived ? 0 : 1, retrievalBlockedCount: archived ? 1 : 0, retrievalOutcomeCount: 0, functionalAssessmentCount: 0, weakeningReviewRequiredCount: 0, retentionAssessedCount: 0, suppressedCount: 0, reconsolidatedCount: 0, references: [reference(archived)], weakeningAssessments: [{ recordId: "memory", helpfulOutcomes: 0, notHelpfulOutcomes: 0, evidenceCount: 0, state: "notAssessed", automaticAction: false }], recordsModified: false, contentCopied: false, automaticInference: false },
  blockedReason: null, migrationRequiresConfirmation: true, lifecycleWritesAvailable: true, recordsModified: false,
});

describe("archivo reversible de memoria", () => {
  it("acepta una vista previa sin escrituras", () => {
    const parsed = parseMemoryArchivePreview({ schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-23T12:00:00Z", recordId: "memory", action: "archive", reason: "ownerChoice", noteSha256: sha("e"), sourceSha256: sha("f"), recordSha256Before: sha("c"), projectedRecordSha256: sha("d"), previousArchived: false, projectedArchived: true, recordsModified: false, automaticAction: false });
    expect(parsed.projectedArchived).toBe(true);
  });

  it("acepta un resultado restaurado sólo con respaldo y ciclo coincidentes", () => {
    const parsed = parseMemoryArchiveResult({ schemaVersion: 1, planId: sha("a"), recordId: "memory", action: "restore", reason: "relevantAgain", previousArchived: true, newArchived: false, sourceSha256Before: sha("f"), sourceSha256After: sha("b"), recordSha256Before: sha("c"), recordSha256After: sha("d"), backupSha256: sha("f"), recordsModified: true, auditWritten: true, lifecycle: lifecycle(false) });
    expect(parsed.newArchived).toBe(false);
  });

  it("acepta un resultado archivado sin confundirlo con pérdida de vigencia", () => {
    const parsed = parseMemoryArchiveResult({ schemaVersion: 1, planId: sha("a"), recordId: "memory", action: "archive", reason: "noLongerRelevant", previousArchived: false, newArchived: true, sourceSha256Before: sha("f"), sourceSha256After: sha("b"), recordSha256Before: sha("c"), recordSha256After: sha("d"), backupSha256: sha("f"), recordsModified: true, auditWritten: true, lifecycle: lifecycle(true) });
    expect(parsed.lifecycle.preview?.references[0]).toMatchObject({ validity: "current", archived: true, retrievalPolicy: "blockedByArchive" });
  });

  it("rechaza restauración con motivo de archivo y transiciones ficticias", () => {
    expect(() => parseMemoryArchivePreview({ schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-23T12:00:00Z", recordId: "memory", action: "restore", reason: "ownerChoice", noteSha256: sha("e"), sourceSha256: sha("f"), recordSha256Before: sha("c"), projectedRecordSha256: sha("d"), previousArchived: true, projectedArchived: false, recordsModified: false, automaticAction: false })).toThrow();
  });
});
