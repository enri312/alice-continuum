import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  localDateTimeToUtc,
  parseTaskEngineSnapshot,
  parseTaskMutationPlan,
  parseTaskMutationReceipt,
  parseTaskRegistrySnapshot,
  type TaskMutationPlan,
  type TaskMutationReceipt,
  type TaskRecord,
  type TaskEngineSnapshot,
  type TaskRegistrySnapshot,
} from "../core/tasks";
import "../task-registry.css";
import "../task-engine.css";

type TaskRegistryPanelProps = { desktopApp: boolean };

const statusLabels: Record<TaskRecord["status"], string> = {
  scheduled: "PROGRAMADO",
  paused: "PAUSADO",
  completed: "COMPLETADO",
  cancelled: "CANCELADO",
};

function presentTimestamp(value: string | null) {
  if (!value) return "SIN PRÓXIMA EJECUCIÓN";
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localMinimum() {
  const now = new Date(Date.now() + 60_000);
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function TaskRegistryPanel({ desktopApp }: TaskRegistryPanelProps) {
  const [snapshot, setSnapshot] = useState<TaskRegistrySnapshot | null>(null);
  const [engine, setEngine] = useState<TaskEngineSnapshot | null>(null);
  const [title, setTitle] = useState("");
  const [nextRunLocal, setNextRunLocal] = useState("");
  const [plan, setPlan] = useState<TaskMutationPlan | null>(null);
  const [receipt, setReceipt] = useState<TaskMutationReceipt | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState<"status" | "preview" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const minimum = useMemo(localMinimum, []);

  async function refresh() {
    if (!desktopApp) return;
    setPending("status");
    try {
      const [registryValue, engineValue] = await Promise.all([
        invoke<unknown>("task_registry_status"),
        invoke<unknown>("task_engine_status"),
      ]);
      setSnapshot(parseTaskRegistrySnapshot(registryValue));
      setEngine(parseTaskEngineSnapshot(engineValue));
      setError("");
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(null);
    }
  }

  async function toggleTemporalEngine() {
    if (!engine) return;
    setPending("status"); setError("");
    try {
      setEngine(parseTaskEngineSnapshot(await invoke<unknown>("set_task_engine_enabled", {
        input: { enabled: !engine.backgroundEnabled },
      })));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(null);
    }
  }

  useEffect(() => { void refresh(); }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp || !engine?.backgroundEnabled) return;
    let active = true;
    const handle = window.setInterval(() => {
      void invoke<unknown>("task_engine_status")
        .then(parseTaskEngineSnapshot)
        .then((next) => { if (active) setEngine(next); })
        .catch((cause) => { if (active) setError(String(cause)); });
    }, 1_000);
    return () => { active = false; window.clearInterval(handle); };
  }, [desktopApp, engine?.backgroundEnabled]);

  async function prepareReminder() {
    setPending("preview"); setError(""); setReceipt(null); setReviewed(false);
    try {
      const nextRunAt = localDateTimeToUtc(nextRunLocal);
      const prepared = parseTaskMutationPlan(await invoke<unknown>("preview_task_mutation", {
        input: { action: "scheduleLocalReminder", title, nextRunAt, taskId: null },
      }));
      setPlan(prepared);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(null);
    }
  }

  async function prepareCancellation(taskId: string) {
    setPending("preview"); setError(""); setReceipt(null); setReviewed(false);
    try {
      setPlan(parseTaskMutationPlan(await invoke<unknown>("preview_task_mutation", {
        input: { action: "cancelTask", title: null, nextRunAt: null, taskId },
      })));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(null);
    }
  }

  async function confirmPlan() {
    if (!plan || !reviewed) return;
    setPending("confirm"); setError("");
    try {
      const confirmed = parseTaskMutationReceipt(await invoke<unknown>("confirm_task_mutation", {
        input: { plan, confirmed: true },
      }));
      setReceipt(confirmed);
      setPlan(null);
      setReviewed(false);
      if (confirmed.action === "scheduleLocalReminder") { setTitle(""); setNextRunLocal(""); }
      await refresh();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(null);
    }
  }

  return <section className="task-registry" aria-labelledby="task-registry-title">
    <header className="task-registry-heading">
      <div><p className="eyebrow">R7 · CONTROL DEL PROPIETARIO</p><h3 id="task-registry-title">Recordatorios e intenciones temporales</h3><p>Preparar no guarda. Confirmar vuelve a leer identidad, hora, alcance y huella antes de escribir.</p></div>
      <div className={`task-registry-state ${snapshot?.state ?? "missing"}`}><i />{pending === "status" ? "LEYENDO" : snapshot?.state === "ready" ? `${snapshot.taskCount} REGISTRADAS` : snapshot?.state === "invalid" ? "REGISTRO BLOQUEADO" : "REGISTRO NUEVO"}</div>
    </header>

    {!desktopApp ? <div className="task-registry-unavailable"><strong>ESCRITORIO NATIVO REQUERIDO</strong><span>El navegador no puede confirmar ni cancelar tareas locales.</span></div> : <>
      <div className="task-registry-grid">
        <section className="task-composer">
          <header><span>01</span><div><strong>PREPARAR RECORDATORIO ÚNICO</strong><small>Sin escritura · sin notificación · sin ejecutor</small></div></header>
          <label>TÍTULO VISIBLE<input value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setPlan(null); setReviewed(false); }} placeholder="Ej.: Recordarme revisar el Roadmap" /></label>
          <label>FECHA Y HORA LOCAL<input type="datetime-local" min={minimum} value={nextRunLocal} onChange={(event) => { setNextRunLocal(event.target.value); setPlan(null); setReviewed(false); }} /></label>
          <button type="button" className="task-primary" disabled={pending !== null || !title.trim() || !nextRunLocal || snapshot?.state === "invalid"} onClick={() => void prepareReminder()}>{pending === "preview" ? "PREPARANDO…" : "PREPARAR VISTA PREVIA"}</button>
          <small>La hora se convierte a UTC en el plan, pero aquí se muestra en tu zona local.</small>
        </section>

        <section className={`task-preview ${plan ? "ready" : "empty"}`}>
          <header><span>02</span><div><strong>REVISIÓN HUMANA</strong><small>{plan ? "Plan ligado por SHA-256" : "Esperando una vista previa"}</small></div></header>
          {plan ? <>
            <dl>
              <div><dt>Operación</dt><dd>{plan.action === "scheduleLocalReminder" ? "PROGRAMAR" : "CANCELAR"}</dd></div>
              <div><dt>Título</dt><dd>{plan.title}</dd></div>
              <div><dt>Hora</dt><dd>{presentTimestamp(plan.nextRunAt)}</dd></div>
              <div><dt>Identidad</dt><dd title={plan.taskId}>{plan.taskId}</dd></div>
              <div><dt>Alcance</dt><dd>NOTIFICACIÓN LOCAL</dd></div>
              <div><dt>Respaldo</dt><dd>{plan.backupRequired ? "OBLIGATORIO" : "FUENTE NUEVA"}</dd></div>
              <div><dt>Ejecución</dt><dd className="safe">APAGADA</dd></div>
            </dl>
            <label className="task-review-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /><span>Revisé título, fecha, identidad y alcance. Quiero confirmar exactamente este plan.</span></label>
            <div className="task-preview-actions"><button type="button" onClick={() => { setPlan(null); setReviewed(false); }}>DESCARTAR</button><button type="button" className={plan.action === "cancelTask" ? "task-danger" : "task-confirm"} disabled={!reviewed || pending !== null} onClick={() => void confirmPlan()}>{pending === "confirm" ? "CONFIRMANDO…" : plan.action === "cancelTask" ? "CONFIRMAR CANCELACIÓN" : "CONFIRMAR RECORDATORIO"}</button></div>
          </> : <div className="task-preview-empty"><span>SHA-256</span><strong>NINGÚN PLAN PREPARADO</strong><small>Los campos de la izquierda todavía no han producido ninguna escritura.</small></div>}
        </section>
      </div>

      {error && <div className="task-registry-error" role="alert"><strong>OPERACIÓN BLOQUEADA</strong><span>{error}</span></div>}
      {receipt && <div className="task-registry-receipt" role="status"><strong>{receipt.idempotent ? "OPERACIÓN YA APLICADA" : "OPERACIÓN CONFIRMADA"}</strong><span>Revisión {receipt.revisionId} · auditoría {receipt.auditWritten ? "escrita" : "sin duplicar"} · ejecución automática apagada</span></div>}

      <section className={`task-clock ${engine?.backgroundEnabled ? "active" : "off"}`}>
        <header><div><span>03</span><div><strong>SENTIDO TEMPORAL · R7.3-A</strong><small>Clasifica el tiempo; no intenta actuar</small></div></div><b>{engine?.backgroundEnabled ? "EVALUACIÓN ACTIVA" : "APAGADO"}</b></header>
        <div className="task-clock-body">
          <dl>
            <div><dt>FUTURAS</dt><dd>{engine?.waitingCount ?? 0}</dd></div>
            <div><dt>VENCIDAS</dt><dd className={(engine?.dueCount ?? 0) > 0 ? "due" : ""}>{engine?.dueCount ?? 0}</dd></div>
            <div><dt>EXCLUIDAS</dt><dd>{engine?.excludedCount ?? 0}</dd></div>
            <div><dt>PRÓXIMA EVALUACIÓN ÚTIL</dt><dd>{presentTimestamp(engine?.nextWakeAt ?? null)}</dd></div>
          </dl>
          <div><p>{engine?.backgroundEnabled ? "Alice relee el reloj una vez por segundo. El estado vive sólo en RAM y vuelve apagado al reiniciar." : "La evaluación periódica está detenida. La lectura manual de esta pantalla no escribe ni activa procesos de salida."}</p><button type="button" onClick={() => void toggleTemporalEngine()} disabled={!engine || pending !== null || engine.registryState === "invalid"}>{engine?.backgroundEnabled ? "DETENER EVALUACIÓN" : "ACTIVAR RELOJ INTERNO"}</button></div>
        </div>
        <footer><span>EJECUCIÓN OFF</span><span>NOTIFICACIONES OFF</span><span>ESCRITURAS 0</span><span>{engine?.lastBackgroundEvaluationAt ? `ÚLTIMO PULSO ${presentTimestamp(engine.lastBackgroundEvaluationAt)}` : "SIN PULSOS EN SEGUNDO PLANO"}</span></footer>
      </section>

      <section className="task-list">
        <header><div><span>04</span><strong>REGISTRO LOCAL</strong></div><small>{snapshot?.scheduledCount ?? 0} programadas · {snapshot?.cancelledCount ?? 0} canceladas</small></header>
        {snapshot?.tasks.length ? <div className="task-list-items">{snapshot.tasks.map((task) => <article key={task.taskId}>
          <div><span className={`task-status ${task.status}`}>{statusLabels[task.status]}</span><strong>{task.title}</strong><small>{presentTimestamp(task.schedule.nextRunAt)} · {task.scope.kind === "localNotification" ? "AVISO LOCAL" : "LECTURA R1"}</small></div>
          <button type="button" disabled={!task.cancellable || pending !== null} onClick={() => void prepareCancellation(task.taskId)}>{task.cancellable ? "PREPARAR CANCELACIÓN" : "SIN ACCIÓN"}</button>
        </article>)}</div> : <div className="task-list-empty"><strong>0 TAREAS REALES</strong><span>No se fabricaron tareas para poblar esta pantalla.</span></div>}
      </section>
    </>}
    <footer><span>DESPACHO OFF</span><span>NOTIFICACIONES OFF</span><span>RED OFF</span><span>AUTOMATIC EXECUTION FALSE</span></footer>
  </section>;
}
