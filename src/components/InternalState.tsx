import type { BrainSnapshot } from "../core/brain";

type InternalStateProps = {
  snapshot: BrainSnapshot;
  selectedId: string;
  onSelect: (id: string) => void;
};

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
      <div className="state-section-title"><span id="signals-title">SEÑALES INTERNAS</span><small>{snapshot.hasActivity ? "DATOS VERIFICABLES" : "SIN ACTIVIDAD"}</small></div>
      <div className="metric-grid">
        {snapshot.stateMetrics.map((metric) => <button key={metric.id} className={`metric-row ${metric.availability} ${selectedId === metric.id ? "selected" : ""}`} onClick={() => onSelect(metric.id)}>
          <span className="metric-label">{metric.label}{metric.availability === "planned" && <i>FUTURO</i>}</span>
          <span className="metric-track"><i style={{ width: `${metric.value * 100}%` }} /></span>
          <strong>{metric.value.toFixed(3)}</strong>
        </button>)}
      </div>
    </section>

    <section className="state-section retrieved-memory" aria-labelledby="retrieved-title">
      <div className="state-section-title"><span id="retrieved-title">MEMORIA RECUPERADA</span><small>{snapshot.retrievedMemoryCount ? `${snapshot.retrievedMemoryCount} COINCIDENCIAS LOCALES` : memory?.value ? "REGISTROS DISPONIBLES, NO UTILIZADOS" : "0 RECUPERACIONES"}</small></div>
      <button className="retrieved-row" onClick={() => onSelect("state-memory")}>
        <span>{snapshot.retrievedMemoryCount ? "TIPO NO EXPUESTO" : "SIN TIPO"}</span><strong>{snapshot.retrievedMemoryCount ? snapshot.retrievedMemoryTop : "NINGUNA MEMORIA RECUPERADA PARA UNA RESPUESTA"}</strong><em>{memory?.value.toFixed(3) ?? "0.000"}</em>
      </button>
    </section>

    <section className="state-section behavior-section" aria-labelledby="behavior-title">
      <div className="state-section-title"><span id="behavior-title">CONTROLES DE COMPORTAMIENTO</span><small>BLOQUEADOS HASTA SU IMPLEMENTACIÓN</small></div>
      <div className="control-grid">
        {snapshot.behaviorControls.map((control) => <div key={control.id} role="button" tabIndex={0} className={`control-row ${control.availability} ${selectedId === control.id ? "selected" : ""}`} onClick={() => onSelect(control.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(control.id); }}>
          <span>{control.label}{control.availability === "planned" && <i>FUTURO</i>}</span>
          <input type="range" min="0" max="1" step="0.01" value={control.value} disabled={control.locked} readOnly aria-label={`${control.label}: ${control.value.toFixed(2)}`} />
          <strong>{control.value.toFixed(2)}</strong>
        </div>)}
      </div>
    </section>
  </div>;
}
