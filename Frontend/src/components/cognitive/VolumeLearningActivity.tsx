import type { SelfStudyPhase } from "../../core/memory/self-study";
import type { AutomaticLearningPhase } from "../../core/memory/automatic-memory";
import type { LearningSourceViewState } from "../../hooks/useLearningSources";

export type VolumeLearningActivityState = {
  native: boolean;
  selfStudyPhase: SelfStudyPhase | null;
  selfStudyLastError: string | null;
  automaticPhase: AutomaticLearningPhase;
  automaticEnabled: boolean | null;
  selfStudySource: LearningSourceViewState;
  automaticSource: LearningSourceViewState;
  recordsStatus: "loading" | "ready" | "error";
  recordsError: string;
};

const studyLabels: Record<SelfStudyPhase, string> = {
  idle: "Preparado para el próximo ciclo",
  studying: "Estudiando lecciones y resolviendo ejercicios",
  completed: "Ciclo completado",
  partial: "Ciclo parcial · quedan lecciones por repasar",
  deferred: "En espera · conversación y voz tienen prioridad",
  error: "No se pudo completar el ciclo",
  disabled: "Autoestudio pausado",
};

const clock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function VolumeLearningActivity({ state, onRefresh }: { state: VolumeLearningActivityState; onRefresh?: () => void }) {
  if (!state.native) return <p className="volume-learning-offline" role="status">La lectura del aprendizaje está disponible en la aplicación de escritorio.</p>;
  const sources = [
    { id: "study", label: "Autoestudio", source: state.selfStudySource,
      detail: state.selfStudyPhase ? `Fase registrada: ${studyLabels[state.selfStudyPhase]}` : "Esperando la primera lectura" },
    { id: "automatic", label: "Al conversar", source: state.automaticSource,
      detail: state.automaticEnabled === false ? "Aprendizaje pausado" : state.automaticPhase === "evaluating" ? "Última señal: revisión del intercambio"
        : state.automaticPhase === "error" ? "Última señal: no se pudo completar la revisión" : "Esperando un intercambio para revisar" },
  ];
  const hasError = sources.some(item => item.source.status === "error") || state.recordsStatus === "error";
  const hasPending = sources.some(item => item.source.status === "loading") || state.recordsStatus === "loading";
  return <section className="volume-learning-activity" data-state={hasError ? "error" : hasPending ? "loading" : "ready"} aria-label="Estado del aprendizaje de Alice">
    <div className="volume-learning-source-states">
      {sources.map(({ id, label, source, detail }) => <div key={id} data-state={source.status}>
        <strong>{label}</strong><span role="status">{source.status === "error" ? "No se pudo actualizar la lectura" : source.status === "loading" ? "Conectando con Alice…" : detail}</span>
        <small>{source.updatedAt === null ? "Sin lectura confirmada" : `Última lectura correcta · ${clock.format(source.updatedAt)}`}</small>
        {source.eventError && !source.error && <small>Actualizando mediante consultas periódicas</small>}
        {(source.error || source.eventError) && <details><summary>Ver aviso de conexión</summary><p>{source.error || source.eventError}</p><p>La última lectura válida se conserva. Se reintenta automáticamente.</p></details>}
      </div>)}
      <div data-state={state.recordsStatus}><strong>Recuerdos y perfil</strong><span role="status">{state.recordsStatus === "ready" ? "Lectura inicial completa" : state.recordsStatus === "error" ? "No se pudo completar la lectura" : "Leyendo los registros iniciales…"}</span>{state.recordsError && <small>{state.recordsError}</small>}</div>
    </div>
    <div className="volume-learning-refresh"><span>{hasError ? "Se conserva el último estado conocido; una fuente puede estar desactualizada." : "Los cambios se incorporan al volumen cuando Alice los guarda."}</span>{onRefresh && <button type="button" onClick={onRefresh}>Actualizar lectura</button>}</div>
    {state.selfStudyLastError && <p className="volume-learning-cycle-error" role="status">Autoestudio: {state.selfStudyLastError}</p>}
  </section>;
}
