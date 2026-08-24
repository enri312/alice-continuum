import { describe, expect, it } from "vitest";
import { parseMemoryAccessibilityAssessmentResult, parseMemoryLifecyclePreview, parseMemorySuppressionAssessmentResult, parseMemoryValidityAssessmentResult } from "./memory-lifecycle";

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;

function validSnapshot() {
  return {
    schemaVersion: 1,
    state: "ready",
    storagePath: "E:\\Alice Cognitive Core\\data\\memory\\lifecycle-index-v1.json",
    sourceSha256: sha("a"),
    activeRevisionId: null,
    revisionCount: 0,
    preview: {
      sourceSha256: sha("a"), recordCount: 4, currentCount: 1, conflictCount: 1, archivedCount: 1, notAssessedCount: 1,
      accessibilityAssessedCount: 0, accessibleCount: 0, dormantCount: 0,
      retrievalEligibleCount: 2, retrievalBlockedCount: 2, retentionAssessedCount: 0, suppressedCount: 0, reconsolidatedCount: 0,
      retrievalOutcomeCount: 0, functionalAssessmentCount: 0, weakeningReviewRequiredCount: 0,
      references: [
        { recordId: "current", recordSha256: sha("b"), validity: "current", accessibility: "notAssessed", retrievalPolicy: "eligible", retention: "notAssessed", suppressed: false, archived: false, baseVersion: 1, reconsolidationCount: 0 },
        { recordId: "conflict", recordSha256: sha("c"), validity: "conflict", accessibility: "notAssessed", retrievalPolicy: "blockedByConflict", retention: "notAssessed", suppressed: false, archived: false, baseVersion: 1, reconsolidationCount: 0 },
        { recordId: "archived", recordSha256: sha("d"), validity: "archived", accessibility: "notAssessed", retrievalPolicy: "blockedByArchive", retention: "notAssessed", suppressed: false, archived: true, baseVersion: 1, reconsolidationCount: 0 },
        { recordId: "legacy", recordSha256: sha("e"), validity: "notAssessed", accessibility: "notAssessed", retrievalPolicy: "legacyEligible", retention: "notAssessed", suppressed: false, archived: false, baseVersion: 1, reconsolidationCount: 0 },
      ],
      weakeningAssessments: ["current", "conflict", "archived", "legacy"].map((recordId) => ({ recordId, helpfulOutcomes: 0, notHelpfulOutcomes: 0, evidenceCount: 0, state: "notAssessed", automaticAction: false })),
      recordsModified: false, contentCopied: false, automaticInference: false,
    },
    blockedReason: null,
    migrationRequiresConfirmation: true,
    lifecycleWritesAvailable: true,
    recordsModified: false,
  };
}

describe("vista previa del ciclo funcional de memoria", () => {
  it("acepta una proyección cerrada y completamente trazable", () => {
    const parsed = parseMemoryLifecyclePreview(validSnapshot());
    expect(parsed.preview?.references).toHaveLength(4);
    expect(parsed.preview?.notAssessedCount).toBe(1);
    expect(parsed.lifecycleWritesAvailable).toBe(true);
  });

  it("rechaza estados avanzados inventados o referencias repetidas", () => {
    const inferred = validSnapshot();
    inferred.preview.retentionAssessedCount = 1;
    expect(() => parseMemoryLifecyclePreview(inferred)).toThrow();
    const duplicate = validSnapshot();
    duplicate.preview.references[1].recordId = "current";
    expect(() => parseMemoryLifecyclePreview(duplicate)).toThrow();
  });

  it("separa accesibilidad explícita de vigencia y fuerza", () => {
    const snapshot = validSnapshot();
    snapshot.preview.references[0].accessibility = "dormant";
    snapshot.preview.references[0].retrievalPolicy = "blockedByDormancy";
    snapshot.preview.accessibilityAssessedCount = 1;
    snapshot.preview.dormantCount = 1;
    snapshot.preview.retrievalEligibleCount = 1;
    snapshot.preview.retrievalBlockedCount = 3;
    const parsed = parseMemoryLifecyclePreview(snapshot);
    expect(parsed.preview?.references[0]).toMatchObject({ validity: "current", accessibility: "dormant", retrievalPolicy: "blockedByDormancy" });
  });

  it("evalúa debilitamiento sólo con resultados explícitos y no ejecuta acciones", () => {
    const snapshot = validSnapshot();
    snapshot.preview.weakeningAssessments[0] = { recordId: "current", helpfulOutcomes: 1, notHelpfulOutcomes: 2, evidenceCount: 3, state: "reviewRequired", automaticAction: false };
    snapshot.preview.retrievalOutcomeCount = 3;
    snapshot.preview.functionalAssessmentCount = 1;
    snapshot.preview.weakeningReviewRequiredCount = 1;
    const parsed = parseMemoryLifecyclePreview(snapshot);
    expect(parsed.preview?.weakeningAssessments[0]).toMatchObject({ state: "reviewRequired", automaticAction: false });
    expect(parsed.preview?.dormantCount).toBe(0);
  });

  it("rechaza una señal de debilitamiento que no coincide con los resultados", () => {
    const snapshot = validSnapshot();
    snapshot.preview.weakeningAssessments[0] = { recordId: "current", helpfulOutcomes: 3, notHelpfulOutcomes: 0, evidenceCount: 3, state: "reviewRequired", automaticAction: false };
    snapshot.preview.retrievalOutcomeCount = 3;
    snapshot.preview.functionalAssessmentCount = 1;
    snapshot.preview.weakeningReviewRequiredCount = 1;
    expect(() => parseMemoryLifecyclePreview(snapshot)).toThrow();
  });

  it("rechaza conteos incoherentes y una migración habilitada", () => {
    const incoherent = validSnapshot();
    incoherent.preview.currentCount = 2;
    expect(() => parseMemoryLifecyclePreview(incoherent)).toThrow();
    expect(() => parseMemoryLifecyclePreview({ ...validSnapshot(), lifecycleWritesAvailable: false })).toThrow();
  });

  it("exige una revisión activa para active y permite rolledBack sin perder historial", () => {
    expect(() => parseMemoryLifecyclePreview({ ...validSnapshot(), state: "active" })).toThrow();
    const active = parseMemoryLifecyclePreview({ ...validSnapshot(), state: "active", activeRevisionId: sha("f"), revisionCount: 1 });
    expect(active.state).toBe("active");
    const rolledBack = parseMemoryLifecyclePreview({ ...validSnapshot(), state: "rolledBack", revisionCount: 1 });
    expect(rolledBack.activeRevisionId).toBeNull();
  });

  it("acepta una evaluación explícita respaldada y auditada", () => {
    const lifecycle = validSnapshot();
    lifecycle.sourceSha256 = sha("b");
    lifecycle.preview.sourceSha256 = sha("b");
    const parsed = parseMemoryValidityAssessmentResult({
      schemaVersion: 1,
      recordId: "legacy",
      action: "confirmCurrent",
      previousValidity: "notAssessed",
      newValidity: "current",
      sourceSha256Before: sha("a"),
      sourceSha256After: sha("b"),
      backupSha256: sha("a"),
      recordsModified: true,
      auditWritten: true,
      lifecycle,
    });
    expect(parsed.newValidity).toBe("current");
    expect(parsed.lifecycle.sourceSha256).toBe(sha("b"));
  });

  it("rechaza una evaluación incoherente o sin respaldo exacto", () => {
    const lifecycle = validSnapshot();
    lifecycle.sourceSha256 = sha("b");
    lifecycle.preview.sourceSha256 = sha("b");
    const result = {
      schemaVersion: 1,
      recordId: "legacy",
      action: "markConflict",
      previousValidity: "notAssessed",
      newValidity: "current",
      sourceSha256Before: sha("a"),
      sourceSha256After: sha("b"),
      backupSha256: sha("c"),
      recordsModified: true,
      auditWritten: true,
      lifecycle,
    };
    expect(() => parseMemoryValidityAssessmentResult(result)).toThrow();
  });

  it("acepta una transición explícita a reposo ligada al ciclo resultante", () => {
    const lifecycle = validSnapshot();
    lifecycle.sourceSha256 = sha("b");
    lifecycle.preview.sourceSha256 = sha("b");
    lifecycle.preview.references[0].accessibility = "dormant";
    lifecycle.preview.references[0].retrievalPolicy = "blockedByDormancy";
    lifecycle.preview.accessibilityAssessedCount = 1;
    lifecycle.preview.dormantCount = 1;
    lifecycle.preview.retrievalEligibleCount = 1;
    lifecycle.preview.retrievalBlockedCount = 3;
    const parsed = parseMemoryAccessibilityAssessmentResult({
      schemaVersion: 1,
      recordId: "current",
      action: "setDormant",
      previousAccessibility: "notAssessed",
      newAccessibility: "dormant",
      sourceSha256Before: sha("a"),
      sourceSha256After: sha("b"),
      backupSha256: sha("a"),
      recordsModified: true,
      auditWritten: true,
      lifecycle,
    });
    expect(parsed.newAccessibility).toBe("dormant");
    expect(parsed.lifecycle.preview?.retrievalBlockedCount).toBe(3);
  });

  it("acepta una supresión voluntaria reversible sin confundirla con reposo", () => {
    const lifecycle = validSnapshot();
    lifecycle.sourceSha256 = sha("b");
    lifecycle.preview.sourceSha256 = sha("b");
    lifecycle.preview.references[0].suppressed = true;
    lifecycle.preview.references[0].retrievalPolicy = "blockedBySuppression";
    lifecycle.preview.suppressedCount = 1;
    lifecycle.preview.retrievalEligibleCount = 1;
    lifecycle.preview.retrievalBlockedCount = 3;
    const parsed = parseMemorySuppressionAssessmentResult({
      schemaVersion: 1,
      recordId: "current",
      action: "suppress",
      reason: "ownerChoice",
      previousSuppressed: false,
      newSuppressed: true,
      sourceSha256Before: sha("a"),
      sourceSha256After: sha("b"),
      backupSha256: sha("a"),
      recordsModified: true,
      auditWritten: true,
      lifecycle,
    });
    expect(parsed.newSuppressed).toBe(true);
    expect(parsed.lifecycle.preview?.references[0]).toMatchObject({ suppressed: true, retrievalPolicy: "blockedBySuppression", accessibility: "notAssessed" });
  });

  it("proyecta una reconsolidación real como versiones posteriores a la base", () => {
    const snapshot = validSnapshot();
    snapshot.preview.references[0].reconsolidationCount = 2;
    snapshot.preview.reconsolidatedCount = 1;
    const parsed = parseMemoryLifecyclePreview(snapshot);
    expect(parsed.preview?.reconsolidatedCount).toBe(1);
    expect(parsed.preview?.references[0]).toMatchObject({ baseVersion: 1, reconsolidationCount: 2 });
  });
});
