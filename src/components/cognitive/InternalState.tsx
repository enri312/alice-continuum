import type { BrainSnapshot } from "../../core/cognitive/brain";

type InternalStateProps = {
  snapshot: BrainSnapshot;
  selectedId: string;
  onSelect: (id: string) => void;
};

function metricStatus(availability: "ready" | "planned") {
  return availability === "ready"
    ? { className: "state-status-implemented", label: "IMPLEMENTADO" }
    : { className: "state-status-planned", label: "FUTURO" };
}

export function InternalState({ snapshot, selectedId, onSelect }: InternalStateProps) {
  const memory = snapshot.stateMetrics.find((metric) => metric.id === "state-memory");
  const localRecords = snapshot.nodes.find((node) => node.id === "memory")?.value ?? "0 recuerdos";

  return <div className={`internal-state ${snapshot.hasActivity ? "has-activity" : "is-empty"}`}>
    <div className="nucleus-panel-label"><span>[03]</span><strong>REPLY + AFFECT + DRIVE STATE</strong><small>READ ONLY</small></div>
    <header className="state-header">
      <div><span className="state-monogram">ALI</span><strong>ALICE</strong><small>MODELO INTERNO · SOLO LECTURA</small></div>
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

    <section className="state-section retrieved-memory" aria-labelledby="retrieved-title">
      <div className="state-section-title"><span id="retrieved-title" role="heading" aria-level={3}>MEMORIA RECUPERADA</span><small>{snapshot.retrievedMemoryCount ? `${snapshot.retrievedMemoryCount} COINCIDENCIAS LOCALES` : memory?.value ? "REGISTROS DISPONIBLES, NO UTILIZADOS" : "0 RECUPERACIONES"}</small></div>
      <button
        type="button"
        className={`retrieved-row state-selection-target state-kind-retrieval ${selectedId === "state-memory" ? "selected" : ""}`}
        aria-pressed={selectedId === "state-memory"}
        aria-label={`Memoria recuperada: ${snapshot.retrievedMemoryCount ? snapshot.retrievedMemoryTop : "ninguna memoria recuperada para una respuesta"}. Actividad: ${memory?.value.toFixed(3) ?? "0.000"}. Abrir en el inspector.`}
        onClick={() => onSelect("state-memory")}
      >
        <span>{snapshot.retrievedMemoryCount ? "TIPO NO EXPUESTO" : "SIN TIPO"}</span><strong>{snapshot.retrievedMemoryCount ? snapshot.retrievedMemoryTop : "NINGUNA MEMORIA RECUPERADA PARA UNA RESPUESTA"}</strong><em>{memory?.value.toFixed(3) ?? "0.000"}</em>
      </button>
    </section>

    <section className="state-section behavior-section" aria-labelledby="behavior-title">
      <div className="state-section-title"><span id="behavior-title" role="heading" aria-level={3}>CONTROLES DE COMPORTAMIENTO</span><small>BLOQUEADOS HASTA SU IMPLEMENTACIÓN</small></div>
      <div className="control-grid">
        {snapshot.behaviorControls.map((control) => {
          const status = metricStatus(control.availability);
          const isSelected = selectedId === control.id;
          const formattedValue = control.value.toFixed(2);
          const lockLabel = control.locked ? " Bloqueado." : "";

          return <button
            key={control.id}
            type="button"
            className={`control-row state-selection-target state-kind-control state-availability-${control.availability} ${control.locked ? "state-lock-locked" : "state-lock-available"} ${control.availability} ${isSelected ? "selected" : ""}`}
            aria-pressed={isSelected}
            aria-label={`${control.label}: ${formattedValue}. Estado: ${status.label.toLocaleLowerCase("es")}.${lockLabel} Abrir en el inspector.`}
            onClick={() => onSelect(control.id)}
          >
            <span className="control-label state-item-label">
              <span className="state-item-name">{control.label}</span>
              <span className="state-status-list">
                <i className={`state-status-chip ${status.className}`}>{status.label}</i>
                {control.locked && <i className="state-status-chip state-status-locked">BLOQUEADO</i>}
              </span>
            </span>
            <span className="metric-track control-track state-value-track" aria-hidden="true"><i style={{ width: `${control.value * 100}%` }} /></span>
            <strong className="state-value-output" aria-hidden="true">{formattedValue}</strong>
          </button>;
        })}
      </div>
    </section>
  </div>;
}
