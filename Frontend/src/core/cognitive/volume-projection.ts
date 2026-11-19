import { affectPalette } from "./affect";
import type { CoreActivitySnapshot } from "./core-activity";
import { hasCoreActivitySignal } from "./core-activity";
import { resolveCognitiveMemoryAppearance, type CognitiveVolumeNode, type ConfirmedMemoryAssociation } from "./cognitive-volume";
import { resolveKnowledgeGraphEvidenceQuote } from "../memory/knowledge-graph-volume";
import type { CognitiveMemoryNode } from "../memory/cognitive-memory";
import type { LearningSourceViewState } from "../memory/learning-session";
import type { SelfStudyPhase } from "../memory/self-study";
import type { AutomaticLearningPhase } from "../memory/automatic-memory";

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
const layerLabels = { episodic: "episódica", semantic: "semántica", procedural: "procedimental", preference: "preferencias", self: "modelo del propietario", unclassified: "sin clasificar" };
const statusLabels = { confirmed: "confirmado", learned: "aprendido automáticamente", conflict: "en conflicto", archived: "archivado", historical: "registro histórico" };
const accessibilityLabels = { notAssessed: "accesibilidad no evaluada", accessible: "recuperable", dormant: "en reposo" };
const originLabels = { study: "Autoestudio con fuente", automatic: "Aprendizaje al conversar", profile: "Perfil del propietario", record: "Registro de memoria" };
const dateLabels = { study: "Último estudio", created: "Creación del registro", session: "Fecha de la sesión" };
const studyStateLabels = { available: "Disponible para conversación", review: "En estudio · requiere ejercicio aprobado", withdrawn: "Retirado del contexto · registro conservado" };
const date = new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" });
const clock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function volumeActivityFrame(activity: CoreActivitySnapshot | null, status: "loading" | "ready" | "unavailable") {
  const view = status === "ready" && !hasCoreActivitySignal(activity) ? "idle" : status;
  const eventCount = activity?.windowEventCount ?? 0;
  const audit = activity ? (activity.auditHealthy ? "healthy" : "degraded") : "unknown";
  return {
    status, view, audit, eventCount,
    method: activity?.method?.toUpperCase() ?? "R3-RECENCY-MOTOR-V2",
    summary: status === "loading" ? "LEYENDO AUDITORÍA LOCAL…" : status === "unavailable" ? "SNAPSHOT NATIVO NO DISPONIBLE"
      : `${eventCount} ${eventCount === 1 ? "EVENTO" : "EVENTOS"} / ${Math.round((activity?.windowMs ?? 0) / 60_000)} MIN · SEÑAL ${(activity?.overallSignal ?? 0).toFixed(3)} · ${activity?.auditHealthy ? "AUDITORÍA ÍNTEGRA" : "AUDITORÍA CON LÍNEAS INVÁLIDAS"}`,
  };
}

export function projectLearningActivity(state: VolumeLearningActivityState) {
  const sources = [
    { id: "study", label: "Autoestudio", source: state.selfStudySource,
      detail: state.selfStudyPhase ? `Fase registrada: ${studyLabels[state.selfStudyPhase]}` : "Esperando la primera lectura" },
    { id: "automatic", label: "Al conversar", source: state.automaticSource,
      detail: state.automaticEnabled === false ? "Aprendizaje pausado" : state.automaticPhase === "evaluating" ? "Última señal: revisión del intercambio"
        : state.automaticPhase === "error" ? "Última señal: no se pudo completar la revisión" : "Esperando un intercambio para revisar" },
  ];
  const hasError = sources.some(item => item.source.status === "error") || state.recordsStatus === "error";
  const hasPending = sources.some(item => item.source.status === "loading") || state.recordsStatus === "loading";
  return {
    native: state.native, status: hasError ? "error" : hasPending ? "loading" : "ready",
    sources: sources.map(({ id, label, source, detail }) => ({
      id, label, status: source.status, detail,
      updated: source.updatedAt === null ? null : clock.format(source.updatedAt),
      pollingOnly: Boolean(source.eventError && !source.error),
      warning: source.error || source.eventError || null,
    })),
    recordsStatus: state.recordsStatus, recordsError: state.recordsError, cycleError: state.selfStudyLastError,
  };
}

export function projectVolumeInspector(node: CognitiveVolumeNode, memories: ReadonlyMap<string, CognitiveMemoryNode>, associations: readonly ConfirmedMemoryAssociation[]) {
  const memory = node.memory;
  if (!memory) return { id: node.id, label: node.label, detail: node.detail, memory: null, associations: [] };
  const appearance = resolveCognitiveMemoryAppearance(memory);
  const reviewedAffect = appearance.fillMode === "affect";
  const accessibility = accessibilityLabels[memory.accessibility];
  const states = [layerLabels[memory.layer], statusLabels[memory.status], accessibility];
  if (memory.archived) states.push("archivado");
  if (memory.deletionScheduled) states.push("eliminación programada");
  if (memory.suppressed) states.push("suprimido");
  states.push(`v${memory.version}`);
  return {
    id: node.id, label: memory.label, detail: node.detail,
    memory: {
      id: memory.id, content: memory.content ?? null, origin: originLabels[memory.origin],
      recordedAt: memory.recordedAt && memory.recordedAtKind ? `${dateLabels[memory.recordedAtKind]} · ${date.format(new Date(memory.recordedAt))}` : "Fecha no declarada en la fuente",
      studyDate: memory.recordedAtKind === "study", retrieved: memory.retrieved,
      studyState: memory.studyState ? studyStateLabels[memory.studyState] : null, studyPasses: memory.studyPasses ?? 0,
      fillMode: appearance.fillMode, fillLabel: appearance.fillLabel, fillColor: appearance.color.join(","),
      marker: appearance.states[0]?.id ?? "normal",
      markers: appearance.states.length ? `Marcas de estado: ${appearance.states.map(state => state.label).join(" · ")}` : "Sin marcas adicionales de estado",
      importance: memory.importance === null ? "sin evaluar" : `${memory.importance}/5`,
      affectLabel: reviewedAffect ? "Asociación emocional revisada vigente" : memory.affects.length ? "Evaluación emocional conservada, sin aplicar al color en este estado" : "Sin evaluación emocional vigente",
      affects: memory.affects.map(item => ({
        id: item.emotion, evidence: item.evidence,
        label: `${affectPalette.find(channel => channel.id === item.emotion)?.label} · ${Math.round(item.intensity * 100)}%${reviewedAffect ? "" : " · registro conservado, sin aplicar al color"}`,
      })),
      stateSummary: states.join(" · "),
      provenance: [
        ["Versión", `${memory.version} · ${memory.version > 1 ? "reconsolidada" : "original"}`],
        ["Retención", memory.deletionScheduled ? "espera gobernada antes de retiro" : "sin eliminación programada"],
        ["Recuperación", memory.archived ? "bloqueada por archivo reversible" : memory.suppressed ? "suprimida por el propietario" : accessibility],
        ["Estabilidad", memory.storageStrength === null ? "sin métrica" : `${Math.round(memory.storageStrength * 100)}%`],
        ["Recuperaciones", String(memory.successfulRecalls)],
        ["Fuente", memory.source ?? "no declarada"],
      ],
    },
    associations: associations.filter(item => item.evidence.some(evidence => evidence.recordId === memory.id)).map(item => ({
      id: item.id, evidence: item.evidence.map(evidence => {
        const source = memories.get(evidence.recordId);
        const quote = source ? resolveKnowledgeGraphEvidenceQuote(source.label, evidence.startByte, evidence.endByte) : null;
        return {
          id: evidence.recordId, label: source?.label ?? evidence.recordId,
          quote: quote ? `“${quote}”` : "La fuente ya no coincide con la posición validada.",
          reference: `intención · v${evidence.recordVersion} · bytes ${evidence.startByte}–${evidence.endByte}`,
        };
      }),
    })),
  };
}
