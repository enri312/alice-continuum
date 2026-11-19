import { buildReviewQueue } from "./memory-consolidation";
import { isLegacyMemoryDiscardable } from "./memory-discard";
import { memoryOrigin, memoryOriginLabel, memoryReviewProposal } from "./memory-review-proposals";
import { workingMemoryRemainingLabel, workingMemoryUsagePercent } from "./working-memory";
import { selfStudyTrackLabels, type SelfStudyPhase } from "./self-study";
import { memorySessionSnapshot } from "./memory-session";
import { learningSnapshot } from "./learning-session";

const formatter = new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" });
export const memoryDateLabel = (value?: string) => value && Number.isFinite(Date.parse(value)) ? formatter.format(new Date(value)) : "Fecha no disponible";
const number = new Intl.NumberFormat("es-PY");
const types = { semantic: "Concepto", procedural: "Procedimiento", preference: "Preferencia", episodic: "Experiencia" };
const validity = { confirmed: "REGISTRADA", conflict: "EN CONFLICTO", archived: "ARCHIVADA" };
const phases: Record<SelfStudyPhase, string> = {
  idle: "Preparado para el próximo ciclo", studying: "Estudiando lecciones y resolviendo ejercicios…", completed: "Ciclo completado",
  partial: "Ciclo parcial · quedan lecciones por repasar", deferred: "Estudio diferido · conversación y voz tienen prioridad",
  error: "No se pudo completar el ciclo", disabled: "Autoestudio pausado",
};

export function projectMemoryPage() {
  const { memoryStatus, memoryPath, ownerProfile, sessions, finishedIndices, workingMemory, ownerProfileError } = memorySessionSnapshot();
  const { selfStudy, selfStudyError, automaticMemory, automaticPhase, automaticError } = learningSnapshot();
  const finished = finishedIndices.map(index => sessions[index]).filter(record => record !== undefined);
  const profileCount = ownerProfile?.records.length ?? 0;
  const byOrigin = { conversation: 0, observation: 0, teaching: 0, other: 0 };
  const records = finished.map(record => {
    const origin = memoryOrigin(record);
    if (origin in byOrigin) byOrigin[origin as keyof typeof byOrigin]++;
    return {
      id: record.id, intention: record.intention, summary: record.summary ?? "", source: record.source ?? "", nextStep: record.nextStep ?? "",
      teaching: record.kind === "Enseñanza", status: record.memoryStatus ?? null, validity: record.memoryStatus ? validity[record.memoryStatus] : "NO EVALUADA",
      archived: record.archiveStatus === "archived", version: record.memoryVersion ?? null,
      deletionDate: record.deletionStatus === "scheduled" ? memoryDateLabel(record.deletionEligibleAt) : null,
      importance: record.importance ?? 3, stability: Math.round((record.storageStrength ?? .08) * 100),
      recalls: record.successfulRecalls ?? 0, reviews: record.successfulReviews ?? 0,
      typeLabel: record.memoryType ? types[record.memoryType] : null, memoryType: record.memoryType ?? "",
      origin: memoryOriginLabel(record), date: record.finishedAt ? memoryDateLabel(record.finishedAt) : "",
      discardable: isLegacyMemoryDiscardable(record), proposal: memoryReviewProposal(record) ?? null,
    };
  });
  const due = buildReviewQueue(finished.filter(record => record.kind === "Enseñanza" && record.memoryStatus !== undefined && record.archiveStatus !== "archived"))
    .filter(review => review.due).length;
  const studyRecords = selfStudy?.records ?? [];
  const available = (record: typeof studyRecords[number]) => record.active && record.lastPassed && record.passes > 0;
  return {
    memoryStatus, memoryPath, records, byOrigin, profileCount, due, ownerProfile, ownerProfileError,
    working: workingMemory ? {
      state: workingMemory.state, generation: workingMemory.generation, messageCount: workingMemory.messageCount,
      maxMessages: workingMemory.maximumMessages, exchangeCount: workingMemory.exchangeCount,
      characters: number.format(workingMemory.characterCount), maxCharacters: number.format(workingMemory.maximumCharacters),
      usage: workingMemoryUsagePercent(workingMemory), remaining: workingMemoryRemainingLabel(workingMemory),
      exchanges: workingMemory.exchanges.map(exchange => ({
        id: exchange.exchangeId, provider: exchange.provider, model: exchange.model, date: memoryDateLabel(exchange.createdAt),
        source: exchange.provider === "Ollama local" ? "inferenciaLocal" : "cloudConversation",
      })),
    } : null,
    study: {
      ready: selfStudy !== null, enabled: selfStudy?.enabled ?? false, error: selfStudyError || selfStudy?.lastError || "",
      phase: selfStudy ? phases[selfStudy.phase] : "Cargando estado del autoestudio…", studied: studyRecords.length,
      available: studyRecords.filter(available).length, tracks: Object.values(selfStudyTrackLabels).join(" · "),
      records: [...studyRecords].sort((a,b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt)).slice(0,8).map(record => ({
        id: record.id, available: available(record), track: selfStudyTrackLabels[record.track], title: record.title, content: record.content,
        url: record.sourceUrl, source: record.sourceTitle, date: memoryDateLabel(record.studiedAt), sha: record.lessonSha256,
        passes: record.passes, attempts: record.attempts, passed: record.lastPassed,
      })),
    },
    automatic: {
      ready: automaticMemory !== null, enabled: automaticMemory?.enabled ?? false, count: automaticMemory?.activeCount ?? 0, error: automaticError || "",
      phase: automaticPhase === "evaluating" ? "Alice está evaluando qué merece conservar…" : automaticMemory?.enabled ? "Activo · evalúa las nuevas conversaciones con Gemma" : "Pausado",
      records: [...(automaticMemory?.records ?? [])].reverse().map(record => ({
        id: record.id, active: record.active, corrected: record.ownerCorrected, typeLabel: types[record.memoryType] === "Concepto" ? "Dato declarado" : types[record.memoryType],
        content: record.content, evidence: record.evidence, importance: record.importance, date: memoryDateLabel(record.createdAt), source: record.sourceExchangeId,
      })),
    },
  };
}
