import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type VisualMemoryCandidate = { intention: string; summary: string; memoryType: "episodic"; source: string; importance: number };
type SensoryLearningPanelProps = {
  observationEnabled: boolean;
  ollamaReady: boolean;
  ollamaModel: string;
  onConfirmVisualLearning: (candidate: VisualMemoryCandidate) => void;
};

type ScreenFrameAnalysis = {
  topic: string;
  notes: string[];
  visibleText: string[];
  uncertainty: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

type VisualNote = ScreenFrameAnalysis & { capturedAt: string };

const sources = [
  { id: "screen", code: "SCR", label: "Pantalla seleccionada", adapter: "WebView2 Display Capture", phase: "R2", policy: "Fotogramas temporales elegidos mediante el selector seguro de Windows; no grabación continua." },
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

function parseScreenFrameAnalysis(value: unknown): ScreenFrameAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ollama devolvió un análisis visual desconocido");
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort().join(",");
  if (keys !== ["inputTokens", "model", "notes", "outputTokens", "topic", "uncertainty", "visibleText"].sort().join(",")) throw new Error("El análisis visual contiene campos inesperados");
  if (typeof input.topic !== "string" || !input.topic.trim() || typeof input.model !== "string" || !input.model.trim() || typeof input.uncertainty !== "string") throw new Error("El análisis visual no contiene texto válido");
  if (!Array.isArray(input.notes) || !input.notes.length || input.notes.some((item) => typeof item !== "string" || !item.trim())) throw new Error("El análisis visual no contiene apuntes válidos");
  if (!Array.isArray(input.visibleText) || input.visibleText.some((item) => typeof item !== "string" || !item.trim())) throw new Error("El texto visible no es válido");
  if (!Number.isSafeInteger(input.inputTokens) || (input.inputTokens as number) < 0 || !Number.isSafeInteger(input.outputTokens) || (input.outputTokens as number) < 0) throw new Error("Las métricas visuales no son válidas");
  return input as ScreenFrameAnalysis;
}

function visualCandidateText(notes: VisualNote[]) {
  return notes.map((note) => {
    const time = new Date(note.capturedAt).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
    const uncertainty = note.uncertainty ? `\n  Incertidumbre: ${note.uncertainty}` : "";
    return `${time} · ${note.topic}\n${note.notes.map((item) => `- ${item}`).join("\n")}${uncertainty}`;
  }).join("\n\n");
}

export function SensoryLearningPanel({ observationEnabled, ollamaReady, ollamaModel, onConfirmVisualLearning }: SensoryLearningPanelProps) {
  const nativeRuntime = isTauri();
  const [status, setStatus] = useState(emptyStatus);
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [pending, setPending] = useState<PreparedPermissionRequest | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(nativeRuntime ? "Consultando leases sensoriales…" : "Los sensores requieren la aplicación de escritorio.");
  const [error, setError] = useState("");
  const [visualActive, setVisualActive] = useState(false);
  const [visualNotes, setVisualNotes] = useState<VisualNote[]>([]);
  const [visualMessage, setVisualMessage] = useState("Seleccioná una ventana o pantalla para comenzar; todavía no se captura nada.");
  const [candidateTitle, setCandidateTitle] = useState("Observación visual revisada");
  const [candidateSummary, setCandidateSummary] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visualTimerRef = useRef<number | null>(null);
  const analyzingRef = useRef(false);

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

  useEffect(() => () => {
    if (visualTimerRef.current !== null) window.clearInterval(visualTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current = null;
  }, []);

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

  function stopVisualSession(message = "Sesión visual detenida. Revisá los apuntes antes de confirmar cualquier aprendizaje.") {
    if (visualTimerRef.current !== null) window.clearInterval(visualTimerRef.current);
    visualTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    videoRef.current = null;
    analyzingRef.current = false;
    setVisualActive(false);
    setVisualMessage(message);
  }

  async function captureVisualSample() {
    const video = videoRef.current;
    if (!video || analyzingRef.current || video.videoWidth < 2 || video.videoHeight < 2) return;
    analyzingRef.current = true;
    setVisualMessage("Analizando una muestra temporal con Ollama local…");
    try {
      const maximumWidth = 960;
      const scale = Math.min(1, maximumWidth / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar la muestra visual temporal");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", .72);
      canvas.width = 1;
      canvas.height = 1;
      const imageBase64 = encoded.slice(encoded.indexOf(",") + 1);
      const analysis = parseScreenFrameAnalysis(await invoke<unknown>("analyze_screen_frame", { input: { imageBase64, model: ollamaModel } }));
      const note = { ...analysis, capturedAt: new Date().toISOString() };
      setVisualNotes((current) => {
        const next = [...current, note].slice(-12);
        setCandidateSummary(visualCandidateText(next));
        if (current.length === 0 && analysis.topic.trim()) setCandidateTitle(`Observación: ${analysis.topic.trim()}`);
        return next;
      });
      setError("");
      setVisualMessage(`Muestra analizada · ${analysis.topic} · captura descartada.`);
    } catch (reason) {
      setError(String(reason));
      setVisualMessage("La muestra falló y fue descartada; la sesión continúa si la pantalla sigue compartida.");
    } finally {
      analyzingRef.current = false;
    }
  }

  async function startVisualSession() {
    setError("");
    if (!nativeRuntime) { setError("La observación visual requiere Alice Desktop."); return; }
    if (!ollamaReady) { setError("Ollama local no está listo. Abrí Alice mediante Iniciar Alice.cmd."); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) { setError("El runtime actual no ofrece el selector seguro de pantalla."); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 1, max: 2 } }, audio: false });
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      streamRef.current = stream;
      videoRef.current = video;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopVisualSession("Windows finalizó la pantalla compartida. Las capturas temporales ya fueron descartadas."), { once: true });
      setVisualActive(true);
      setVisualMessage("Pantalla compartida · primera muestra en preparación · intervalo 5 min · audio NO.");
      window.setTimeout(() => { void captureVisualSample(); }, 1_000);
      visualTimerRef.current = window.setInterval(() => { void captureVisualSample(); }, 300_000);
    } catch (reason) {
      setError(String(reason));
      stopVisualSession("No se inició ninguna captura visual.");
    }
  }

  function confirmVisualLearning() {
    if (visualActive || !visualNotes.length || !candidateTitle.trim() || !candidateSummary.trim()) return;
    onConfirmVisualLearning({
      intention: candidateTitle.trim(),
      summary: candidateSummary.trim(),
      memoryType: "episodic",
      source: `Pantalla compartida · Ollama local ${ollamaModel} · confirmado por Carlos Nuñez`,
      importance: 3,
    });
    setVisualNotes([]);
    setCandidateSummary("");
    setCandidateTitle("Observación visual revisada");
    setVisualMessage("Aprendizaje episódico confirmado. Sólo se guardaron los apuntes revisados.");
  }

  return <section className="sensory-learning" aria-labelledby="sensory-learning-title">
    <header>
      <div><p className="eyebrow">APRENDIZAJE MULTIMODAL · GOBERNADO</p><h3 id="sensory-learning-title">Lo que Alice puede aprender de su entorno</h3><p>La pantalla compartida ya puede producir apuntes locales revisables. Observar no equivale a recordar: cámara, micrófono y memoria siguen siendo rutas separadas.</p></div>
      <div className={`sensory-gate ${status.leases.length ? "active" : ""}`}><i />{status.leases.length ? `${status.leases.length} LEASE ACTIVO` : "GATEWAY R2 LISTO"}</div>
    </header>

    <div className="sensory-current-limit"><span>CAPACIDAD ACTUAL</span><strong>PANTALLA {visualActive ? "COMPARTIDA" : "CERRADA"} · VENTANA {observationEnabled ? "ACTIVA" : "INACTIVA"} · CÁMARA/MICRÓFONO {status.leases.length ? "CON LEASE" : "CERRADOS"}</strong><small>Pantalla: análisis visual local y candidato revisable. Cámara/micrófono: sólo acreditan señal viva. Audio, vídeo y capturas persistentes: NO.</small></div>

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
        const sourceActive = Boolean(lease) || (source.id === "screen" && visualActive);
        return <article key={source.id} className={sourceActive ? "sensor-active" : ""}>
          <header><span>{source.code}</span><div><strong>{source.label}</strong><small>{source.adapter}</small></div><em>{source.phase}</em></header>
          <p>{source.policy}</p>
          {lease ? <div className="sensor-live-details"><strong>{lease.indicator}</strong><span>{lease.device.label}</span><small>{leaseMetrics(lease)} · vence {new Date(lease.expiresAt).toLocaleTimeString("es-PY")} · persistencia RAW: NO</small></div> : null}
          <footer><i />{source.id === "screen" ? visualActive ? "ACTIVO · MUESTRA LOCAL" : "CERRADO" : lease ? "ACTIVO · SEÑAL REAL" : kind ? grant ? "GRANT APROBADO · CERRADO" : "CERRADO" : "NO CONECTADO"}
            {source.id === "screen" && nativeRuntime
              ? visualActive
                ? <button type="button" onClick={() => stopVisualSession()}>DETENER</button>
                : <button type="button" disabled={!ollamaReady} onClick={() => void startVisualSession()}>ELEGIR PANTALLA</button>
              : kind && nativeRuntime ? lease
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
      <div><span>01</span><strong>SESIÓN AUTORIZADA</strong><small>selector de pantalla / leases</small></div><i>→</i><div><span>02</span><strong>ANÁLISIS LOCAL</strong><small>pantalla · Ollama vision</small></div><i>→</i><div><span>03</span><strong>CANDIDATO</strong><small>apuntes editables · sin RAW</small></div><i>→</i><div><span>04</span><strong>CONFIRMACIÓN</strong><small>memoria sólo por decisión humana</small></div>
    </div>

    <section className="learning-inbox" aria-labelledby="learning-inbox-title">
      <header><div><p className="eyebrow">BANDEJA DE CANDIDATOS</p><h4 id="learning-inbox-title">Aprendizajes pendientes</h4></div><span>{visualNotes.length} MUESTRAS ANALIZADAS</span></header>
      <div className={visualNotes.length ? "visual-learning-candidate" : ""}>{visualNotes.length ? <>
        <label>TÍTULO REVISABLE<input value={candidateTitle} onChange={(event) => setCandidateTitle(event.target.value)} /></label>
        <label>APUNTES REVISABLES<textarea value={candidateSummary} onChange={(event) => setCandidateSummary(event.target.value)} /></label>
        <p>{visualMessage}</p>
        <button type="button" disabled={visualActive || !candidateTitle.trim() || !candidateSummary.trim()} onClick={confirmVisualLearning}>{visualActive ? "Detené la sesión para confirmar" : "Confirmar aprendizaje episódico"}</button>
      </> : <><strong>SIN OBSERVACIONES PROPUESTAS</strong><p>{visualMessage}</p><button type="button" disabled={!ollamaReady || visualActive} onClick={() => void startVisualSession()}>Elegir pantalla o ventana</button></>}</div>
    </section>
  </section>;
}
