import type { RetrievedMemoryView } from "../../core/memory/retrieval-observation";

export function describeRetrieval(retrieval: RetrievedMemoryView) {
  const labels = { idle: "SIN RECUPERACIÓN", prepared: "COINCIDENCIAS PREPARADAS", sending: "CONTEXTO EN ENVÍO", responded: "CONTEXTO PROPORCIONADO", bypassed: "RUTA SIN MEMORIA", failed: "ENVÍO FALLIDO" };
  const limited = retrieval.contextMode === "limited";
  const record = limited ? null : retrieval.top;
  const isFailed = retrieval.phase === "failed";

  if (limited) {
    return {
      status: "CONTEXTO LIMITADO",
      type: "—",
      text: "CONTEXTO RECORTADO · SIN RECUERDO COMPLETO CONFIRMADO",
      score: "—",
      scoreLabel: "Sin puntuación disponible",
      detail: "La ruta de visión limita el contexto enviado. No se presenta una coincidencia como recuerdo utilizado íntegramente.",
      source: null,
    };
  }

  if (isFailed) {
    return {
      status: labels.failed,
      type: "—",
      text: "SIN RECUERDOS RECUPERADOS",
      score: "—",
      scoreLabel: "Sin puntuación disponible",
      detail: "El envío no terminó; no se atribuye el uso de un recuerdo a una respuesta.",
      source: null,
    };
  }

  if (!record) {
    return {
      status: retrieval.phase === "prepared" ? "SIN COINCIDENCIAS" : labels[retrieval.phase],
      type: "—",
      text: "SIN RECUERDOS RECUPERADOS",
      score: "—",
      scoreLabel: "Sin puntuación disponible",
      detail: retrieval.phase === "bypassed" ? "La acción o respuesta local no necesitó el contexto de recuerdos."
        : retrieval.phase === "responded" ? "No hay un recuerdo completo y vigente acreditado para esta respuesta."
        : "Escribe una consulta en Conversación con Recuerdos activos para ver aquí los recuerdos recuperados.",
      source: null,
    };
  }

  const status = retrieval.phase === "responded"
    ? retrieval.contextMode === "full" ? labels.responded : "CONTEXTO NO CONFIRMADO"
    : retrieval.phase === "prepared" && !retrieval.count ? "SIN COINCIDENCIAS" : labels[retrieval.phase];
  const type = record.typeLabel;
  const text = record.text;
  const score = record.score !== null && record.score !== undefined
    ? record.scoreKind === "rank" ? `#${record.score}` : record.score.toFixed(3)
    : "—";
  const scoreLabel = record.scoreKind === "rank" ? "Rango de recuperación" : record.scoreKind === "lexical" ? "Puntuación léxica, no probabilidad" : "Sin puntuación disponible";
  let detail: string;
  switch (retrieval.phase) {
    case "prepared": detail = retrieval.count ? "Coincidencias locales para revisar: todavía no se han enviado al modelo." : "No se encontraron recuerdos elegibles para este mensaje."; break;
    case "responded": detail = retrieval.contextMode === "full"
      ? "Recuerdo incluido en el contexto del envío; esto no prueba que haya determinado la respuesta."
      : "La respuesta no incluye un recibo que confirme el contexto de memoria proporcionado."; break;
    case "bypassed": detail = "La acción o respuesta local no necesitó el contexto de recuerdos."; break;
    case "sending": detail = "Contexto autorizado para el envío en curso; todavía no hay respuesta."; break;
    default: detail = "Escribe una consulta en Conversación con Recuerdos activos para ver aquí los recuerdos recuperados.";
  }
  return { status, type, text, score, scoreLabel, detail, source: record.source };
}

export function RetrievedMemoryPanel({ retrieval, selected, onSelect }: {
  retrieval: RetrievedMemoryView;
  selected: boolean;
  onSelect: () => void;
}) {
  const view = describeRetrieval(retrieval);
  return <section className="state-section retrieved-memory" aria-labelledby="retrieved-title">
    <div className="state-section-title"><span id="retrieved-title" role="heading" aria-level={3}>MEMORIA RECUPERADA</span></div>
    <button
      type="button"
      className={`retrieved-row state-selection-target state-kind-retrieval ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-label={`Memoria recuperada, ${view.type}: ${view.text}. ${view.status}. ${view.scoreLabel}: ${view.score}. Abrir detalles en el inspector.`}
      onClick={onSelect}
    >
      <span>{view.type}</span><strong>{view.text}</strong><em title={view.scoreLabel}>{view.score}</em>
    </button>
  </section>;
}

export function RetrievedMemoryInspector({ retrieval }: { retrieval: RetrievedMemoryView }) {
  const view = describeRetrieval(retrieval);
  return <div className="state-retrieval-inspector">
    <h3>Memoria recuperada</h3>
    <span className="state-retrieval-status">{view.status}</span>
    <p><strong>{view.type}</strong></p>
    <p>{view.text}</p>
    <dl>
      <dt>{view.scoreLabel}</dt><dd>{view.score}</dd>
      <dt>Coincidencias vigentes</dt><dd>{retrieval.count}</dd>
    </dl>
    <p>{view.detail}</p>
    {view.source && <small>Fuente: {view.source}.</small>}
  </div>;
}
