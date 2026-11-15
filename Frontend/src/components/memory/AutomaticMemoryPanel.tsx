import { useState } from "react";
import type { AutomaticMemoryReview, AutomaticMemorySnapshot, AutomaticLearningPhase } from "../../core/memory/automatic-memory";
import "../../styles/automatic-memory.css";

type Props = {
  snapshot: AutomaticMemorySnapshot | null;
  phase: AutomaticLearningPhase;
  error?: string;
  onToggle: (enabled: boolean) => Promise<void>;
  onReview: (input: AutomaticMemoryReview) => Promise<void>;
};

export function AutomaticMemoryPanel({ snapshot, phase, error, onToggle, onReview }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [operationError, setOperationError] = useState("");
  async function run(action: () => Promise<void>) {
    setPending(true); setOperationError("");
    try { await action(); setEditing(null); } catch (cause) { setOperationError(String(cause)); }
    finally { setPending(false); }
  }
  return <section className="automatic-memory-panel" aria-labelledby="automatic-memory-title">
    <header><div><span className="eyebrow">APRENDER CONVERSANDO</span><h3 id="automatic-memory-title">Lo que Alice decide conservar</h3><p>Recuerdos seleccionados de tus palabras. Puedes corregirlos o retirarlos del contexto sin borrar su procedencia.</p></div><label><input type="checkbox" checked={snapshot?.enabled ?? false} disabled={!snapshot || pending} onChange={e => void run(() => onToggle(e.target.checked))} />Aprendizaje automático</label></header>
    <div className="automatic-memory-summary"><strong>{snapshot?.activeCount ?? 0} recuerdos activos</strong><span role="status">{phase === "evaluating" ? "Alice está evaluando qué merece conservar…" : snapshot?.enabled ? "Activo · evalúa las nuevas conversaciones con Gemma" : "Pausado"}</span></div>
    {(error || operationError) && <p role="alert">{operationError || error}</p>}
    <div className="automatic-memory-list">{snapshot?.records.length ? [...snapshot.records].reverse().map(record => <article key={record.id} className={record.active ? "" : "is-withdrawn"}>
      <header><span>{record.memoryType === "preference" ? "Preferencia" : record.memoryType === "episodic" ? "Experiencia" : record.memoryType === "procedural" ? "Procedimiento" : "Dato declarado"}</span><small>{record.ownerCorrected ? "Corregido por ti" : "Elegido por Alice · sin revisión manual"}{!record.active && " · retirado del RAG"}</small></header>
      {editing === record.id ? <form onSubmit={e => { e.preventDefault(); void run(() => onReview({id:record.id, action:"correct", content})); }}><label>Corregir este recuerdo<textarea autoFocus value={content} maxLength={1000} onChange={e => setContent(e.target.value)} /></label><div><button type="submit" disabled={pending || !content.trim()}>Guardar corrección</button><button type="button" onClick={() => setEditing(null)} disabled={pending}>Cancelar</button></div></form> : <p>{record.content}</p>}
      <details><summary>Origen del recuerdo</summary><blockquote>{record.evidence}</blockquote><small>Importancia elegida: {record.importance}/5 · {new Intl.DateTimeFormat("es-PY", {dateStyle:"medium",timeStyle:"short"}).format(new Date(record.createdAt))}</small><code>Intercambio {record.sourceExchangeId}</code></details>
      <footer><button type="button" disabled={pending} onClick={() => { setEditing(record.id); setContent(record.content); }}>Corregir</button><button type="button" disabled={pending} onClick={() => void run(() => onReview({id:record.id,action:record.active ? "withdraw" : "restore"}))}>{record.active ? "Retirar del contexto" : "Volver a usar"}</button></footer>
    </article>) : <p className="automatic-memory-empty">Todavía no seleccionó recuerdos. Las próximas conversaciones pueden aportar preferencias, datos o experiencias útiles; no necesita guardar cada mensaje.</p>}</div>
  </section>;
}
