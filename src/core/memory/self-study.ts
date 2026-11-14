export const selfStudyTracks = ["arithmetic", "algebra", "geometry", "trigonometry", "calculus", "linear-algebra", "probability", "statistics", "logic", "biblical-history", "emotional-intelligence", "empathy", "solidarity", "humility", "critical-thinking", "ethics"] as const;
export type SelfStudyTrack = typeof selfStudyTracks[number];
export type SelfStudyDomain = "mathematics" | "biblical-history" | "emotional-intelligence" | "empathy" | "solidarity" | "humility" | "critical-thinking" | "ethics";
export type SelfStudyPhase = "idle" | "studying" | "completed" | "partial" | "deferred" | "error" | "disabled";
export type SelfStudyRecord = {
  id: string;
  lessonId: string;
  track: SelfStudyTrack;
  domain: SelfStudyDomain;
  title: string;
  content: string;
  sourceUrl: string;
  sourceTitle: string;
  lessonSha256: string;
  studiedAt: string;
  attempts: number;
  passes: number;
  lastPassed: boolean;
  active: boolean;
};
export type SelfStudySnapshot = {
  schemaVersion: 1;
  enabled: boolean;
  biblicalTradition: "catholic";
  phase: SelfStudyPhase;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  records: SelfStudyRecord[];
};

export const selfStudyTrackLabels: Record<SelfStudyTrack, string> = {
  arithmetic: "Aritmética", algebra: "Álgebra", geometry: "Geometría", trigonometry: "Trigonometría",
  calculus: "Cálculo", "linear-algebra": "Álgebra lineal", probability: "Probabilidad", statistics: "Estadística", logic: "Lógica",
  "biblical-history": "Historia bíblica católica", "emotional-intelligence": "Psicología e inteligencia emocional", empathy: "Empatía", solidarity: "Solidaridad", humility: "Humildad", "critical-thinking": "Pensamiento crítico", ethics: "Ética",
};

const recordKeys = ["id", "lessonId", "track", "domain", "title", "content", "sourceUrl", "sourceTitle", "lessonSha256", "studiedAt", "attempts", "passes", "lastPassed", "active"];
const snapshotKeys = ["schemaVersion", "enabled", "biblicalTradition", "phase", "lastStartedAt", "lastCompletedAt", "lastError", "records"];
const phases: SelfStudyPhase[] = ["idle", "studying", "completed", "partial", "deferred", "error", "disabled"];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const validText = (value: unknown, maximum: number): value is string => typeof value === "string" && Boolean(value.trim()) && Array.from(value).length <= maximum;
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uint = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffff_ffff;
function validSource(value: unknown) {
  if (!validText(value, 2048)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}

/** Validate the native contract before projecting externally sourced knowledge. */
export function parseSelfStudySnapshot(value: unknown): SelfStudySnapshot {
  if (!object(value) || !exactKeys(value, snapshotKeys) || value.schemaVersion !== 1 || typeof value.enabled !== "boolean"
    || value.biblicalTradition !== "catholic" || !phases.includes(value.phase as SelfStudyPhase)
    || ![value.lastStartedAt, value.lastCompletedAt].every(date => date === null || validDate(date))
    || !(value.lastError === null || validText(value.lastError, 2000)) || !Array.isArray(value.records) || value.records.length > 48) {
    throw Error("El autoestudio no tiene un formato válido.");
  }
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!object(record) || !exactKeys(record, recordKeys) || !validText(record.lessonId, 96) || !/^[a-z0-9-]+$/.test(record.lessonId)
      || record.id !== `study:${record.lessonId}` || ids.has(record.id as string) || !selfStudyTracks.includes(record.track as SelfStudyTrack)
      || record.domain !== (selfStudyTracks.indexOf(record.track as SelfStudyTrack) < 9 ? "mathematics" : record.track)
      || !validText(record.title, 240) || !validText(record.content, 8000) || !validText(record.sourceTitle, 300) || !validSource(record.sourceUrl)
      || typeof record.lessonSha256 !== "string" || !/^sha256:[a-f0-9]{64}$/i.test(record.lessonSha256) || !validDate(record.studiedAt)
      || !uint(record.attempts) || !uint(record.passes) || record.attempts < 1 || record.passes > record.attempts
      || typeof record.active !== "boolean" || typeof record.lastPassed !== "boolean" || (record.lastPassed && record.passes === 0)) {
      throw Error("El autoestudio contiene una lección inválida o una materia fuera del alcance.");
    }
    ids.add(record.id as string);
  }
  return value as SelfStudySnapshot;
}

/** Only lessons with a passed latest exercise enter conversation retrieval. */
export function selfStudyForConversation(snapshot: SelfStudySnapshot | null) {
  return (snapshot?.records ?? []).filter(record => record.active && record.lastPassed && record.passes > 0).map(record => ({
    id: record.id, kind: "Autoestudio" as const, studyLearning: true,
    intention: `${selfStudyTrackLabels[record.track]} · ${record.title}`, summary: record.content,
    memoryType: "semantic" as const, startedAt: record.studiedAt, finishedAt: record.studiedAt,
    source: `${record.sourceTitle} · ${record.sourceUrl} · ${record.lessonSha256} · estudiado ${record.studiedAt}`,
  }));
}

/**
 * Every persisted study record can be inspected in the cognitive volume.
 * This projection is separate from conversation retrieval: failed exercises
 * and withdrawn lessons remain visible without becoming usable RAG knowledge.
 */
export function selfStudyForCognitiveVolume(snapshot: SelfStudySnapshot | null) {
  return (snapshot?.records ?? []).map(record => ({
    id: record.id, kind: "Autoestudio" as const, studyLearning: true,
    studyPasses: record.passes,
    studyState: !record.active ? "withdrawn" as const
      : record.lastPassed && record.passes > 0 ? "available" as const : "review" as const,
    intention: `${selfStudyTrackLabels[record.track]} · ${record.title}`, summary: record.content,
    memoryType: "semantic" as const, finishedAt: record.studiedAt,
    source: `${record.sourceTitle} · ${record.sourceUrl} · ${record.lessonSha256} · estudiado ${record.studiedAt}`,
  }));
}
