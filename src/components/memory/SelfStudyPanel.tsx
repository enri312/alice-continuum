import { useState } from "react";
import { selfStudyTrackLabels, type SelfStudyPhase, type SelfStudySnapshot } from "../../core/memory/self-study";
import "../../styles/automatic-memory.css";

type Props = { snapshot: SelfStudySnapshot | null; error?: string; onToggle: (enabled: boolean) => Promise<void> };
const phaseLabels: Record<SelfStudyPhase, string> = {
  idle: "Preparado para el próximo ciclo", studying: "Estudiando lecciones y resolviendo ejercicios…", completed: "Ciclo completado",
  partial: "Ciclo parcial · quedan lecciones por repasar", deferred: "Estudio diferido · conversación y voz tienen prioridad", error: "No se pudo completar el ciclo", disabled: "Autoestudio pausado",
};

export function SelfStudyPanel({ snapshot, error, onToggle }: Props) {
  const [pending, setPending] = useState(false);
  const [operationError, setOperationError] = useState("");
  async function toggle(enabled: boolean) {
    setPending(true); setOperationError("");
    try { await onToggle(enabled); } catch (cause) { setOperationError(String(cause)); }
    finally { setPending(false); }
  }
  const records = snapshot?.records ?? [];
  const available = records.filter(record => record.active && record.lastPassed && record.passes > 0);
  const recent = [...records].sort((a, b) => Date.parse(b.studiedAt) - Date.parse(a.studiedAt)).slice(0, 8);
  return <section className="automatic-memory-panel" aria-labelledby="self-study-title">
    <header><div><span className="eyebrow">AUTOESTUDIO CON FUENTES</span><h3 id="self-study-title">Lo que Alice está estudiando</h3><p>Matemáticas, historia bíblica de tradición católica, psicología e inteligencia emocional, empatía, solidaridad y humildad. Cada lección conserva su fuente y una comprobación mediante ejercicios.</p></div><label><input type="checkbox" checked={snapshot?.enabled ?? false} disabled={!snapshot || pending} onChange={event => void toggle(event.target.checked)} />Autoestudio al iniciar</label></header>
    <div className="automatic-memory-summary"><strong>{available.length} lecciones disponibles · {records.length} estudiadas</strong><span role="status">{snapshot ? phaseLabels[snapshot.phase] : "Cargando estado del autoestudio…"}</span></div>
    <p>Se recuperan en conversación las lecciones activas cuyo último ejercicio fue aprobado. El resultado comprueba ese ejercicio; no equivale a dominio general ni a una declaración tuya.</p>
    {(operationError || error || snapshot?.lastError) && <p role="alert">{operationError || error || snapshot?.lastError}</p>}
    <details><summary>Materias permitidas</summary><p>{Object.values(selfStudyTrackLabels).join(" · ")}</p></details>
    <div className="automatic-memory-list">{recent.length ? recent.map(record => <article key={record.id} className={record.active && record.lastPassed && record.passes > 0 ? "" : "is-withdrawn"}>
      <header><span>{selfStudyTrackLabels[record.track]}</span><small>{record.active && record.lastPassed && record.passes > 0 ? "Disponible para conversación" : "Fuera del contexto · requiere repaso"}</small></header>
      <h4>{record.title}</h4><p>{record.content}</p>
      <details><summary>Fuente y comprobación</summary><a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">{record.sourceTitle}</a><p>{record.passes} ejercicios aprobados de {record.attempts} intentos · último resultado: {record.lastPassed ? "aprobado" : "no aprobado"}</p><small>{new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.studiedAt))}</small><code>{record.lessonSha256}</code></details>
    </article>) : <p className="automatic-memory-empty">Todavía no hay lecciones estudiadas. El ciclo de inicio utilizará únicamente el currículo de las materias permitidas.</p>}</div>
  </section>;
}
