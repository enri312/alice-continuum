import type { CSSProperties } from "react";
import type { buildVolumeSignalSnapshot } from "../../core/cognitive/volume-signals";
import { illustrativeSignalRoutes } from "../../core/cognitive/volume-signal-demo";

export type VolumeSignalMode = "recorded" | "demo";
type Props = {
  signals: ReturnType<typeof buildVolumeSignalSnapshot>;
  mode: VolumeSignalMode;
  paused: boolean;
  reducedMotion: boolean;
  nowMs: number;
  onModeChange: (mode: VolumeSignalMode) => void;
  onPauseChange: () => void;
};

const stateLabels = {
  live: "Evidencia reciente", idle: "Sin señal de proceso", stale: "Muestra desactualizada",
  unavailable: "Fuente no disponible", error: "Fuente sin verificar",
};

export function VolumeSignalConsole({ signals, mode, paused, reducedMotion, nowMs, onModeChange, onPauseChange }: Props) {
  const hasSample = signals.generatedAt !== null;
  const sampleAge = signals.generatedAt === null ? null : Math.max(0, Math.floor((nowMs - signals.generatedAt) / 1000));
  const activeRoutes = signals.routes.filter(route => route.animatable).length;
  const demo = mode === "demo";
  return <section className="volume-signal-console" data-mode={mode} data-state={signals.state} data-paused={paused || reducedMotion} aria-labelledby="volume-signals-title">
    <header className="volume-signal-console-header">
      <div><span className="eyebrow">TRÁFICO DE SEÑALES</span><h3 id="volume-signals-title">Actividad y conexiones</h3><p>Observa la evidencia reciente o explora un recorrido ilustrativo.</p></div>
      <nav className="volume-signal-modes" aria-label="Origen de las señales">
        <button type="button" aria-pressed={!demo} onClick={() => onModeChange("recorded")}>Actividad registrada</button>
        <button type="button" data-mode="demo" aria-pressed={demo} onClick={() => onModeChange("demo")}>Demostración</button>
      </nav>
    </header>
    <div className="volume-signal-status" data-mode={mode} data-state={signals.state} role="status">
      <i aria-hidden="true" /><strong>{demo ? "DEMOSTRACIÓN VISUAL" : stateLabels[signals.state]}</strong>
      <span>{demo ? "Rutas de ejemplo · los contadores reales se conservan" : signals.description}</span>
    </div>
    <dl className="volume-signal-metrics" aria-label="Actividad registrada, independiente de la demostración">
      <div><dt>Eventos en la ventana</dt><dd>{hasSample ? signals.recentEventCount : "—"}</dd><small>{hasSample ? `${Math.round(signals.windowSeconds / 60)} min de auditoría` : "Sin muestra nativa"}</small></div>
      <div><dt>Rutas con señal vigente</dt><dd>{hasSample ? activeRoutes : "—"}</dd><small>Evidencia por conexión</small></div>
      <div><dt>Señal técnica R3</dt><dd>{hasSample ? signals.overallSignal.toFixed(3) : "—"}</dd><small>Índice heurístico · no es un porcentaje cerebral</small></div>
      <div><dt>Edad de la muestra</dt><dd>{sampleAge === null ? "—" : `${sampleAge}s`}</dd><small>{signals.state === "stale" ? "Animación real detenida" : "Consulta nominal cada 5 s"}</small></div>
    </dl>
    <ul className="volume-signal-route-list" aria-label={demo ? "Rutas ilustrativas de la demostración" : "Rutas respaldadas por auditoría"}>
      {demo ? illustrativeSignalRoutes.map(route => <li key={route.id} data-animating={!paused && !reducedMotion} data-demo="true">
        <div><strong>{route.label}</strong><span>Ejemplo visual</span></div>
        <div className="signal-route-track" style={{ "--signal-strength": .65 } as CSSProperties} aria-hidden="true"><i /></div>
      </li>) : signals.routes.length ? signals.routes.map(route => <li key={route.id} data-animating={route.animatable && !paused && !reducedMotion}>
        <div><strong>{route.label}</strong><span>{route.eventCount} evidencia{route.eventCount === 1 ? "" : "s"}</span></div>
        <div className="signal-route-track" style={{ "--signal-strength": route.signal } as CSSProperties} aria-hidden="true"><i /></div>
      </li>) : <li className="volume-signal-note">Las rutas registradas aparecerán cuando la aplicación pueda consultar la auditoría local.</li>}
    </ul>
    <div className="volume-signal-tools">
      <button type="button" aria-pressed={paused || reducedMotion} disabled={reducedMotion} onClick={onPauseChange}>{reducedMotion ? "Movimiento reducido" : paused ? "Reanudar animación" : "Pausar animación"}</button>
      <span>{reducedMotion ? "Movimiento reducido del equipo: vista estática" : paused ? "La evidencia sigue actualizándose; sólo se pausa el movimiento" : "Pulsos visibles sobre las conexiones"}</span>
    </div>
    <p className="volume-signal-note">{demo ? "Esta demostración no ejecuta el modelo, no genera recuerdos y no envía datos. Las estaciones y los pulsos son ilustrativos." : "Las rutas y sus conteos proceden de eventos de la aplicación. La velocidad y cantidad de partículas son ilustrativas; no muestran neuronas ni activaciones internas de Gemma."}</p>
    <details className="volume-signal-explanation"><summary>¿Qué representa esta actividad?</summary><p>Los nodos conservan los recuerdos y procesos que puedes inspeccionar. La evidencia reciente se resume en una ventana temporal; no indica que cada proceso siga ejecutándose ahora. Las asociaciones confirmadas y los recuerdos del mismo intercambio conservan sus significados y colores.</p><p>Inspirarse en el cerebro significa modelar mecanismos concretos, como propagación con retardos, activación por umbral, inhibición y reposo. Esta vista representa el flujo funcional de Alice; no simula todavía esas neuronas biológicas ni mide conciencia.</p></details>
  </section>;
}
