import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../documents/DocumentPreview.css";

type Evidence = { recordId: string; recordVersion: number; recordSha256: string; quote: string };
type Node = { evidenceUse: string; recordVersion: number; lifecycle: { recordId: string; recordSha256: string } };
type Record = { id: string; intention: string };
type Relation = { id: string; revision: number; withdrawn: boolean; sourcesCurrent: boolean; evidence: { recordId: string }[] };
type Status = { revision: number; associations: Relation[] };

export function MemoryAssociations({ desktopApp }: { desktopApp: boolean }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState(["", ""]);
  const [quotes, setQuotes] = useState(["", ""]);
  const [review, setReview] = useState<{ evidence: Evidence[]; revision: number } | null>(null);
  const [decision, setDecision] = useState<Relation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    const [graph, memory, relations] = await Promise.all([
      invoke<{ nodes: Node[] }>("knowledge_graph_snapshot"),
      invoke<{ sessions: Record[] }>("load_memory"),
      invoke<Status>("knowledge_graph_associations"),
    ]);
    setNodes(graph.nodes.filter(n => n.evidenceUse === "episodeOnly"));
    setRecords(memory.sessions); setStatus(relations); setReview(null); setDecision(null);
  }
  useEffect(() => { if (desktopApp) void run(refresh); }, [desktopApp]);
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); } catch (cause) { setError(String(cause)); setReview(null); setDecision(null); }
    finally { setBusy(false); }
  }
  async function preview() {
    if (!status) return;
    const evidence = selected.map((id, index) => {
      const node = nodes.find(n => n.lifecycle.recordId === id);
      if (!node) throw new Error("Seleccioná dos episodios recuperables.");
      return { recordId: id, recordVersion: node.recordVersion, recordSha256: node.lifecycle.recordSha256, quote: quotes[index] };
    });
    await invoke("preview_knowledge_graph_association", { evidence });
    setReview({ evidence, revision: status.revision });
  }
  const title = (id: string) => records.find(record => record.id === id)?.intention.slice(0, 90) || id;
  return <section className="perception-vector document-preview memory-associations" aria-labelledby="associations-title">
    <header><h3 id="associations-title">RELACIONES ENTRE RECUERDOS</h3></header>
    <p>Relacioná dos experiencias por decisión tuya. Una relación confirmada expresa tu criterio; no demuestra causalidad ni convierte respuestas del modelo en hechos.</p>
    {!desktopApp ? <p>Disponible en la aplicación de escritorio.</p> : <>
      <button type="button" disabled={busy} onClick={() => void run(refresh)}>Actualizar relaciones</button>
      {status && <div>
        <p>{status.associations.filter(r => !r.withdrawn && r.sourcesCurrent).length} vigentes · revisión {status.revision} · estado comprobado al actualizar</p>
        {nodes.length < 2 ? <p>Se necesitan dos episodios recuperables para proponer una relación.</p> : <fieldset disabled={busy} style={{ border: "1px solid #315366", padding: 16 }}>
          <legend>Elegir fuentes y copiar una cita literal de cada entrada</legend>
          {[0, 1].map(index => <div key={index} style={{ marginBottom: 16 }}>
            <label>Experiencia {index + 1}<select aria-label={`Experiencia ${index + 1}`} value={selected[index]}
              onChange={event => { setSelected(old => old.map((value, i) => i === index ? event.target.value : value)); setQuotes(old => old.map((value, i) => i === index ? "" : value)); setReview(null); }}>
              <option value="">Seleccionar episodio</option>
              {nodes.map(node => <option key={node.lifecycle.recordId} value={node.lifecycle.recordId}>{title(node.lifecycle.recordId)}</option>)}
            </select></label>
            {selected[index] && <details><summary>Leer entrada original {index + 1}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{records.find(r => r.id === selected[index])?.intention}</pre></details>}
            <label>Cita {index + 1}<textarea aria-label={`Cita ${index + 1}`} value={quotes[index]} maxLength={2048} rows={2}
              onChange={event => { setQuotes(old => old.map((value, i) => i === index ? event.target.value : value)); setReview(null); }} /></label>
          </div>)}
          <button type="button" disabled={selected.some(id => !id) || selected[0] === selected[1] || quotes.some(q => !q.trim())} onClick={() => void run(preview)}>Revisar relación</button>
        </fieldset>}
        {review && <div role="region" aria-label="Confirmar relación revisada">
          <p>Las dos citas coinciden con las fuentes actuales. Revisá si realmente querés relacionar estas experiencias:</p>
          {review.evidence.map(e => <blockquote key={e.recordId}>{e.quote}</blockquote>)}
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            await invoke("confirm_knowledge_graph_association", { evidence: review.evidence, expectedRevision: review.revision, confirmed: true });
            await refresh(); setMessage("Relación guardada por tu confirmación.");
          })}>Confirmar y guardar relación</button>
        </div>}
        <h4>Relaciones guardadas</h4>
        {!status.associations.length && <p>No hay relaciones guardadas. No se crearon conexiones automáticas.</p>}
        {status.associations.map(relation => <article key={relation.id} style={{ borderTop: "1px solid #315366", padding: "14px 0" }}>
          <p>{relation.evidence.map(e => title(e.recordId)).join(" ↔ ")}</p>
          <p>{relation.withdrawn ? "Retirada" : relation.sourcesCurrent ? "Vigente · confirmada por vos" : "No vigente · fuente cambiada o no recuperable"}</p>
          <button type="button" disabled={busy || (relation.withdrawn && !relation.sourcesCurrent)} onClick={() => setDecision(relation)}>{relation.withdrawn ? "Restaurar relación" : "Retirar relación"}</button>
        </article>)}
        {decision && <div role="region" aria-label="Confirmar cambio de relación">
          <p>¿{decision.withdrawn ? "Restaurar" : "Retirar"} esta relación? No modifica recuerdos y conserva las revisiones anteriores.</p>
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            await invoke("set_knowledge_graph_association_withdrawn", { id: decision.id, withdrawn: !decision.withdrawn, expectedRevision: status.revision, confirmed: true });
            await refresh(); setMessage("Cambio guardado en el historial de relaciones.");
          })}>Confirmar cambio</button>
          <button type="button" disabled={busy} onClick={() => setDecision(null)}>Cancelar</button>
        </div>}
      </div>}
    </>}
    {busy && <p role="status">Comprobando fuentes…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
