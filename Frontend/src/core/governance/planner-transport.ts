import { invoke, isTauri } from "@tauri-apps/api/core";
import { startSerializedPolling } from "../shared/polling";
import { parseCapabilityRegistrySnapshot } from "./capabilities";
import {
  localDateTimeToUtc, parseReadOnlyCapabilityCheckReceipt, parseTaskAttemptLedgerSnapshot,
  parseTaskAttemptReservationReceipt, parseTaskEngineSnapshot, parseTaskMutationPlan,
  parseTaskMutationReceipt, parseTaskNotificationReceipt, parseTaskRegistrySnapshot,
  type TaskEngineSnapshot, type TaskMutationPlan,
} from "./tasks";

const date = new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" });
const timeLabel = (iso: string | null) => iso ? date.format(new Date(iso)) : "SIN PRÓXIMA EJECUCIÓN";

export function localReminderMinimum() {
  const now = new Date(Date.now() + 60_000);
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function projectEngine(engine: TaskEngineSnapshot) {
  return {
    registryState: engine.registryState, backgroundEnabled: engine.backgroundEnabled,
    waitingCount: engine.waitingCount, dueCount: engine.dueCount, excludedCount: engine.excludedCount,
    nextLabel: timeLabel(engine.nextWakeAt),
    pulseLabel: engine.lastBackgroundEvaluationAt ? timeLabel(engine.lastBackgroundEvaluationAt) : null,
    due: engine.items.filter(item => item.temporalState === "due" && item.scheduledFor)
      .map(item => ({ taskId: item.taskId, title: item.title, scheduledFor: item.scheduledFor, timeLabel: timeLabel(item.scheduledFor) })),
  };
}

async function refresh() {
  const [records, engine, attempts, capabilities] = await Promise.all([
    invoke("task_registry_status").then(parseTaskRegistrySnapshot),
    invoke("task_engine_status").then(parseTaskEngineSnapshot),
    invoke("task_attempt_ledger_status").then(parseTaskAttemptLedgerSnapshot),
    invoke("capability_registry_status").then(parseCapabilityRegistrySnapshot),
  ]);
  return {
    type: "refreshed",
    registry: {
      state: records.state, taskCount: records.taskCount,
      scheduledCount: records.scheduledCount, cancelledCount: records.cancelledCount,
      tasks: records.tasks.map(task => ({
        taskId: task.taskId, title: task.title, status: task.status, cancellable: task.cancellable,
        timeLabel: timeLabel(task.schedule.nextRunAt), localNotification: task.scope.kind === "localNotification",
      })),
    },
    engine: projectEngine(engine),
    ledger: attempts,
    capabilities: capabilities.capabilities.filter(item => item.kind === "query" || item.kind === "observation")
      .map(item => ({ id: item.id, label: item.label })),
  };
}

export function createPlannerTransport() {
  let plan: TaskMutationPlan | null = null;
  let pending = false;
  let stopActivity: (() => void) | undefined;
  let disposed = false;

  async function execute(action: Record<string, unknown>) {
    switch (action.type) {
      case "refresh": return refresh();
      case "tick": return { type: "engine", engine: projectEngine(parseTaskEngineSnapshot(await invoke("task_engine_status"))) };
      case "toggle":
        if (typeof action.enabled === "boolean") {
          const engine = parseTaskEngineSnapshot(await invoke("set_task_engine_enabled", { input: { enabled: action.enabled } }));
          return { type: "engine", engine: projectEngine(engine) };
        }
        break;
      case "prepare":
      case "cancel": {
        plan = null;
        const input = action.type === "prepare" && typeof action.title === "string" && typeof action.nextRunLocal === "string"
          ? { action: "scheduleLocalReminder", title: action.title, nextRunAt: localDateTimeToUtc(action.nextRunLocal), taskId: null }
          : action.type === "cancel" && typeof action.taskId === "string"
            ? { action: "cancelTask", title: null, nextRunAt: null, taskId: action.taskId }
            : null;
        if (!input) break;
        const candidate = parseTaskMutationPlan(await invoke("preview_task_mutation", { input }));
        if (candidate.action !== input.action || (input.taskId && input.taskId !== candidate.taskId)
          || (input.title !== null && (input.title.trim() !== candidate.title || Date.parse(input.nextRunAt!) !== Date.parse(candidate.nextRunAt ?? "")))) {
          throw new Error("La vista previa no corresponde a la operación solicitada.");
        }
        plan = candidate;
        return { type: "preview", plan: { ...candidate, timeLabel: timeLabel(candidate.nextRunAt) } };
      }
      case "confirm": {
        // Only the token crosses back from the view. Forward the exact native plan.
        if (!plan || plan.planId !== action.planId) throw new Error("Volvé a preparar y revisar el plan.");
        const receipt = parseTaskMutationReceipt(await invoke("confirm_task_mutation", { input: { plan, confirmed: true } }));
        if (receipt.taskId !== plan.taskId || receipt.action !== plan.action) throw new Error("El recibo no coincide con el plan confirmado.");
        plan = null;
        return { type: "confirmed", receipt };
      }
      case "reserve":
        if (typeof action.taskId === "string" && typeof action.scheduledFor === "string") {
          if (!window.confirm("Reservar una sola vez esta tarea vencida para un futuro despacho. No enviará aviso ni modificará la tarea ahora.")) return { type: "declined" };
          const receipt = parseTaskAttemptReservationReceipt(await invoke("reserve_task_attempt", {
            input: { taskId: action.taskId, scheduledFor: action.scheduledFor, confirmed: true },
          }));
          return { type: "reserved", receipt };
        }
        break;
      case "dispatch":
        if (typeof action.attemptId === "string" && typeof action.idempotencyKey === "string") {
          if (!window.confirm("Enviar ahora este recordatorio al sistema operativo. La entrega quedará registrada y no podrá repetirse para esta reserva.")) return { type: "declined" };
          const receipt = parseTaskNotificationReceipt(await invoke("dispatch_task_notification", {
            input: { attemptId: action.attemptId, idempotencyKey: action.idempotencyKey, confirmed: true },
          }));
          return { type: "dispatched", receipt };
        }
        break;
      case "check":
        if (typeof action.capabilityId === "string") {
          const receipt = parseReadOnlyCapabilityCheckReceipt(await invoke("run_read_only_capability_check", {
            input: { capabilityId: action.capabilityId, confirmed: true },
          }));
          return { type: "checked", receipt };
        }
        break;
    }
    throw new Error("Operación de Planificador inválida.");
  }

  return {
    dispatch(raw: string, reply: (value: unknown) => void) {
      if (disposed || !isTauri()) return;
      let action;
      try { action = JSON.parse(raw); } catch { return; }
      if (action?.type === "connect") {
        stopActivity ??= startSerializedPolling({
          intervalMs: 5_000,
          read: () => invoke("core_activity_snapshot"),
          onValue: value => reply({ type: "activity", value }),
          onError: () => reply({ type: "activity", value: null }),
        });
        return;
      }
      if (!Number.isInteger(action?.id) || action.id <= 0 || action.id > 0xffff_ffff) return;
      const foreground = action.type !== "tick";
      if (foreground && pending) return;
      if (foreground) pending = true;
      const complete = (result: unknown) => {
        if (foreground) pending = false;
        if (!disposed) reply({ type: "taskResult", id: action.id, result });
      };
      void execute(action).then(complete, error => complete({ type: "failed", message: String(error) }));
    },
    dispose() {
      disposed = true;
      plan = null;
      stopActivity?.();
    },
  };
}
