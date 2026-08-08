import { useMemo, useState } from "react";
import { buildReviewQueue } from "../core/memory-consolidation";
import type { ReviewOutcome } from "../core/memory-consolidation";
import { teachingTemplates } from "../core/teaching-templates";

type MemoryType = "semantic" | "procedural" | "preference" | "episodic";

type MemorySession = {
  id: string;
  kind: "Facultad" | "Proyecto" | "Investigación" | "Juego" | "Conversación" | "Enseñanza";
  intention: string;
  finishedAt?: string;
  summary?: string;
  nextStep?: string;
  memoryType?: MemoryType;
  source?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
};

type MemoriaProps = {
  sessions: MemorySession[];
  onCreate: (teaching: { intention: string; summary: string; memoryType: MemoryType; source: string; importance: number }) => void;
  onUpdate: (id: string, changes: { summary: string; nextStep: string; source?: string; importance?: number }) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, outcome: ReviewOutcome) => void;
  onExport: () => Promise<string>;
  onRestore: () => Promise<number>;
  onOpenDirectory: () => Promise<string>;
  storageStatus: "browser" | "loading" | "native" | "error";
  storagePath: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const memoryTypeLabels: Record<MemoryType, string> = {
  semantic: "Concepto",
  procedural: "Procedimiento",
  preference: "Preferencia",
  episodic: "Experiencia",
};

export function Memoria({ sessions, onCreate, onUpdate, onDelete, onReview, onExport, onRestore, onOpenDirectory, storageStatus, storagePath }: MemoriaProps) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editImportance, setEditImportance] = useState(3);
  const [teachingTitle, setTeachingTitle] = useState("");
  const [teachingContent, setTeachingContent] = useState("");
  const [teachingType, setTeachingType] = useState<MemoryType>(teachingTemplates[0].memoryType);
  const [teachingSource, setTeachingSource] = useState("Enrique · enseñanza directa");
  const [teachingImportance, setTeachingImportance] = useState(teachingTemplates[0].importance);
  const [teachingMessage, setTeachingMessage] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState(teachingTemplates[0].id);
  const [operationMessage, setOperationMessage] = useState("");
  const [operationRunning, setOperationRunning] = useState(false);
  const remembered = sessions.filter((session) => session.finishedAt);
  const reviewQueue = useMemo(() => buildReviewQueue(remembered.filter((session) => session.kind === "Enseñanza")), [remembered]);
  const pendingReviews = reviewQueue.filter((review) => review.due);
  const nextReview = reviewQueue.find((review) => !review.due);
  const activeTemplate = teachingTemplates.find((template) => template.id === activeTemplateId) ?? teachingTemplates[0];
  const filtered = useMemo(() => remembered.filter((session) => {
    const text = `${session.intention} ${session.summary ?? ""} ${session.nextStep ?? ""} ${session.source ?? ""} ${session.memoryType ?? ""}`.toLocaleLowerCase();
    return text.includes(query.toLocaleLowerCase().trim());
  }), [query, remembered]);

  function edit(session: MemorySession) { setEditingId(session.id); setSummary(session.summary ?? ""); setNextStep(session.nextStep ?? ""); setEditSource(session.source ?? ""); setEditImportance(session.importance ?? 3); }
  function save() { if (editingId) { onUpdate(editingId, { summary: summary.trim(), nextStep: nextStep.trim(), source: editSource.trim() || undefined, importance: editImportance }); setEditingId(null); } }
  function remove(session: MemorySession) { if (window.confirm(`¿Eliminar el recuerdo de “${session.intention}”? Esta acción borra solo este registro local.`)) onDelete(session.id); }
  function review(session: MemorySession, outcome: ReviewOutcome) {
    onReview(session.id, outcome);
    if (outcome === "confirmed") {
      setOperationMessage(`Repaso confirmado: “${session.intention}” sigue vigente.`);
      return;
    }
    setOperationMessage(`“${session.intention}” quedó marcado para corrección. Guardá los cambios para resolver el conflicto.`);
    edit(session);
  }

  function saveTeaching() {
    if (!teachingTitle.trim() || !teachingContent.trim() || !teachingSource.trim()) {
      setTeachingMessage("Completá el tema, lo que Alice debe aprender y la fuente.");
      return;
    }
    onCreate({ intention: teachingTitle.trim(), summary: teachingContent.trim(), memoryType: teachingType, source: teachingSource.trim(), importance: teachingImportance });
    setTeachingMessage(`Enseñanza guardada localmente: ${teachingTitle.trim()}`);
    setTeachingTitle("");
    setTeachingContent("");
    setTeachingType(activeTemplate.memoryType);
    setTeachingImportance(activeTemplate.importance);
  }

  function chooseTeachingTemplate(template: (typeof teachingTemplates)[number]) {
    setActiveTemplateId(template.id);
    setTeachingType(template.memoryType);
    setTeachingImportance(template.importance);
    setTeachingMessage("");
  }

  async function exportRecords() {
    setOperationRunning(true);
    try {
      const path = await onExport();
      setOperationMessage(`Exportación creada en: ${path}`);
    } catch (error) {
      setOperationMessage(`No se pudo exportar: ${String(error)}`);
    } finally {
      setOperationRunning(false);
    }
  }

  async function restoreBackup() {
    const confirmed = window.confirm("¿Restaurar el respaldo anterior? Alice guardará primero la memoria actual en backups/records.pre-restore.json.");
    if (!confirmed) return;
    setOperationRunning(true);
    try {
      const count = await onRestore();
      setOperationMessage(`Respaldo restaurado correctamente: ${count} recuerdos cargados.`);
    } catch (error) {
      setOperationMessage(`No se pudo restaurar: ${String(error)}`);
    } finally {
      setOperationRunning(false);
    }
  }

  async function openDirectory() {
    setOperationRunning(true);
    try {
      const path = await onOpenDirectory();
      setOperationMessage(`Carpeta de memoria abierta: ${path}`);
    } catch (error) {
      setOperationMessage(`No se pudo abrir la carpeta: ${String(error)}`);
    } finally {
      setOperationRunning(false);
    }
  }

  return <section className="memory-page" aria-labelledby="memory-title">
    <div className="memory-heading"><div><p className="eyebrow">MEMORIA LOCAL · EDITABLE</p><h2 id="memory-title">Recuerdos de Alice</h2><p>Podés revisar, corregir o borrar cada recuerdo. Alice no conserva memoria oculta.</p></div><div className="memory-side"><div className={`memory-storage storage-${storageStatus}`} title={storagePath || "Almacenamiento aún no disponible"}><i />{storageStatus === "native" ? "ARCHIVO LOCAL" : storageStatus === "loading" ? "CARGANDO" : storageStatus === "error" ? "ERROR DE MEMORIA" : "NAVEGADOR DEV"}</div><div className="memory-count"><strong>{remembered.length}</strong><span>recuerdos<br />locales</span></div></div></div>
    <section className="teaching-panel" aria-labelledby="teaching-title">
      <header><div><p className="eyebrow">ENSEÑANZA DIRECTA · SOLO LOCAL</p><h3 id="teaching-title">Enseñarle algo a Alice</h3><p>Esta información se guarda en tu computadora. No consulta ni envía nada a OpenRouter.</p></div><span>CONSOLIDACIÓN INICIAL 18%</span></header>
      <div className="teaching-starters"><div><strong>¿POR DÓNDE QUERÉS EMPEZAR?</strong><span>Elegir una guía no guarda información.</span></div><div className="teaching-starter-buttons" role="group" aria-label="Puntos de partida para una enseñanza">{teachingTemplates.map((template) => <button type="button" key={template.id} className={activeTemplateId === template.id ? "selected" : ""} aria-pressed={activeTemplateId === template.id} title={template.description} onClick={() => chooseTeachingTemplate(template)}><small>{template.code}</small><span>{template.label}</span></button>)}</div><p><strong>{activeTemplate.label}:</strong> {activeTemplate.description}</p></div>
      <div className="teaching-grid">
        <label className="teaching-topic">TEMA O CONCEPTO<input value={teachingTitle} onChange={(event) => { setTeachingTitle(event.target.value); setTeachingMessage(""); }} placeholder={activeTemplate.titlePlaceholder} /></label>
        <label>TIPO DE MEMORIA<select value={teachingType} onChange={(event) => setTeachingType(event.target.value as MemoryType)}><option value="semantic">Concepto o hecho</option><option value="procedural">Procedimiento</option><option value="preference">Preferencia personal</option><option value="episodic">Experiencia o episodio</option></select></label>
        <label className="teaching-content">QUÉ DEBE APRENDER<textarea value={teachingContent} onChange={(event) => { setTeachingContent(event.target.value); setTeachingMessage(""); }} placeholder={activeTemplate.contentPlaceholder} /></label>
        <label>FUENTE<input value={teachingSource} onChange={(event) => { setTeachingSource(event.target.value); setTeachingMessage(""); }} placeholder="Quién lo enseñó o de dónde proviene" /></label>
        <label className="teaching-importance">IMPORTANCIA PARA ENRIQUE <strong>{teachingImportance}/5</strong><input type="range" min="1" max="5" step="1" value={teachingImportance} onChange={(event) => setTeachingImportance(Number(event.target.value))} /></label>
      </div>
      <footer><span>{teachingMessage || "Guardar esta enseñanza será tu confirmación explícita."}</span><button className="primary" onClick={saveTeaching}>Guardar enseñanza local <span>→</span></button></footer>
    </section>
    <section className="memory-review-panel" aria-labelledby="memory-review-title">
      <header><div><p className="eyebrow">CONSOLIDACIÓN · REPASO LOCAL</p><h3 id="memory-review-title">Cola de vigencia</h3><p>Alice programa revisiones desde tus registros. Confirmar fortalece el indicador local; no entrena al modelo de nube.</p></div><div className={pendingReviews.length ? "review-counter pending" : "review-counter"}><strong>{pendingReviews.length}</strong><span>{pendingReviews.length === 1 ? "pendiente" : "pendientes"}</span></div></header>
      {pendingReviews.length ? <div className="memory-review-list">{pendingReviews.slice(0, 3).map((item) => <article key={item.memory.id}><div><span>{item.memory.memoryStatus === "conflict" ? "CORRECCIÓN NECESARIA" : "REPASO VENCIDO"}</span><h4>{item.memory.intention}</h4><small>Consolidación {Math.round((item.memory.storageStrength ?? .08) * 100)}% · importancia {item.memory.importance ?? 3}/5</small></div><div className="memory-review-actions"><button className="secondary" onClick={() => review(item.memory, "needs-correction")}>Necesita corrección</button><button className="primary" onClick={() => review(item.memory, "confirmed")}>Sigue vigente</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>✓</span><strong>Sin repasos pendientes</strong></div><p>{nextReview ? `Próximo: “${nextReview.memory.intention}”, ${formatDate(nextReview.dueAt)}.` : "Guardá una enseñanza para iniciar su ciclo de repaso."}</p></div>}
      <footer>INTERVALOS EXPLICABLES · 1 · 3 · 7 · 14 · 30 · 60 · 120 DÍAS</footer>
    </section>
    <div className="memory-tools" aria-label="Herramientas de respaldo">
      <div><p className="eyebrow">SEGURIDAD DE DATOS</p><p>La memoria privada vive fuera del repositorio.</p>{storagePath && <code className="memory-path">{storagePath}</code>}</div>
      <div className="memory-tool-actions"><button className="console-button" onClick={openDirectory} disabled={operationRunning}>Abrir carpeta de memoria</button><button className="console-button" onClick={exportRecords} disabled={operationRunning}>Exportar memoria</button><button className="console-button restore" onClick={restoreBackup} disabled={operationRunning}>Restaurar respaldo</button></div>
    </div>
    {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    <div className="memory-toolbar"><label className="memory-search"><span>BUSCAR</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una conversación o recuerdo" /></label></div>
    {filtered.length === 0 ? <div className="memory-empty"><span>◌</span><h3>{remembered.length ? "No encontramos recuerdos con esa búsqueda." : "La memoria está vacía por ahora."}</h3><p>{remembered.length ? "Probá con otras palabras." : "Podés comenzar enseñándole algo con el formulario superior."}</p></div> : <div className="memory-list">{filtered.map((session) => <article className="memory-record" key={session.id}><div className="memory-meta"><div><span className="tag">{session.kind}</span>{session.memoryType && <span className="memory-type">{memoryTypeLabels[session.memoryType]}</span>}</div><small>{session.finishedAt && formatDate(session.finishedAt)}</small></div><div className="memory-body"><h3>{session.intention}</h3>{editingId === session.id ? <div className="memory-editor"><label>Contenido<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Próximo paso<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>{session.kind === "Enseñanza" && <><label>Fuente<input value={editSource} onChange={(event) => setEditSource(event.target.value)} /></label><label>Importancia: {editImportance}/5<input type="range" min="1" max="5" step="1" value={editImportance} onChange={(event) => setEditImportance(Number(event.target.value))} /></label></>}<div className="action-row"><button className="secondary" onClick={() => setEditingId(null)}>Cancelar</button><button className="primary" onClick={save}>Guardar cambios</button></div></div> : <><p>{session.summary || "Sin resumen todavía."}</p>{session.source && <div className="memory-evidence"><span>FUENTE · {session.source}</span><span>IMPORTANCIA · {session.importance ?? 3}/5</span><span>CONSOLIDACIÓN · {Math.round((session.storageStrength ?? .08) * 100)}%</span><span>USOS AUTORIZADOS · {session.successfulRecalls ?? 0}</span><span>REPASOS · {session.successfulReviews ?? 0}</span></div>}{session.nextStep && <p className="next"><strong>Sigue:</strong> {session.nextStep}</p>}<div className="memory-actions"><button onClick={() => edit(session)}>Editar</button><button className="danger" onClick={() => remove(session)}>Eliminar</button></div></>}</div></article>)}</div>}
  </section>;
}
