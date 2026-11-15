import type { CognitiveMemoryNode } from "../../core/memory/cognitive-memory";
import { buildVolumeLearningSnapshot } from "../../core/cognitive/volume-learning";

export type VolumeLearningChange = { id: string; kind: "added" | "changed" | "removed"; label: string; observedAt: number };
export type VolumeStudyProgress = { studied: number; available: number; attempts: number; passes: number };
export type VolumeObservedLearning = { baseline: number | null; added: number; changed: number; removed: number };

type Props = {
  nodes: readonly CognitiveMemoryNode[];
  observed: VolumeObservedLearning;
  changes: readonly VolumeLearningChange[];
  ready: boolean;
  studyProgress?: VolumeStudyProgress | null;
};

const changeLabels = { added: "Nuevo nodo", changed: "Registro actualizado", removed: "Fuera de esta vista" };
const clock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function VolumeLearningSummary({ nodes, observed, changes, ready, studyProgress }: Props) {
  const learning = buildVolumeLearningSnapshot(nodes);
  return <section className="volume-learning-summary" data-has-changes={observed.added + observed.changed > 0} aria-labelledby="volume-learning-title">
    <header><div><h4 id="volume-learning-title">Así evoluciona su conocimiento</h4><small>Cada nodo conserva un registro real. Al incorporarse o cambiar, puedes ver qué lo originó.</small></div>
      <div className="volume-learning-observed"><span>{ready && observed.baseline !== null ? `Desde esta apertura · base ${observed.baseline}` : "Esperando la lectura inicial"}</span><strong>{observed.added} {observed.added === 1 ? "nuevo" : "nuevos"} · {observed.changed} {observed.changed === 1 ? "actualizado" : "actualizados"}</strong></div>
    </header>
    <dl className="volume-learning-metrics" aria-label="Fuentes de los conocimientos visibles">
      <div><dt>Autoestudio registrado</dt><dd>{learning.byOrigin.study}</dd><small>{studyProgress ? `${studyProgress.available} disponibles · ${studyProgress.attempts} intentos` : "Lecciones y ejercicios guardados"}</small></div>
      <div><dt>Aprendido al conversar</dt><dd>{learning.byOrigin.automatic}</dd><small>Declaraciones conservadas con su origen</small></div>
      <div><dt>Perfil del propietario</dt><dd>{learning.byOrigin.profile}</dd><small>Hechos de perfil identificados</small></div>
      <div><dt>Otros recuerdos</dt><dd>{learning.byOrigin.record}</dd><small>Episodios y registros existentes</small></div>
    </dl>
    <details className="volume-learning-changes"><summary>Cambios observados en esta vista{changes.length > 0 ? ` · ${changes.length} cambio${changes.length === 1 ? "" : "s"}` : ""}</summary>
      {changes.length ? <ul>{changes.map((change, index) => <li key={`${change.observedAt}:${change.id}:${index}`}><span>{changeLabels[change.kind]}</span><strong>{change.label}</strong><time dateTime={new Date(change.observedAt).toISOString()}>{clock.format(change.observedAt)}</time></li>)}</ul> : <p>Los registros que ya estaban guardados forman el punto de partida. Las nuevas incorporaciones y modificaciones aparecerán aquí mientras esta vista siga abierta.</p>}
      {observed.removed > 0 && <p>{observed.removed} registros dejaron de aparecer en esta proyección. Esto no demuestra que se hayan borrado del almacenamiento.</p>}
    </details>
    <p className="volume-learning-note">Este seguimiento empieza al leer los datos actuales; no reconstruye un historial anterior. La escala y la malla son ilustrativas: más registros visibles no miden inteligencia ni modifican los pesos de Gemma.</p>
  </section>;
}
