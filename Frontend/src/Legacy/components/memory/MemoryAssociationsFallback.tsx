import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../../components/documents/DocumentPreview.css";
import { SavedRelationsDioxus } from "./SavedRelationsDioxus";
import { SourceFormDioxus } from "./SourceFormDioxus";
import { buildSourceChoices } from "../../../components/memory/source-form-bridge";
import { RelationConfirmationDioxus } from "./RelationConfirmationDioxus";

type Evidence = { recordId: string; recordVersion: number; recordSha256: string; quote: string };
type Node = { evidenceUse: string; recordVersion: number; lifecycle: { recordId: string; recordSha256: string } };
type Record = { id: string; intention: string };
type Relation = { id: string; revision: number; withdrawn: boolean; sourcesCurrent: boolean; evidence: { recordId: string }[] };
type Status = { revision: number; associations: Relation[] };

// Recovery controller only. The normal session and UI are owned by Rust/Dioxus.
export function MemoryAssociationsFallback({ desktopApp }: { desktopApp: boolean }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState(["", ""]);
  const [quotes, setQuotes] = useState(["", ""]);
  const [review, setReview] = useState<{ evidence: Evidence[]; revision: number; token: string } | null>(null);
  const [decision, setDecision] = useState<(Relation & { token: string }) | null>(null);
  const nextConfirmation = useRef(0);
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
    setReview({ evidence, revision: status.revision, token: `create-${++nextConfirmation.current}` });
  }
  const title = (id: string) => records.find(record => record.id === id)?.intention.slice(0, 90) || id;
  return <section className="perception-vector document-preview memory-associations" aria-labelledby="associations-title">
    <header><h3 id="associations-title">RELACIONES ENTRE RECUERDOS</h3></header>
    <p>Relacioná dos experiencias por decisión tuya. Una relación confirmada expresa tu criterio; no demuestra causalidad ni convierte respuestas del modelo en hechos.</p>
    {!desktopApp ? <p>Disponible en la aplicación de escritorio.</p> : <>
      <button type="button" disabled={busy} onClick={() => void run(refresh)}>Actualizar relaciones</button>
      {status && <div>
        <p>{status.associations.filter(r => !r.withdrawn && r.sourcesCurrent).length} vigentes · revisión {status.revision} · estado comprobado al actualizar</p>
        <SourceFormDioxus busy={busy}
          sources={buildSourceChoices(nodes.map(node => node.lifecycle.recordId), records, selected)}
          selected={[selected[0], selected[1]]} quotes={[quotes[0], quotes[1]]} onAction={action => {
          if (action.type === "selectSource") {
            setSelected(old => old.map((value, index) => index === action.index ? action.id : value));
            setQuotes(old => old.map((value, index) => index === action.index ? "" : value));
            setReview(null);
          } else if (action.type === "editQuote") {
            setQuotes(old => old.map((value, index) => index === action.index ? action.quote : value));
            setReview(null);
          } else void run(preview);
        }} />
        {review && <RelationConfirmationDioxus pending={{
          kind: "create", token: review.token, busy, quotes: review.evidence.map(item => item.quote), withdrawn: false,
        }} onConfirm={() => void run(async () => {
            await invoke("confirm_knowledge_graph_association", { evidence: review.evidence, expectedRevision: review.revision, confirmed: true });
            await refresh(); setMessage("Relación guardada por tu confirmación.");
        })} />}
        <SavedRelationsDioxus busy={busy} relations={status.associations.map(relation => ({
          id: relation.id, title: relation.evidence.map(e => title(e.recordId)).join(" ↔ "),
          withdrawn: relation.withdrawn, sourcesCurrent: relation.sourcesCurrent,
        }))} onReview={id => {
          const relation = status.associations.find(relation => relation.id === id);
          if (!busy && relation && !(relation.withdrawn && !relation.sourcesCurrent)) {
            setDecision({ ...relation, token: `change-${++nextConfirmation.current}` });
          }
        }} />
        {decision && <RelationConfirmationDioxus pending={{
          kind: "change", token: decision.token, busy, quotes: [], withdrawn: decision.withdrawn,
        }} onConfirm={() => void run(async () => {
            await invoke("set_knowledge_graph_association_withdrawn", { id: decision.id, withdrawn: !decision.withdrawn, expectedRevision: status.revision, confirmed: true });
            await refresh(); setMessage("Cambio guardado en el historial de relaciones.");
        })} onCancel={() => setDecision(null)} />}
      </div>}
    </>}
    {busy && <p role="status">Comprobando fuentes…</p>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
