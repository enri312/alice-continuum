import type { BrainSnapshot } from "../../core/cognitive/brain";
import { RetrievedMemoryPanel } from "./RetrievedMemory";

type InternalStateProps = {
  snapshot: BrainSnapshot;
  selectedId: string;
  onSelect: (id: string) => void;
  onControlChange?: (id: string, value: number) => void;
};

function metricStatus(availability: "ready" | "planned") {
  return availability === "ready"
    ? { className: "state-status-implemented", label: "IMPLEMENTADO" }
    : { className: "state-status-planned", label: "FUTURO" };
}

export function InternalState({ snapshot, selectedId, onSelect, onControlChange }: InternalStateProps) {
  const localRecords = snapshot.nodes.find((node) => node.id === "memory")?.value ?? "0 recuerdos";

  return <div className={`internal-state ${snapshot.hasActivity ? "has-activity" : "is-empty"}`}>
    <div className="nucleus-panel-label state-panel-caption"><span>[03]</span><strong>REPLY + AFFECT + DRIVE STATE</strong><small>SEÑALES DE LECTURA · AJUSTES DE SESIÓN</small></div>
    <header className="state-header">
      <div><span className="state-monogram">ALI</span><strong>ALICE</strong><small>MODELO INTERNO · SEÑALES Y AJUSTES DE SESIÓN</small></div>
      <span className="state-records">{localRecords.toUpperCase()}</span>
    </header>

    <section className="state-section" aria-labelledby="signals-title">
      <div className="state-section-title"><span id="signals-title" role="heading" aria-level={3}>SEÑALES INTERNAS</span><small>{snapshot.hasActivity ? "DATOS VERIFICABLES" : "SIN ACTIVIDAD"}</small></div>
      <div className="metric-grid">
        {snapshot.stateMetrics.map((metric) => {
          const status = metricStatus(metric.availability);
          const isSelected = selectedId === metric.id;
          const formattedValue = metric.value.toFixed(3);

          return <button
            key={metric.id}
            type="button"
            className={`metric-row state-selection-target state-kind-metric state-availability-${metric.availability} ${metric.availability} ${isSelected ? "selected" : ""}`}
            aria-pressed={isSelected}
            aria-label={`${metric.label}: ${formattedValue}. Estado: ${status.label.toLocaleLowerCase("es")}. Abrir en el inspector.`}
            onClick={() => onSelect(metric.id)}
          >
            <span className="metric-label state-item-label">
              <span className="state-item-name">{metric.label}</span>
              <i className={`state-status-chip ${status.className}`}>{status.label}</i>
            </span>
            <span className="metric-track state-value-track" aria-hidden="true"><i style={{ width: `${metric.value * 100}%` }} /></span>
            <strong className="state-value-output" aria-hidden="true">{formattedValue}</strong>
          </button>;
        })}
      </div>
    </section>

    <RetrievedMemoryPanel retrieval={snapshot.retrievedMemory} selected={selectedId === "retrieved-memory"} onSelect={() => onSelect("retrieved-memory")} />

    <section className="state-section behavior-section" aria-labelledby="behavior-title">
      <div className="state-section-title"><span id="behavior-title" role="heading" aria-level={3}>CONTROLES DE COMPORTAMIENTO</span><small>AJUSTES DEL PRÓXIMO ENVÍO · BLOQUEO SEGÚN DISPONIBILIDAD</small></div>
      <div className="control-grid">
        {snapshot.behaviorControls.map((control) => {
          const status = metricStatus(control.availability);
          const isSelected = selectedId === control.id;
          const formattedValue = control.value.toFixed(2);
          const locked = control.locked || !onControlChange;
          const lockLabel = locked ? " Bloqueado." : " Ajuste de esta sesión.";

          return <div
            key={control.id}
            className={`control-row state-control-slider state-selection-target state-kind-control state-availability-${control.availability} ${locked ? "state-lock-locked" : "state-lock-available"} ${control.availability} ${isSelected ? "selected" : ""}`}
          >
            <button type="button" className="state-control-inspect" aria-pressed={isSelected} aria-label={`${control.label}: ${formattedValue}. Estado: ${status.label.toLocaleLowerCase("es")}.${lockLabel} Abrir en el inspector.`} onClick={() => onSelect(control.id)}>
              <span className="state-item-name">{control.label}</span>
              <span className="state-status-list">
                <i className={`state-status-chip ${status.className}`}>{status.label}</i>
                <i className={`state-status-chip ${locked ? "state-status-locked" : "state-status-implemented"}`}>{locked ? "BLOQUEADO" : "AJUSTABLE"}</i>
              </span>
            </button>
            <input type="range" className="state-behavior-range" min="0" max="1" step="0.01" value={control.value} disabled={locked} aria-label={`${control.label}.${lockLabel}`} aria-valuetext={formattedValue} onFocus={() => onSelect(control.id)} onChange={event => onControlChange?.(control.id, event.currentTarget.valueAsNumber)} />
            <strong className="state-value-output" aria-hidden="true">{formattedValue}</strong>
          </div>;
        })}
      </div>
    </section>
  </div>;
}
