import type { BrainSnapshot } from "../../core/cognitive/brain";

export type PlannerItemId = "planner-response" | "planner-intention" | "planner-utility" | "planner-risk" | "planner-novelty" | "planner-trace";

export type PlannerInspectorItem = {
  label: string;
  value: string;
  detail: string;
};

export const plannerInspectorItems: Partial<Record<string, PlannerInspectorItem>> = {
  "planner-response": { label: "Respuesta seleccionada", value: "ninguna", detail: "El planificador todavía no recibió ni comparó respuestas candidatas." },
  "planner-intention": { label: "Intención", value: "sin evaluar", detail: "No existe todavía un clasificador de intención conectado al planificador." },
  "planner-utility": { label: "Utilidad", value: "sin calcular", detail: "Esta futura puntuación deberá medir el ajuste al objetivo; no representará certeza ni conciencia." },
  "planner-risk": { label: "Riesgo", value: "sin calcular", detail: "La revisión previa ya limita los envíos, pero todavía no existe una puntuación formal de riesgo de respuesta." },
  "planner-novelty": { label: "Novedad", value: "sin calcular", detail: "No se mide repetición o novedad. El valor permanecerá vacío hasta definir un método verificable." },
  "planner-trace": { label: "Traza de decisión", value: "vacía", detail: "No hay una decisión que explicar. La pantalla solo enumera las etapas que deberán producir evidencia real." },
};

type ActionPlannerProps = {
  snapshot: BrainSnapshot;
  selectedId: string;
  onSelect: (id: PlannerItemId) => void;
};

const metrics: { id: PlannerItemId; code: string; label: string }[] = [
  { id: "planner-intention", code: "INT", label: "Intención" },
  { id: "planner-utility", code: "UTL", label: "Utilidad" },
  { id: "planner-risk", code: "RSK", label: "Riesgo" },
  { id: "planner-novelty", code: "NOV", label: "Novedad" },
];

const trace = [
  { sequence: "01", module: "CANDIDATE_GENERATOR", state: "NO IMPLEMENTADO" },
  { sequence: "02", module: "INTENT_CLASSIFIER", state: "NO IMPLEMENTADO" },
  { sequence: "03", module: "SAFETY_SCORER", state: "NO IMPLEMENTADO" },
  { sequence: "04", module: "RESPONSE_ARBITER", state: "SIN SELECCIÓN" },
];

export function ActionPlanner({ snapshot, selectedId, onSelect }: ActionPlannerProps) {
  return <div className={`action-planner ${snapshot.hasActivity ? "has-context" : "is-empty"}`}>
    <header className="planner-header">
      <div><span>[04]</span><strong>ACTION / LANGUAGE PLANNER</strong></div>
      <p><i />{snapshot.hasActivity ? "CONTEXTO LOCAL DISPONIBLE" : "SIN ENTRADA"}</p>
    </header>

    <section className="planner-source" aria-label="Fuente del planificador">
      <span>INPUT CHECKPOINT</span><strong>{snapshot.hasActivity ? snapshot.focus : "NINGUNA ENTRADA REGISTRADA"}</strong><small>{snapshot.hasActivity ? "La entrada existe, pero aún no fue evaluada por un planificador." : "Alice espera una interacción verificable."}</small>
    </section>

    <button className={`planner-response ${selectedId === "planner-response" ? "selected" : ""}`} onClick={() => onSelect("planner-response")}>
      <span>SELECTED RESPONSE // CANDIDATE 000</span><strong>NO HAY RESPUESTA SELECCIONADA</strong><small>0 candidatas · generador sin implementar</small><i aria-hidden="true" />
    </button>

    <section className="planner-metrics" aria-label="Evaluaciones sin calcular">
      {metrics.map((metric) => <button key={metric.id} className={selectedId === metric.id ? "selected" : ""} onClick={() => onSelect(metric.id)}>
        <span><i>{metric.code}</i>{metric.label}</span><span className="planner-meter"><i /></span><strong>—</strong><small>SIN CALCULAR</small>
      </button>)}
    </section>

    <button className={`planner-trace ${selectedId === "planner-trace" ? "selected" : ""}`} onClick={() => onSelect("planner-trace")}>
      <span className="planner-section-title">DECISION TRACE // VACÍA <small>0 evidencias</small></span>
      {trace.map((entry) => <span className="planner-trace-row" key={entry.sequence}><i>{entry.sequence}</i><strong>{entry.module}</strong><em>{entry.state}</em></span>)}
    </button>

    <div className="planner-queue"><span>CANDIDATE QUEUE</span><strong>000</strong><i /><small>Ningún texto espera evaluación o salida.</small></div>
  </div>;
}
