import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  createCancelPermissionInput,
  createExecutePermissionInput,
  createPermissionDecisionInput,
  createSensorPreparation,
  parsePermissionGatewayStatus,
  parsePermissionGrant,
  parsePreparedPermissionRequest,
  parseSensorLeaseExecutionResult,
  parseSensorLeaseStatus,
} from "../core/permissions";
import type { PermissionGrant, PreparedPermissionRequest, SensorKind, SensorLease, SensorLeaseStatus } from "../core/permissions";

type SensoryLearningPanelProps = { observationEnabled: boolean };

const sources = [
  { id: "screen", code: "SCR", label: "Pantalla seleccionada", adapter: "Windows Graphics Capture", phase: "R2", policy: "Fotogramas temporales elegidos mediante el selector seguro de Windows; no grabación continua." },
  { id: "camera", code: "CAM", label: "Cámara de la notebook", adapter: "OpenCV 5 · DirectShow local", phase: "R2", policy: "Lease visible y revocable de 60 segundos; cada fotograma se descarta y no entra en Memoria." },
  { id: "microphone", code: "MIC", label: "Micrófono", adapter: "PortAudio · WASAPI local", phase: "R2", policy: "Lease visible y revocable de 60 segundos; cada muestra se descarta y no se genera audio ni transcripción." },
  { id: "media", code: "MED", label: "Música y reproductores", adapter: "Windows Media Control", phase: "R2", policy: "Primero título, artista, aplicación y estado de reproducción; no se captura el audio si existen metadatos." },
  { id: "actions", code: "ACT", label: "Acciones en el equipo", adapter: "UI Automation events", phase: "R5", policy: "Eventos estructurados de foco y controles; nunca registro global de teclas ni contraseñas." },
  { id: "gestures", code: "GST", label: "Gestos, rostro y pose", adapter: "MediaPipe Tasks local", phase: "R9", policy: "Landmarks y gestos derivados en memoria temporal; no identificación biométrica ni almacenamiento facial." },
] as const;

const emptyStatus: SensorLeaseStatus = { schemaVersion: 1, leases: [] };

function sensorKind(value: string): SensorKind | null {
  return value === "camera" || value === "microphone" ? value : null;
}

function leaseMetrics(lease: SensorLease) {
  return lease.kind === "camera"
    ? `${lease.width}×${lease.height} · ${lease.verifiedSignalUnits} fotogramas vivos verificados`
    : `${lease.sampleRateHz?.toLocaleString("es-PY")} Hz · ${lease.verifiedSignalUnits.toLocaleString("es-PY")} muestras vivas verificadas`;
}

export function SensoryLearningPanel({ observationEnabled }: SensoryLearningPanelProps) {
  const nativeRuntime = isTauri();
  const [status, setStatus] = useState(emptyStatus);
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [pending, setPending] = useState<PreparedPermissionRequest | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(nativeRuntime ? "Consultando leases sensoriales…" : "Los sensores requieren la aplicación de escritorio.");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!nativeRuntime) return;
    const [sensorRaw, gatewayRaw] = await Promise.all([
      invoke<unknown>("sensor_lease_status"),
      invoke<unknown>("permission_gateway_status"),
    ]);
    setStatus(parseSensorLeaseStatus(sensorRaw));
    setGrants(parsePermissionGatewayStatus(gatewayRaw).grants);
  }, [nativeRuntime]);

  useEffect(() => {
    let mounted = true;
    void refresh().then(() => { if (mounted) setMessage("Gateway sensorial conectado · señal cruda no persistente"); }).catch((reason) => {
      if (mounted) setError(String(reason));
    });
    const timer = nativeRuntime ? window.setInterval(() => { void refresh().catch(() => undefined); }, 750) : undefined;
    return () => { mounted = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [nativeRuntime, refresh]);

  const approved = useMemo(() => grants.filter((grant) => grant.mode === "session" && grant.state === "approved"), [grants]);

  async function run(name: string, task: () => Promise<void>) {
    setBusy(name);
    setError("");
    try { await task(); } catch (reason) { setError(String(reason)); }
    finally { setBusy(""); }
  }

  function prepare(kind: SensorKind) {
    void run(`prepare-${kind}`, async () => {
      const label = kind === "camera" ? "cámara integrada" : "arreglo de micrófonos";
      const request = parsePreparedPermissionRequest(await invoke<unknown>("prepare_permission_request", {
        input: createSensorPreparation(kind, `sensor-${kind}-${crypto.randomUUID()}`, `Verificar durante 60 segundos la señal viva de ${label}, sin guardar contenido.`, 60),
      }));
      setPending(request);
      setMessage("Solicitud preparada. El dispositivo continúa cerrado hasta aprobar y activar el grant.");
      await refresh();
    });
  }

  function decide(decision: "approve" | "deny") {
    if (!pending) return;
    void run(decision, async () => {
      const raw = await invoke<unknown | null>("decide_permission_request", { input: createPermissionDecisionInput(pending, decision) });
      if (raw !== null) parsePermissionGrant(raw);
      setPending(null);
      setMessage(decision === "approve" ? "Grant aprobado. El dispositivo sigue cerrado hasta pulsar Activar." : "Solicitud rechazada; no se abrió ningún dispositivo.");
      await refresh();
    });
  }

  function cancel() {
    if (!pending) return;
    void run("cancel", async () => {
      parsePreparedPermissionRequest(await invoke<unknown>("cancel_permission_request", { input: createCancelPermissionInput(pending.requestId) }));
      setPending(null);
      setMessage("Solicitud cancelada; no se abrió ningún dispositivo.");
      await refresh();
    });
  }

  function activate(grant: PermissionGrant) {
    void run(`activate-${grant.grantId}`, async () => {
      const result = parseSensorLeaseExecutionResult(await invoke<unknown>("execute_sensor_lease_grant", { input: createExecutePermissionInput(grant.grantId) }));
      setMessage(`${result.lease.device.label}: señal viva confirmada y descarte inmediato activo.`);
      await refresh();
    });
  }

  function stop(lease: SensorLease) {
    void run(`stop-${lease.grantId}`, async () => {
      parsePermissionGrant(await invoke<unknown>("stop_sensor_lease", { input: createExecutePermissionInput(lease.grantId) }));
      setMessage(`${lease.device.label}: lease detenido y búfer descartado.`);
      await refresh();
    });
  }

  return <section className="sensory-learning" aria-labelledby="sensory-learning-title">
    <header>
      <div><p className="eyebrow">APRENDIZAJE MULTIMODAL · GOBERNADO</p><h3 id="sensory-learning-title">Lo que Alice podrá aprender de su entorno</h3><p>Observar no equivale a recordar. Cámara y micrófono ya pueden comprobar señal viva bajo leases separados; el análisis y la memoria permanecen desconectados.</p></div>
      <div className={`sensory-gate ${status.leases.length ? "active" : ""}`}><i />{status.leases.length ? `${status.leases.length} LEASE ACTIVO` : "GATEWAY R2 LISTO"}</div>
    </header>

    <div className="sensory-current-limit"><span>CAPACIDAD ACTUAL</span><strong>VENTANA {observationEnabled ? "ACTIVA" : "INACTIVA"} · CÁMARA/MICRÓFONO {status.leases.length ? "CON LEASE" : "CERRADOS"}</strong><small>Los sensores solo acreditan señal viva. No hay análisis, transcripción, candidatos, recuerdos ni archivos multimedia.</small></div>

    {pending ? <section className="sensor-permission-preview" aria-live="polite">
      <header><strong>[R2] SOLICITUD PREPARADA · NO EJECUTADA</strong><span>{pending.risk.toUpperCase()} · {pending.requestedDurationSeconds} s</span></header>
      <p>{pending.summary}</p>
      <dl><div><dt>Dispositivo exacto</dt><dd>{pending.resource.label}</dd></div><div><dt>Capacidad</dt><dd>{pending.capabilityId}</dd></div><div><dt>Datos efímeros</dt><dd>{pending.dataScopes.join(", ")}</dd></div><div><dt>Propósito</dt><dd>{pending.purpose}</dd></div><div><dt>Digest</dt><dd>{pending.previewDigest.slice(0, 22)}…</dd></div></dl>
      {pending.warnings.map((warning) => <small key={warning}>{warning}</small>)}
      <footer><button type="button" disabled={Boolean(busy)} onClick={cancel}>CANCELAR</button><button type="button" disabled={Boolean(busy)} onClick={() => decide("deny")}>RECHAZAR</button><button type="button" className="approve" disabled={Boolean(busy)} onClick={() => decide("approve")}>APROBAR GRANT</button></footer>
    </section> : null}

    <div className="sensor-runtime-message" role="status"><span>{error ? "ERR" : "R2"}</span><strong>{error || message}</strong></div>

    <div className="sensory-source-grid">
      {sources.map((source) => {
        const kind = sensorKind(source.id);
        const lease = kind ? status.leases.find((item) => item.kind === kind) : undefined;
        const grant = kind ? approved.find((item) => item.capabilityId === `perception.${kind}.observe`) : undefined;
        return <article key={source.id} className={lease ? "sensor-active" : ""}>
          <header><span>{source.code}</span><div><strong>{source.label}</strong><small>{source.adapter}</small></div><em>{source.phase}</em></header>
          <p>{source.policy}</p>
          {lease ? <div className="sensor-live-details"><strong>{lease.indicator}</strong><span>{lease.device.label}</span><small>{leaseMetrics(lease)} · vence {new Date(lease.expiresAt).toLocaleTimeString("es-PY")} · persistencia RAW: NO</small></div> : null}
          <footer><i />{lease ? "ACTIVO · SEÑAL REAL" : kind ? grant ? "GRANT APROBADO · CERRADO" : "CERRADO" : "NO CONECTADO"}
            {kind && nativeRuntime ? lease
              ? <button type="button" disabled={Boolean(busy)} onClick={() => stop(lease)}>DETENER</button>
              : grant
                ? <button type="button" disabled={Boolean(busy)} onClick={() => activate(grant)}>ACTIVAR</button>
                : <button type="button" disabled={Boolean(busy) || pending !== null} onClick={() => prepare(kind)}>PREPARAR 60 s</button>
              : null}
          </footer>
        </article>;
      })}
    </div>

    <div className="learning-pipeline" aria-label="Flujo gobernado de aprendizaje">
      <div><span>01</span><strong>SESIÓN AUTORIZADA</strong><small>implementado para CAM/MIC</small></div><i>→</i><div><span>02</span><strong>ANÁLISIS LOCAL</strong><small>todavía desconectado</small></div><i>→</i><div><span>03</span><strong>CANDIDATO</strong><small>todavía desconectado</small></div><i>→</i><div><span>04</span><strong>CONFIRMACIÓN</strong><small>sin memoria automática</small></div>
    </div>

    <section className="learning-inbox" aria-labelledby="learning-inbox-title">
      <header><div><p className="eyebrow">BANDEJA DE CANDIDATOS</p><h4 id="learning-inbox-title">Aprendizajes pendientes</h4></div><span>0 CANDIDATOS REALES</span></header>
      <div><strong>SIN OBSERVACIONES PROPUESTAS</strong><p>Los leases actuales solo verifican que el dispositivo real entrega señal y luego la descartan. Nada se convierte en recuerdo.</p><button type="button" disabled>Análisis sensorial · próximo incremento</button></div>
    </section>
  </section>;
}
