import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  parseLearningCandidatePreview,
  type LearningCandidate,
  type LearningCandidatePreview,
  type LearningMemoryType,
} from "../core/learning-candidates";

type CandidateSource = {
  id: string;
  intention: string;
  summary?: string;
  finishedAt?: string;
  memoryStatus?: "confirmed" | "conflict" | "archived";
};

type CandidateDraft = Pick<LearningCandidate, "intention" | "summary" | "memoryType"> & { importance: number };

type MemoryCandidatePanelProps = {
  sessions: CandidateSource[];
  ollamaReady: boolean;
  ollamaModel: string;
  onConfirm: (teaching: { intention: string; summary: string; memoryType: LearningMemoryType; source: string; importance: number }) => void;
};

const kindLabels: Record<LearningCandidate["candidateKind"], string> = {
  fact: "HECHO",
  preference: "PREFERENCIA",
  habit: "HÁBITO DECLARADO",
  experience: "EXPERIENCIA",
};

export function MemoryCandidatePanel({ sessions, ollamaReady, ollamaModel, onConfirm }: MemoryCandidatePanelProps) {
  const sources = useMemo(() => sessions.filter((session) => session.finishedAt && session.memoryStatus !== "archived" && `${session.intention} ${session.summary ?? ""}`.trim().length >= 12), [sessions]);
  const [sourceId, setSourceId] = useState("");
  const [preview, setPreview] = useState<LearningCandidatePreview | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sources.some((source) => source.id === sourceId)) setSourceId(sources[0]?.id ?? "");
  }, [sourceId, sources]);

  async function analyze() {
    if (!sourceId || !isTauri()) return;
    setPending(true);
    setMessage("");
    setPreview(null);
    setConfirmed(new Set());
    try {
      const result = parseLearningCandidatePreview(await invoke<unknown>("preview_learning_candidates", { input: { sourceRecordId: sourceId, model: ollamaModel } }));
      setPreview(result);
      setDrafts(Object.fromEntries(result.candidates.map((candidate) => [candidate.candidateId, {
        intention: candidate.intention,
        summary: candidate.summary,
        memoryType: candidate.memoryType,
        importance: Math.max(1, Math.min(5, Math.round(candidate.confidence * 4) + 1)),
      }])));
      setMessage(result.candidates.length ? "Vista previa lista. Nada fue guardado." : "Ollama no encontró conocimiento explícito que proponer en este recuerdo.");
    } catch (error) {
      setMessage(`No se pudo crear la vista previa: ${String(error)}`);
    } finally {
      setPending(false);
    }
  }

  function updateDraft(candidateId: string, changes: Partial<CandidateDraft>) {
    setDrafts((current) => ({ ...current, [candidateId]: { ...current[candidateId], ...changes } }));
  }

  function confirmCandidate(candidate: LearningCandidate) {
    const draft = drafts[candidate.candidateId];
    if (!draft?.intention.trim() || !draft.summary.trim() || confirmed.has(candidate.candidateId) || !preview) return;
    if (!window.confirm(`¿Confirmás que Alice guarde este aprendizaje?\n\n${draft.intention}\n\nLa evidencia y la huella del recuerdo de origen quedarán indicadas en la fuente.`)) return;
    onConfirm({
      intention: draft.intention.trim(),
      summary: draft.summary.trim(),
      memoryType: draft.memoryType,
      importance: draft.importance,
      source: `Ollama local · ${preview.model} · recuerdo ${preview.sourceRecordId} · ${preview.sourceSha256} · candidato ${candidate.candidateId}`,
    });
    setConfirmed((current) => new Set(current).add(candidate.candidateId));
    setMessage("Aprendizaje confirmado y enviado al almacén local de Memoria.");
  }

  return <section className="learning-candidate-panel" aria-labelledby="learning-candidate-title">
    <header>
      <div><p className="eyebrow">R6.4-B · EXTRACCIÓN LOCAL GOBERNADA</p><h3 id="learning-candidate-title">Candidatos desde recuerdos reales</h3><p>Qwen propone hechos, preferencias, hábitos declarados o experiencias. Podés corregirlos; ninguno se guarda sin tu confirmación.</p></div>
      <span>{ollamaReady ? "OLLAMA LOCAL" : "OLLAMA NO DISPONIBLE"}</span>
    </header>
    <div className="learning-candidate-source">
      <label>RECUERDO DE ORIGEN<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPreview(null); setMessage(""); }}>{sources.map((source) => <option value={source.id} key={source.id}>{source.intention}</option>)}</select></label>
      <button className="primary" type="button" onClick={() => void analyze()} disabled={pending || !ollamaReady || !sourceId || !isTauri()}>{pending ? "Analizando localmente…" : "Buscar candidatos"}</button>
    </div>
    {!sources.length && <div className="learning-candidate-empty">Primero debe existir al menos un recuerdo real con contenido.</div>}
    {preview && <div className="learning-candidate-receipt"><span>SÓLO VISTA PREVIA · 0 ESCRITURAS</span><span>{preview.inputTokens} IN · {preview.outputTokens} OUT</span><code>{preview.sourceSha256}</code></div>}
    {preview?.candidates.map((candidate) => {
      const draft = drafts[candidate.candidateId];
      if (!draft) return null;
      const wasConfirmed = confirmed.has(candidate.candidateId);
      return <article className={`learning-candidate-card${wasConfirmed ? " confirmed" : ""}`} key={candidate.candidateId}>
        <div className="learning-candidate-kind"><strong>{kindLabels[candidate.candidateKind]}</strong><span>CONFIANZA {Math.round(candidate.confidence * 100)}%</span></div>
        <div className="learning-candidate-fields">
          <label>TÍTULO<input value={draft.intention} maxLength={100} onChange={(event) => updateDraft(candidate.candidateId, { intention: event.target.value })} disabled={wasConfirmed} /></label>
          <label>CLASE<select value={draft.memoryType} onChange={(event) => updateDraft(candidate.candidateId, { memoryType: event.target.value as LearningMemoryType })} disabled={wasConfirmed}><option value="semantic">Concepto o hecho</option><option value="procedural">Procedimiento o hábito explícito</option><option value="preference">Preferencia personal</option><option value="episodic">Experiencia o episodio</option></select></label>
          <label className="learning-candidate-summary">CONTENIDO<textarea value={draft.summary} maxLength={420} onChange={(event) => updateDraft(candidate.candidateId, { summary: event.target.value })} disabled={wasConfirmed} /></label>
          <label>IMPORTANCIA <strong>{draft.importance}/5</strong><input type="range" min="1" max="5" value={draft.importance} onChange={(event) => updateDraft(candidate.candidateId, { importance: Number(event.target.value) })} disabled={wasConfirmed} /></label>
        </div>
        <blockquote><span>EVIDENCIA LITERAL</span>{candidate.evidence}</blockquote>
        <footer><code>{candidate.candidateId}</code><button className="primary" type="button" onClick={() => confirmCandidate(candidate)} disabled={wasConfirmed}>{wasConfirmed ? "Confirmado" : "Confirmar aprendizaje"}</button></footer>
      </article>;
    })}
    {message && <p className="memory-operation-message" role="status">{message}</p>}
  </section>;
}
