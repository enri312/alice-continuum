import type { BrainSnapshot } from "../../core/cognitive/brain";

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
  const retrieval = snapshot.retrievedMemory;
  const recalled = retrieval?.top;
  const retrievalLabels = { idle: "SIN RECUPERACIÓN", prepared: "COINCIDENCIAS PREPARADAS", sending: "CONTEXTO EN ENVÍO", responded: "CONTEXTO PROPORCIONADO", bypassed: "RUTA SIN MEMORIA", failed: "ENVÍO FALLIDO" };
  const retrievalLabel = retrieval?.phase === "responded"
    ? retrieval.contextMode === "full" ? "CONTEXTO PROPORCIONADO" : retrieval.contextMode === "limited" ? "CONTEXTO LIMITADO" : "CONTEXTO NO CONFIRMADO"
    : retrieval?.phase === "prepared" && !retrieval.count ? "SIN COINCIDENCIAS" : retrieval ? retrievalLabels[retrieval.phase] : "SIN RECUPERACIÓN";
  const limited = retrieval?.contextMode === "limited";
  const recallText = limited ? "CONTEXTO RECORTADO · NO SE CONFIRMA UN RECUERDO COMPLETO" : recalled?.text ?? "NINGÚN RECUERDO INCLUIDO EN UNA RESPUESTA";
  const recallType = !limited && recalled ? recalled.typeLabel : "SIN TIPO";
  const score = !limited && recalled?.score !== null && recalled?.score !== undefined
    ? recalled.scoreKind === "rank" ? `#${recalled.score}` : recalled.score.toFixed(3)
    : "—";
  const scoreLabel = recalled?.scoreKind === "rank" ? "Rango de recuperación" : recalled?.scoreKind === "lexical" ? "Puntuación léxica, no probabilidad" : "Sin puntuación disponible";

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

    <section className="state-section retrieved-memory" aria-labelledby="retrieved-title">
      <div className="state-section-title"><span id="retrieved-title" role="heading" aria-level={3}>MEMORIA RECUPERADA</span><small>{retrievalLabel}{retrieval?.count ? ` · ${retrieval.count}` : ""}</small></div>
      <button
        type="button"
        className={`retrieved-row state-selection-target state-kind-retrieval ${selectedId === "state-memory" ? "selected" : ""}`}
        aria-pressed={selectedId === "state-memory"}
        aria-label={`Memoria recuperada, ${recallType}: ${recallText}. ${retrievalLabel}. ${scoreLabel}: ${score}. Abrir en el inspector.`}
        onClick={() => onSelect("state-memory")}
      >
        <span>{recallType}</span><strong>{recallText}</strong><em title={scoreLabel}>{score}</em>
      </button>
      <p className="state-retrieval-detail">{retrieval?.phase === "prepared" ? retrieval.count ? "Coincidencias locales para revisar: todavía no se han enviado al modelo." : "No se encontraron recuerdos elegibles para este mensaje." : limited ? "La ruta de visión limita el contexto enviado. No se presenta una coincidencia como recuerdo utilizado íntegramente." : retrieval?.phase === "responded" ? retrieval.contextMode !== "full" ? "La respuesta no incluye un recibo que confirme el contexto de memoria proporcionado." : recalled ? "Recuerdo incluido en el contexto del envío; esto no prueba que haya determinado la respuesta." : "Los recuerdos del envío ya no están disponibles o cambiaron en los registros actuales." : retrieval?.phase === "bypassed" ? "La acción o respuesta local no necesitó el contexto de recuerdos." : retrieval?.phase === "failed" ? "El envío no terminó; no se atribuye el uso de un recuerdo a una respuesta." : retrieval?.phase === "sending" ? "Contexto autorizado para el envío en curso; todavía no hay respuesta." : "Esta fila mostrará el recuerdo recuperado para un envío autorizado, con su categoría real."}{!limited && recalled?.source ? ` Fuente: ${recalled.source}.` : ""}</p>
    </section>

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
