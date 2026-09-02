import { describe, expect, it } from "vitest";
import { localDateTimeToUtc, parseTaskAttemptLedgerSnapshot, parseTaskAttemptReservationReceipt, parseTaskEngineSnapshot, parseTaskMutationPlan, parseTaskMutationReceipt, parseTaskRegistrySnapshot } from "./tasks";

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

  it("acepta una evaluación temporal cerrada y sin efectos", () => {
    const snapshot = parseTaskEngineSnapshot({
      schemaVersion: 1, registryState: "ready", evaluatedAt: "2026-09-02T19:00:00Z",
      backgroundEnabled: true, lastBackgroundEvaluationAt: "2026-09-02T18:59:59Z",
      waitingCount: 1, dueCount: 1, excludedCount: 1, nextWakeAt: "2026-09-02T20:00:00Z",
      items: [
        { taskId: id, title: "Futura", kind: "localReminder", registryStatus: "scheduled", scheduledFor: "2026-09-02T20:00:00Z", temporalState: "waiting", reason: null },
        { taskId: revision, title: "Vencida", kind: "localReminder", registryStatus: "scheduled", scheduledFor: "2026-09-02T18:00:00Z", temporalState: "due", reason: null },
        { taskId: "46ce7f93-ea5a-4f56-a77c-24452f482fb4", title: "Retirada", kind: "localReminder", registryStatus: "cancelled", scheduledFor: null, temporalState: "excluded", reason: "cancelled" },
      ], error: null, automaticExecution: false, notificationsEnabled: false, writesPerformed: false,
    });
    expect(snapshot.dueCount).toBe(1);
    expect(snapshot.items[2]?.reason).toBe("cancelled");
  });

  it("rechaza telemetría temporal inventada o con efectos habilitados", () => {
    expect(() => parseTaskEngineSnapshot({
      schemaVersion: 1, registryState: "missing", evaluatedAt: "2026-09-02T19:00:00Z",
      backgroundEnabled: false, lastBackgroundEvaluationAt: null,
      waitingCount: 0, dueCount: 0, excludedCount: 0, nextWakeAt: null, items: [], error: null,
      automaticExecution: false, notificationsEnabled: true, writesPerformed: false,
    })).toThrow(/no puede ejecutar, notificar ni escribir/);
  });

  it("acepta una reserva durable pero rechaza cualquier salida declarada", () => {
    const ledger = parseTaskAttemptLedgerSnapshot({ schemaVersion: 1, state: "ready", storageExists: true, reservationCount: 1, reservations: [{ attemptId: id, idempotencyKey: digest, taskId: revision, taskRevisionId: id, scheduledFor: "2026-09-02T18:00:00Z", reservedAt: "2026-09-02T19:00:00Z", state: "reserved" }], error: null, notificationsEnabled: false, outputPerformed: false });
    const receipt = parseTaskAttemptReservationReceipt({ schemaVersion: 1, operationId: revision, attemptId: id, idempotencyKey: digest, taskId: revision, taskRevisionId: id, scheduledFor: "2026-09-02T18:00:00Z", reservedAt: "2026-09-02T19:00:00Z", idempotent: false, ledgerWritten: true, auditWritten: true, notificationSent: false, outputPerformed: false, taskStateChanged: false });
    expect(ledger.reservationCount).toBe(1);
    expect(receipt.outputPerformed).toBe(false);
  });
});
