import { describe, expect, it } from "vitest";
import { localDateTimeToUtc, parseTaskMutationPlan, parseTaskMutationReceipt, parseTaskRegistrySnapshot } from "./tasks";

const id = "0cf3f714-d16a-4e06-b9d8-d8fc3e8683bd";
const revision = "0c39b61b-83b9-4f02-a06f-7c6ea9640b71";
const digest = `sha256:${"a".repeat(64)}`;

describe("contrato visible R7.2-B", () => {
  it("acepta un snapshot cerrado sin ejecución automática", () => {
    const snapshot = parseTaskRegistrySnapshot({
      schemaVersion: 1, state: "ready", storageExists: true, taskCount: 1,
      scheduledCount: 1, pausedCount: 0, completedCount: 0, cancelledCount: 0,
      tasks: [{
        taskId: id, title: "Recordatorio revisado", kind: "localReminder", status: "scheduled",
        createdAt: "2026-09-02T12:00:00Z", updatedAt: "2026-09-02T12:00:00Z",
        schedule: { kind: "once", nextRunAt: "2026-09-03T18:00:00Z" },
        scope: { kind: "localNotification", capabilityId: null }, origin: "ownerConfirmed", cancellable: true,
      }], error: null, automaticExecution: false,
    });
    expect(snapshot.tasks[0]?.title).toBe("Recordatorio revisado");
    expect(snapshot.automaticExecution).toBe(false);
  });

  it("rechaza campos extra y cualquier afirmación de ejecución", () => {
    expect(() => parseTaskRegistrySnapshot({
      schemaVersion: 1, state: "missing", storageExists: false, taskCount: 0,
      scheduledCount: 0, pausedCount: 0, completedCount: 0, cancelledCount: 0,
      tasks: [], error: null, automaticExecution: true, invented: "activity",
    })).toThrow(/campos desconocidos/);
  });

  it("relee planes y recibos completos ligados por huellas", () => {
    const plan = parseTaskMutationPlan({
      schemaVersion: 1, planId: id, planSha256: digest, action: "scheduleLocalReminder",
      plannedAt: "2026-09-02T12:00:00Z", taskId: revision, title: "Recordatorio revisado",
      nextRunAt: "2026-09-03T18:00:00Z", scope: { kind: "localNotification", capabilityId: null },
      sourceExists: false, sourceSha256Before: null, projectedRevisionId: id,
      projectedSourceSha256: digest, recordCountBefore: 0, recordCountAfter: 1,
      backupRequired: false, revisionRequired: true, auditRequired: true, writesRequired: true,
      automaticExecution: false, writesPerformed: false,
    });
    const receipt = parseTaskMutationReceipt({
      schemaVersion: 1, operationId: id, action: plan.action, taskId: plan.taskId,
      revisionId: plan.projectedRevisionId, sourceSha256: digest, recordCount: 1,
      backupCreated: false, revisionWritten: true, auditWritten: true, idempotent: false,
      automaticExecution: false,
    });
    expect(receipt.taskId).toBe(plan.taskId);
    expect(receipt.auditWritten).toBe(true);
  });

  it("convierte una fecha local válida a UTC canónico", () => {
    expect(localDateTimeToUtc("2026-09-03T18:00")).toMatch(/^2026-09-0[3-4]T\d{2}:00:00Z$/);
    expect(() => localDateTimeToUtc("")).toThrow(/fecha y hora válidas/);
  });
});
