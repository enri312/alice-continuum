import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { buildReviewQueue } from "../core/memory-consolidation";
import type { ReviewOutcome } from "../core/memory-consolidation";
import { parseConsolidationMergePreview, parseConsolidationPreview, parseConsolidationResolutionResult, type ConsolidationCandidate, type ConsolidationMergeDifferenceField, type ConsolidationMergePreview, type ConsolidationPreviewSnapshot, type ConsolidationRecoveryStep } from "../core/memory-consolidation-preview";
import { parseLayeredMemorySnapshot, type LayeredMemorySnapshot } from "../core/layered-memory";
import { workingMemoryRemainingLabel, workingMemoryUsagePercent } from "../core/working-memory";
import type { WorkingMemoryOperationResult, WorkingMemorySnapshot } from "../core/working-memory";
import { teachingTemplates } from "../core/teaching-templates";
import { SensoryLearningPanel } from "../components/SensoryLearningPanel";
import type { OwnerProfileSnapshot } from "../core/owner-profile";

type MemoryType = "semantic" | "procedural" | "preference" | "episodic";
type MemoryView = "records" | "working" | "layers" | "notes" | "profile" | "learn" | "teach" | "review" | "consolidate" | "safety";

type MarkdownNoteCatalog = { vaultPath: string; vaultExists: boolean; noteCount: number; notes: { relativePath: string; byteLength: number; sha256: string }[] };

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
  ownerProfile: OwnerProfileSnapshot | null;
  workingMemory: WorkingMemorySnapshot | null;
  onClearWorkingMemory: (expectedGeneration: number) => Promise<WorkingMemoryOperationResult>;
  onCreate: (teaching: { intention: string; summary: string; memoryType: MemoryType; source: string; importance: number }) => void;
  onUpdate: (id: string, changes: { summary: string; nextStep: string; source?: string; importance?: number }) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, outcome: ReviewOutcome) => void;
  onExport: () => Promise<string>;
  onRestore: () => Promise<number>;
  onOpenDirectory: () => Promise<string>;
  storageStatus: "browser" | "loading" | "native" | "error";
  storagePath: string;
  observationEnabled: boolean;
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

const mergeDifferenceLabels: Record<ConsolidationMergeDifferenceField, string> = {
  kind: "tipo",
  intention: "título original",
  startedAt: "inicio",
  finishedAt: "cierre",
  summary: "contenido original",
  nextStep: "próximo paso original",
  memoryType: "clase de memoria",
  source: "fuente",
  importance: "importancia",
  storageStrength: "fuerza",
  memoryStatus: "estado",
  successfulRecalls: "usos correctos",
  failedRecalls: "usos fallidos",
  lastRecalledAt: "último uso",
  successfulReviews: "revisiones",
  correctionCount: "correcciones",
  lastReviewedAt: "última revisión",
  contextEvents: "eventos de contexto",
};

const recoveryStepLabels: Record<ConsolidationRecoveryStep, string> = {
  verifySource: "VERIFICAR FUENTE",
  createOrVerifyBackup: "RESPALDO EXACTO",
  prepareProjectedSource: "PREPARAR PROYECCIÓN",
  atomicReplace: "REEMPLAZO ATÓMICO",
  verifyProjectedSource: "VERIFICAR RESULTADO",
  writeAudit: "AUDITAR",
  restoreBackupOnFailure: "RESTAURAR SI FALLA",
  verifyRestoredSource: "VERIFICAR RESTAURACIÓN",
};

export function Memoria({ sessions, ownerProfile, workingMemory, onClearWorkingMemory, onCreate, onUpdate, onDelete, onReview, onExport, onRestore, onOpenDirectory, storageStatus, storagePath, observationEnabled }: MemoriaProps) {
  const requestedView = new URLSearchParams(window.location.search).get("memoryView");
  const initialView: MemoryView = requestedView === "working" || requestedView === "layers" || requestedView === "notes" || requestedView === "profile" || requestedView === "learn" || requestedView === "teach" || requestedView === "review" || requestedView === "consolidate" || requestedView === "safety" ? requestedView : "records";
  const [view, setView] = useState<MemoryView>(initialView);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editImportance, setEditImportance] = useState(3);
  const [teachingTitle, setTeachingTitle] = useState("");
  const [teachingContent, setTeachingContent] = useState("");
  const [teachingType, setTeachingType] = useState<MemoryType>(teachingTemplates[0].memoryType);
  const [teachingSource, setTeachingSource] = useState("Carlos Nuñez · enseñanza directa");
  const [teachingImportance, setTeachingImportance] = useState(teachingTemplates[0].importance);
  const [teachingMessage, setTeachingMessage] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState(teachingTemplates[0].id);
  const [operationMessage, setOperationMessage] = useState("");
  const [operationRunning, setOperationRunning] = useState(false);
  const [layeredMemory, setLayeredMemory] = useState<LayeredMemorySnapshot | null>(null);
  const [consolidationPreview, setConsolidationPreview] = useState<ConsolidationPreviewSnapshot | null>(null);
  const [mergeSelections, setMergeSelections] = useState<Record<string, string>>({});
  const [mergePreviews, setMergePreviews] = useState<Record<string, ConsolidationMergePreview>>({});
  const [markdownNotes, setMarkdownNotes] = useState<MarkdownNoteCatalog | null>(null);
  const remembered = sessions.filter((session) => session.finishedAt);
  const reviewQueue = useMemo(() => buildReviewQueue(remembered.filter((session) => session.kind === "Enseñanza")), [remembered]);
  const pendingReviews = reviewQueue.filter((review) => review.due);
  const nextReview = reviewQueue.find((review) => !review.due);
  const activeTemplate = teachingTemplates.find((template) => template.id === activeTemplateId) ?? teachingTemplates[0];
  const filtered = useMemo(() => remembered.filter((session) => {
    const text = `${session.intention} ${session.summary ?? ""} ${session.nextStep ?? ""} ${session.source ?? ""} ${session.memoryType ?? ""}`.toLocaleLowerCase();
    return text.includes(query.toLocaleLowerCase().trim());
  }), [query, remembered]);
  const sessionsById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);

  async function refreshLayeredMemory() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try { setLayeredMemory(parseLayeredMemorySnapshot(await invoke<unknown>("layered_memory_status"))); }
    catch (error) { setOperationMessage(`No se pudo verificar R6.1: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "layers") void refreshLayeredMemory(); }, [view, sessions]);

  async function refreshConsolidationPreview() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try {
      setConsolidationPreview(parseConsolidationPreview(await invoke<unknown>("consolidation_preview")));
      setMergeSelections({});
      setMergePreviews({});
    }
    catch (error) { setOperationMessage(`No se pudo verificar R6.3: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "consolidate") void refreshConsolidationPreview(); }, [view, sessions]);

  async function refreshMarkdownNotes() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try { setMarkdownNotes(await invoke<MarkdownNoteCatalog>("markdown_note_catalog")); }
    catch (error) { setOperationMessage(`No se pudo catalogar la bóveda Markdown: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "notes") void refreshMarkdownNotes(); }, [view]);

  async function keepConsolidationPairSeparate(candidate: ConsolidationCandidate) {
    const sourceSha256 = consolidationPreview?.sourceSha256;
    if (!sourceSha256 || candidate.resolution) return;
    const pair = candidate.recordIds.map((id) => sessionsById.get(id)?.intention ?? id);
    if (!window.confirm(`¿Confirmás que estos dos recuerdos deben permanecer separados?\n\n1. ${pair[0]}\n2. ${pair[1]}\n\nRust volverá a verificar el SHA-256, respaldará records.json y registrará la decisión. No modificará los recuerdos.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseConsolidationResolutionResult(await invoke<unknown>("resolve_consolidation_candidate", { input: { expectedSourceSha256: sourceSha256, candidateId: candidate.candidateId, expectedRecordIds: candidate.recordIds, action: "keepSeparate", confirmed: true } }));
      setConsolidationPreview(result.preview);
      setOperationMessage(`Decisión verificada: ambos recuerdos permanecen separados. Respaldo: ${result.sourceBackupPath}`);
    } catch (error) { setOperationMessage(`No se registró la decisión R6.3: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function previewConsolidationMerge(candidate: ConsolidationCandidate) {
    const sourceSha256 = consolidationPreview?.sourceSha256;
    const survivorRecordId = mergeSelections[candidate.candidateId];
    if (!sourceSha256 || candidate.kind !== "exactDuplicate" || candidate.resolution || !survivorRecordId) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const plan = parseConsolidationMergePreview(await invoke<unknown>("preview_consolidation_merge", { input: { expectedSourceSha256: sourceSha256, candidateId: candidate.candidateId, expectedRecordIds: candidate.recordIds, survivorRecordId } }));
      setMergePreviews((current) => ({ ...current, [candidate.candidateId]: plan }));
      setOperationMessage("Vista R6.3-D verificada. El protocolo de recuperación está cerrado, pero no se ejecutó ni se creó un respaldo.");
    } catch (error) { setOperationMessage(`No se pudo planificar R6.3-D: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function activateLayers() {
    const sourceSha256 = layeredMemory?.preview?.sourceSha256;
    if (!sourceSha256 || !window.confirm("¿Activar esta proyección R6.1? records.json se preservará byte a byte y el índice podrá revertirse.")) return;
    setOperationRunning(true);
    try {
      setLayeredMemory(parseLayeredMemorySnapshot(await invoke<unknown>("activate_layered_memory", { input: { expectedSourceSha256: sourceSha256, confirmed: true } })));
      setOperationMessage("Proyección R6.1 activada y ligada a la huella revisada.");
    } catch (error) { setOperationMessage(`No se pudo activar R6.1: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function rollbackLayers() {
    const revisionId = layeredMemory?.activeRevisionId;
    if (!revisionId || !window.confirm("¿Desactivar la proyección R6.1? No se borrarán records.json, el índice ni sus revisiones.")) return;
    setOperationRunning(true);
    try {
      setLayeredMemory(parseLayeredMemorySnapshot(await invoke<unknown>("rollback_layered_memory", { input: { expectedRevisionId: revisionId, confirmed: true } })));
      setOperationMessage("Proyección R6.1 desactivada; la revisión y la memoria original permanecen intactas.");
    } catch (error) { setOperationMessage(`No se pudo revertir R6.1: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function clearSessionWorkingMemory() {
    if (!workingMemory?.messageCount) return;
    const confirmed = window.confirm(`¿Vaciar los ${workingMemory.messageCount} mensajes de la memoria de trabajo? No se borrarán recuerdos, enseñanzas ni revisiones R6.1.`);
    if (!confirmed) return;
    setOperationRunning(true);
    try {
      const result = await onClearWorkingMemory(workingMemory.generation);
      setOperationMessage(result.warning ?? "Memoria de trabajo vaciada. Los recuerdos duraderos permanecen intactos.");
    } catch (error) {
      setOperationMessage(`No se pudo vaciar la memoria de trabajo: ${String(error)}`);
    } finally {
      setOperationRunning(false);
    }
  }

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
    <div className="memory-heading"><div><p className="eyebrow">MEMORIA Y APRENDIZAJE · LOCAL</p><h2 id="memory-title">Memoria de Alice</h2><p>Recuerdos confirmados, perfil privado del propietario y futuros aprendizajes derivados de sesiones sensoriales autorizadas.</p></div><div className="memory-side"><div className={`memory-storage storage-${storageStatus}`} title={storagePath || "Almacenamiento aún no disponible"}><i />{storageStatus === "native" ? "ARCHIVO LOCAL" : storageStatus === "loading" ? "CARGANDO" : storageStatus === "error" ? "ERROR DE MEMORIA" : "NAVEGADOR DEV"}</div><div className="memory-count"><strong>{remembered.length + (ownerProfile?.records.length ?? 0)}</strong><span>recuerdos<br />consultables</span></div></div></div>
    <nav className="memory-view-tabs" role="tablist" aria-label="Áreas de memoria"><button type="button" role="tab" aria-selected={view === "records"} className={view === "records" ? "selected" : ""} onClick={() => setView("records")}><span>01</span>RECUERDOS <em>{remembered.length}</em></button><button type="button" role="tab" aria-selected={view === "working"} className={view === "working" ? "selected" : ""} onClick={() => setView("working")}><span>02</span>TRABAJO RAM <em>{workingMemory?.messageCount ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "layers"} className={view === "layers" ? "selected" : ""} onClick={() => setView("layers")}><span>03</span>CAPAS R6</button><button type="button" role="tab" aria-selected={view === "notes"} className={view === "notes" ? "selected" : ""} onClick={() => setView("notes")}><span>04</span>NOTAS MD <em>{markdownNotes?.noteCount ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "profile"} className={view === "profile" ? "selected" : ""} onClick={() => setView("profile")}><span>05</span>PERFIL <em>{ownerProfile?.records.length ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "learn"} className={view === "learn" ? "selected" : ""} onClick={() => setView("learn")}><span>06</span>APRENDIZAJE</button><button type="button" role="tab" aria-selected={view === "teach"} className={view === "teach" ? "selected" : ""} onClick={() => setView("teach")}><span>07</span>ENSEÑAR</button><button type="button" role="tab" aria-selected={view === "review"} className={view === "review" ? "selected" : ""} onClick={() => setView("review")}><span>08</span>REPASAR <em>{pendingReviews.length}</em></button><button type="button" role="tab" aria-selected={view === "consolidate"} className={view === "consolidate" ? "selected" : ""} onClick={() => setView("consolidate")}><span>09</span>CONSOLIDAR <em>{consolidationPreview?.pendingCandidateCount ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "safety"} className={view === "safety" ? "selected" : ""} onClick={() => setView("safety")}><span>10</span>RESPALDO</button></nav>
    {view === "working" && <section className={`working-memory-panel memory-view-panel state-${workingMemory?.state ?? "unavailable"}`} aria-labelledby="working-memory-title">
      <header><div><p className="eyebrow">R6.2-B · CONTEXTO EFÍMERO NATIVO</p><h3 id="working-memory-title">Memoria de trabajo de la sesión</h3><p>Contexto conversacional reciente dentro del proceso. No es un recuerdo, aprendizaje ni archivo local.</p></div><span>{workingMemory ? workingMemory.state === "active" ? "ACTIVA" : workingMemory.state === "expired" ? "EXPIRADA" : "VACÍA" : "SIN BACKEND"}</span></header>
      {workingMemory ? <>
        <div className="working-memory-grid"><article><strong>{workingMemory.messageCount}<small> / {workingMemory.maximumMessages}</small></strong><span>MENSAJES</span><small>{workingMemory.exchangeCount} / {workingMemory.maximumMessages / 2} intercambios completos</small></article><article><strong>{workingMemory.characterCount.toLocaleString("es-PY")}<small> / {workingMemory.maximumCharacters.toLocaleString("es-PY")}</small></strong><span>CARACTERES</span><small>Presupuesto usado: {workingMemoryUsagePercent(workingMemory)}%</small></article><article><strong>{workingMemoryRemainingLabel(workingMemory)}</strong><span>VENCIMIENTO</span><small>Actualización nativa cada 5 segundos</small></article><article><strong>{workingMemory.generation}</strong><span>GENERACIÓN</span><small>Evita vaciar estado no revisado</small></article></div>
        <div className="working-memory-budget" aria-label={`Presupuesto de caracteres utilizado: ${workingMemoryUsagePercent(workingMemory)}%`}><span style={{ width: `${workingMemoryUsagePercent(workingMemory)}%` }} /></div>
        {workingMemory.exchanges.length ? <div className="working-memory-exchanges"><header><span>INTERCAMBIOS EN RAM</span><small>METADATOS · SIN REPETIR CONTENIDO</small></header>{workingMemory.exchanges.map((exchange, index) => <article key={exchange.exchangeId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{exchange.provider} · {exchange.model}</strong><small>{formatDate(exchange.createdAt)} · cloudConversation</small></div><em>2 MENSAJES</em></article>)}</div> : <div className="working-memory-empty"><strong>{workingMemory.state === "expired" ? "EL CONTEXTO VENCIÓ" : "SIN CONTEXTO ACTIVO"}</strong><span>{workingMemory.state === "expired" ? "Rust eliminó los mensajes al cumplirse el TTL." : "Aparecerá aquí después de una respuesta real del proveedor."}</span></div>}
        <footer><div><strong>SOLO RAM · NO PERSISTENTE</strong><span>Al cerrar Alice se descarta · R3 conserva únicamente SHA-256</span></div><button className="danger" type="button" onClick={() => void clearSessionWorkingMemory()} disabled={operationRunning || workingMemory.messageCount === 0}>Vaciar memoria de trabajo</button></footer>
      </> : <div className="working-memory-empty"><strong>SNAPSHOT NATIVO NO DISPONIBLE</strong><span>Abre Alice como aplicación de escritorio para consultar el estado real.</span></div>}
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "layers" && <section className={`memory-layer-panel memory-view-panel state-${layeredMemory?.state ?? "loading"}`} aria-labelledby="memory-layer-title">
      <header><div><p className="eyebrow">R6.1 · PROYECCIÓN REVERSIBLE</p><h3 id="memory-layer-title">Memoria por capas</h3><p>Clasifica referencias explícitas sin copiar el contenido ni modificar <code>records.json</code>.</p></div><span>{layeredMemory?.state === "active" ? "ACTIVA" : layeredMemory?.state === "sourceChanged" ? "FUENTE CAMBIÓ" : layeredMemory?.state === "rolledBack" ? "REVERTIDA" : layeredMemory?.state === "blocked" ? "BLOQUEADA" : layeredMemory?.state === "unavailable" ? "SIN FUENTE" : "LISTA PARA REVISAR"}</span></header>
      {layeredMemory?.blockedReason && <p className="memory-layer-blocked" role="alert">{layeredMemory.blockedReason}</p>}
      {layeredMemory?.preview ? <><div className="memory-layer-grid"><article><strong>{layeredMemory.preview.workingCount}</strong><span>TRABAJO EN ÍNDICE</span><small>La RAM real se consulta en Trabajo RAM</small></article><article><strong>{layeredMemory.preview.episodicCount}</strong><span>EPISODIOS</span><small>Conversaciones y experiencias explícitas</small></article><article><strong>{layeredMemory.preview.taughtFactCount}</strong><span>HECHOS ENSEÑADOS</span><small>Sólo enseñanza semántica directa</small></article><article className={layeredMemory.preview.unclassifiedCount ? "pending" : ""}><strong>{layeredMemory.preview.unclassifiedCount}</strong><span>SIN CLASIFICAR</span><small>{layeredMemory.preview.proceduralPendingCount} procedimientos · {layeredMemory.preview.preferencePendingCount} preferencias</small></article></div><div className="memory-layer-evidence"><span>FUENTE · {layeredMemory.preview.recordCount} REGISTROS</span><code>{layeredMemory.preview.sourceSha256}</code><span>{layeredMemory.revisionCount} REVISIONES INMUTABLES</span></div></> : <div className="memory-layer-empty">{operationRunning ? "Verificando la fuente local…" : "No existe una vista previa disponible."}</div>}
      <footer><div><strong>CERO CONTENIDO COPIADO</strong><span>Sin LLM · sin señal sensorial · sin migración automática</span></div><div><button className="secondary" onClick={() => void refreshLayeredMemory()} disabled={operationRunning}>Actualizar vista previa</button>{(layeredMemory?.state === "ready" || layeredMemory?.state === "rolledBack" || layeredMemory?.state === "sourceChanged") && <button className="primary" onClick={() => void activateLayers()} disabled={operationRunning || !layeredMemory.preview}>Revisé la huella · activar</button>}{(layeredMemory?.state === "active" || layeredMemory?.state === "sourceChanged") && <button className="danger" onClick={() => void rollbackLayers()} disabled={operationRunning || !layeredMemory.activeRevisionId}>Desactivar proyección</button>}</div></footer>
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "notes" && <section className="memory-view-panel" aria-labelledby="markdown-notes-title"><header><p className="eyebrow">BÓVEDA OBSIDIAN · CATÁLOGO NATIVO DE SOLO LECTURA</p><h3 id="markdown-notes-title">Notas Markdown disponibles</h3><p>Se muestran rutas, tamaño y huella. Alice no interpreta, copia ni convierte una nota en recuerdo.</p></header>{markdownNotes?.vaultExists ? markdownNotes.notes.length ? <div className="memory-list">{markdownNotes.notes.map((note) => <article className="memory-record" key={note.relativePath}><div className="memory-body"><h3>{note.relativePath}</h3><div className="memory-evidence"><span>{note.byteLength.toLocaleString("es-PY")} BYTES</span><code>{note.sha256}</code></div></div></article>)}</div> : <div className="memory-empty"><h3>Bóveda sin notas</h3><p>Creá una nota en Obsidian y actualizá este catálogo.</p></div> : <div className="memory-empty"><h3>Bóveda no encontrada</h3><p>La carpeta privada de notas todavía no existe.</p></div>}<footer><code>{markdownNotes?.vaultPath ?? "Consultando ruta local…"}</code><button className="secondary" type="button" onClick={() => void refreshMarkdownNotes()} disabled={operationRunning || !isTauri()}>Actualizar catálogo</button></footer></section>}
    {view === "profile" && <section className="memory-view-panel owner-profile-panel" aria-labelledby="owner-profile-title"><header><div><p className="eyebrow">PERFIL DEL PROPIETARIO · PRIVADO · SOLO LECTURA</p><h3 id="owner-profile-title">Lo que Alice conoce de Carlos</h3><p>Hechos confirmados por Carlos y derivados de fuentes preservadas de Gemini y Claude. Las instrucciones internas de esos documentos no se ejecutan.</p></div><span>{ownerProfile?.state === "available" ? "CONFIRMADO" : "NO DISPONIBLE"}</span></header>{ownerProfile?.state === "available" ? <><div className="memory-evidence"><span>{ownerProfile.records.length} RECUERDOS DE PERFIL</span><span>{ownerProfile.sourceFiles.length} FUENTES</span><span>CONFIRMÓ · {ownerProfile.confirmedBy}</span></div><div className="memory-list">{ownerProfile.records.map((record) => <article className="memory-record" key={record.id}><div className="memory-meta"><span className="tag">PERFIL</span><small>{record.id}</small></div><div className="memory-body"><h3>{record.intention}</h3><p>{record.summary}</p><div className="memory-evidence"><span>FUENTE · {record.source}</span><span>ESTADO · CONFIRMADO</span></div></div></article>)}</div><footer><code>{ownerProfile.storagePath}</code><span>Solo se adjunta a una conversación cuando autorizás “Recuerdos relevantes”.</span></footer></> : <div className="memory-empty"><h3>Perfil privado no cargado</h3><p>Abre Alice como aplicación de escritorio para validar el archivo local.</p></div>}</section>}
    {view === "learn" && <div className="memory-view-panel"><SensoryLearningPanel observationEnabled={observationEnabled} /></div>}
    {view === "teach" && <section className="teaching-panel memory-view-panel" aria-labelledby="teaching-title">
      <header><div><p className="eyebrow">ENSEÑANZA DIRECTA · SOLO LOCAL</p><h3 id="teaching-title">Enseñarle algo a Alice</h3><p>Esta información se guarda en tu computadora. No consulta ni envía nada a OpenRouter.</p></div><span>CONSOLIDACIÓN INICIAL 18%</span></header>
      <div className="teaching-starters"><div><strong>¿POR DÓNDE QUERÉS EMPEZAR?</strong><span>Elegir una guía no guarda información.</span></div><div className="teaching-starter-buttons" role="group" aria-label="Puntos de partida para una enseñanza">{teachingTemplates.map((template) => <button type="button" key={template.id} className={activeTemplateId === template.id ? "selected" : ""} aria-pressed={activeTemplateId === template.id} title={template.description} onClick={() => chooseTeachingTemplate(template)}><small>{template.code}</small><span>{template.label}</span></button>)}</div><p><strong>{activeTemplate.label}:</strong> {activeTemplate.description}</p></div>
      <div className="teaching-grid">
        <label className="teaching-topic">TEMA O CONCEPTO<input value={teachingTitle} onChange={(event) => { setTeachingTitle(event.target.value); setTeachingMessage(""); }} placeholder={activeTemplate.titlePlaceholder} /></label>
        <label>TIPO DE MEMORIA<select value={teachingType} onChange={(event) => setTeachingType(event.target.value as MemoryType)}><option value="semantic">Concepto o hecho</option><option value="procedural">Procedimiento</option><option value="preference">Preferencia personal</option><option value="episodic">Experiencia o episodio</option></select></label>
        <label className="teaching-content">QUÉ DEBE APRENDER<textarea value={teachingContent} onChange={(event) => { setTeachingContent(event.target.value); setTeachingMessage(""); }} placeholder={activeTemplate.contentPlaceholder} /></label>
        <label>FUENTE<input value={teachingSource} onChange={(event) => { setTeachingSource(event.target.value); setTeachingMessage(""); }} placeholder="Quién lo enseñó o de dónde proviene" /></label>
        <label className="teaching-importance">IMPORTANCIA PARA CARLOS NUÑEZ <strong>{teachingImportance}/5</strong><input type="range" min="1" max="5" step="1" value={teachingImportance} onChange={(event) => setTeachingImportance(Number(event.target.value))} /></label>
      </div>
      <footer><span>{teachingMessage || "Guardar esta enseñanza será tu confirmación explícita."}</span><button className="primary" onClick={saveTeaching}>Guardar enseñanza local <span>→</span></button></footer>
    </section>}
    {view === "review" && <section className="memory-review-panel memory-view-panel" aria-labelledby="memory-review-title">
      <header><div><p className="eyebrow">CONSOLIDACIÓN · REPASO LOCAL</p><h3 id="memory-review-title">Cola de vigencia</h3><p>Alice programa revisiones desde tus registros. Confirmar fortalece el indicador local; no entrena al modelo de nube.</p></div><div className={pendingReviews.length ? "review-counter pending" : "review-counter"}><strong>{pendingReviews.length}</strong><span>{pendingReviews.length === 1 ? "pendiente" : "pendientes"}</span></div></header>
      {pendingReviews.length ? <div className="memory-review-list">{pendingReviews.slice(0, 3).map((item) => <article key={item.memory.id}><div><span>{item.memory.memoryStatus === "conflict" ? "CORRECCIÓN NECESARIA" : "REPASO VENCIDO"}</span><h4>{item.memory.intention}</h4><small>Consolidación {Math.round((item.memory.storageStrength ?? .08) * 100)}% · importancia {item.memory.importance ?? 3}/5</small></div><div className="memory-review-actions"><button className="secondary" onClick={() => review(item.memory, "needs-correction")}>Necesita corrección</button><button className="primary" onClick={() => review(item.memory, "confirmed")}>Sigue vigente</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>✓</span><strong>Sin repasos pendientes</strong></div><p>{nextReview ? `Próximo: “${nextReview.memory.intention}”, ${formatDate(nextReview.dueAt)}.` : "Guardá una enseñanza para iniciar su ciclo de repaso."}</p></div>}
      <footer>INTERVALOS EXPLICABLES · 1 · 3 · 7 · 14 · 30 · 60 · 120 DÍAS</footer>
    </section>}
    {view === "consolidate" && <section className={`consolidation-preview memory-view-panel state-${consolidationPreview?.state ?? "unavailable"}`} aria-labelledby="consolidation-preview-title">
      <header><div><p className="eyebrow">R6.3-D · RECUPERACIÓN ENSAYADA · SIN EJECUCIÓN</p><h3 id="consolidation-preview-title">Candidatos de consolidación</h3><p>Compara registros terminados. Los duplicados exactos permiten elegir qué registro sobreviviría, calcular el impacto y revisar el protocolo de recuperación; Alice todavía no puede ejecutar una fusión.</p></div><span>{consolidationPreview ? consolidationPreview.state === "ready" ? `${consolidationPreview.pendingCandidateCount} PENDIENTES` : consolidationPreview.state === "blocked" ? "BLOQUEADA" : "SIN FUENTE" : "SIN BACKEND"}</span></header>
      {consolidationPreview?.blockedReason && <p className="consolidation-blocked" role="alert">{consolidationPreview.blockedReason}</p>}
      {consolidationPreview?.state === "ready" && <><div className="consolidation-summary"><article><strong>{consolidationPreview.recordCount}</strong><span>REGISTROS LEÍDOS</span><small>{consolidationPreview.eligibleRecordCount} elegibles · {consolidationPreview.archivedRecordCount} archivados</small></article><article><strong>{consolidationPreview.pendingCandidateCount}</strong><span>DECISIONES PENDIENTES</span><small>{consolidationPreview.candidateCount} pares detectados</small></article><article><strong>{consolidationPreview.exactDuplicateCount}</strong><span>DUPLICADOS EXACTOS</span><small>Mismo contenido normalizado</small></article><article><strong>{consolidationPreview.reviewRequiredCount}</strong><span>REVISIÓN REQUERIDA</span><small>Mismo tema, contenido diferente</small></article><article><strong>{consolidationPreview.keptSeparateCount}</strong><span>MANTENER SEPARADOS</span><small>Decisiones humanas registradas</small></article></div>
        {consolidationPreview.candidates.length ? <div className="consolidation-candidates">{consolidationPreview.candidates.map((candidate) => {
          const pair = candidate.recordIds.map((id) => sessionsById.get(id));
          const selectedSurvivor = mergeSelections[candidate.candidateId];
          const mergePlan = mergePreviews[candidate.candidateId];
          return <article key={candidate.candidateId} className={`${candidate.kind}${candidate.resolution ? " resolved" : ""}`}>
            <header><span>{candidate.resolution === "keepSeparate" ? "MANTENER SEPARADOS" : candidate.kind === "exactDuplicate" ? "DUPLICADO EXACTO" : "POSIBLE SOLAPAMIENTO"}</span><small>{candidate.resolution ? "DECISIÓN HUMANA REGISTRADA" : "REVISIÓN HUMANA OBLIGATORIA"}</small></header>
            <div>{pair.map((memory, index) => {
              const recordId = candidate.recordIds[index];
              return <section key={recordId}>
                <small>REGISTRO {index + 1} · {recordId}</small>
                <strong>{memory?.intention ?? "Registro no cargado en React"}</strong>
                <p>{memory?.summary || "Sin resumen"}</p>
                {candidate.kind === "exactDuplicate" && !candidate.resolution && <label className="merge-survivor-choice">
                  <input type="radio" name={`merge-survivor-${candidate.candidateId}`} checked={selectedSurvivor === recordId} onChange={() => {
                    setMergeSelections((current) => ({ ...current, [candidate.candidateId]: recordId }));
                    setMergePreviews((current) => { const next = { ...current }; delete next[candidate.candidateId]; return next; });
                  }} />
                  <span>CONSERVAR ESTE REGISTRO</span>
                </label>}
              </section>;
            })}</div>
            <footer>
              <div><code>{candidate.decisionId ?? candidate.candidateId}</code><span>{candidate.resolution ? "El registro de decisión conserva ambos recuerdos sin cambiar records.json." : candidate.kind === "exactDuplicate" ? "El contenido normalizado coincide; seleccioná el superviviente para calcular un plan." : "El título normalizado coincide; Alice no declara contradicción automáticamente."}</span></div>
              {!candidate.resolution && <div className="consolidation-candidate-actions">
                {candidate.kind === "exactDuplicate" && <button className="secondary" type="button" disabled={operationRunning || !selectedSurvivor} onClick={() => void previewConsolidationMerge(candidate)}>Previsualizar fusión</button>}
                <button className="secondary" type="button" disabled={operationRunning} onClick={() => void keepConsolidationPairSeparate(candidate)}>Mantener separados</button>
              </div>}
            </footer>
            {mergePlan && <section className="merge-preview-plan" aria-label="Plan de fusión sin ejecución">
              <header><div><strong>PLAN R6.3-D VERIFICADO</strong><span>SOLO LECTURA · NO EJECUTABLE</span></div><code>{mergePlan.projectedSourceSha256}</code></header>
              <dl>
                <div><dt>SUPERVIVIENTE</dt><dd>{mergePlan.survivorRecordId}</dd></div>
                <div><dt>SE RETIRARÍA</dt><dd>{mergePlan.duplicateRecordId}</dd></div>
                <div><dt>REGISTROS</dt><dd>{mergePlan.currentRecordCount} → {mergePlan.projectedRecordCount}</dd></div>
                <div><dt>TAMAÑO PROYECTADO</dt><dd>{mergePlan.projectedSourceByteLength.toLocaleString("es-PY")} bytes</dd></div>
                <div><dt>RESPALDO</dt><dd>{mergePlan.sourceBackupStatus === "verified" ? "YA VERIFICADO" : "AÚN NO CREADO"}</dd></div>
                <div><dt>CAPAS R6.1</dt><dd>{mergePlan.layerImpact === "activeRevisionWillBecomeStale" ? "REVISIÓN ACTIVA QUEDARÍA OBSOLETA" : mergePlan.layerImpact === "inactive" ? "ÍNDICE INACTIVO" : "SIN ÍNDICE"}</dd></div>
              </dl>
              <p><strong>DIFERENCIAS ORIGINALES</strong>{mergePlan.differingFields.length ? mergePlan.differingFields.map((field) => mergeDifferenceLabels[field]).join(" · ") : "Ninguna; ambos registros también coinciden sin normalización."}</p>
              <div className="merge-recovery-chain"><strong>PROTOCOLO R6.3-D · {mergePlan.recoverySteps.length} PASOS</strong><ol>{mergePlan.recoverySteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{recoveryStepLabels[step]}</li>)}</ol></div>
              <footer><strong>FUSIÓN NO DISPONIBLE</strong><span>{mergePlan.activeLayerExecutionBlocked ? "La proyección R6.1 activa debe cerrarse antes de cualquier ensayo." : "El protocolo exige respaldo byte a byte, reemplazo atómico, auditoría y restauración verificada."} Esta vista no modificó archivos.</span></footer>
            </section>}
          </article>;
        })}</div> : <div className="consolidation-empty"><strong>SIN CANDIDATOS</strong><p>Los registros actuales no comparten una intención normalizada. No hay nada que fusionar ni revisar en R6.3.</p></div>}
        <div className="consolidation-source"><span>FUENTE VERIFICADA · SIN ESCRITURA</span><code>{consolidationPreview.sourceSha256}</code></div></>}
      {consolidationPreview?.state === "unavailable" && <div className="consolidation-empty"><strong>SIN ARCHIVO CANÓNICO</strong><p>Rust no encontró <code>records.json</code>. No creó carpetas, archivos ni candidatos.</p></div>}
      {!consolidationPreview && <div className="consolidation-empty"><strong>SNAPSHOT NATIVO NO DISPONIBLE</strong><p>Abre Alice como aplicación de escritorio para analizar el archivo canónico. El navegador no fabrica candidatos.</p></div>}
      <footer><div><strong>CERO CAMBIOS AUTOMÁTICOS</strong><span>Sin LLM · sin fusión · sin archivado · planes manuales ligados al SHA-256</span></div><button className="secondary" type="button" onClick={() => void refreshConsolidationPreview()} disabled={operationRunning || !isTauri()}>Actualizar vista previa</button></footer>
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "safety" && <div className="memory-view-panel memory-safety-view"><div className="memory-tools" aria-label="Herramientas de respaldo">
      <div><p className="eyebrow">SEGURIDAD DE DATOS</p><p>La memoria privada vive fuera del repositorio.</p>{storagePath && <code className="memory-path">{storagePath}</code>}</div>
      <div className="memory-tool-actions"><button className="console-button" onClick={openDirectory} disabled={operationRunning}>Abrir carpeta de memoria</button><button className="console-button" onClick={exportRecords} disabled={operationRunning}>Exportar memoria</button><button className="console-button restore" onClick={restoreBackup} disabled={operationRunning}>Restaurar respaldo</button></div>
    </div>{operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}</div>}
    {view === "records" && <div className="memory-view-panel"><div className="memory-toolbar"><label className="memory-search"><span>BUSCAR</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una conversación o recuerdo" /></label></div>
    {filtered.length === 0 ? <div className="memory-empty"><span>◌</span><h3>{remembered.length ? "No encontramos recuerdos con esa búsqueda." : "La memoria está vacía por ahora."}</h3><p>{remembered.length ? "Probá con otras palabras." : "Podés comenzar desde la pestaña Enseñar."}</p></div> : <div className="memory-list">{filtered.map((session) => <article className="memory-record" key={session.id}><div className="memory-meta"><div><span className="tag">{session.kind}</span>{session.memoryType && <span className="memory-type">{memoryTypeLabels[session.memoryType]}</span>}</div><small>{session.finishedAt && formatDate(session.finishedAt)}</small></div><div className="memory-body"><h3>{session.intention}</h3>{editingId === session.id ? <div className="memory-editor"><label>Contenido<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Próximo paso<input value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>{session.kind === "Enseñanza" && <><label>Fuente<input value={editSource} onChange={(event) => setEditSource(event.target.value)} /></label><label>Importancia: {editImportance}/5<input type="range" min="1" max="5" step="1" value={editImportance} onChange={(event) => setEditImportance(Number(event.target.value))} /></label></>}<div className="action-row"><button className="secondary" onClick={() => setEditingId(null)}>Cancelar</button><button className="primary" onClick={save}>Guardar cambios</button></div></div> : <><p>{session.summary || "Sin resumen todavía."}</p>{session.source && <div className="memory-evidence"><span>FUENTE · {session.source}</span><span>IMPORTANCIA · {session.importance ?? 3}/5</span><span>CONSOLIDACIÓN · {Math.round((session.storageStrength ?? .08) * 100)}%</span><span>USOS AUTORIZADOS · {session.successfulRecalls ?? 0}</span><span>REPASOS · {session.successfulReviews ?? 0}</span></div>}{session.nextStep && <p className="next"><strong>Sigue:</strong> {session.nextStep}</p>}<div className="memory-actions"><button onClick={() => edit(session)}>Editar</button><button className="danger" onClick={() => remove(session)}>Eliminar</button></div></>}</div></article>)}</div>}</div>}
  </section>;
}
