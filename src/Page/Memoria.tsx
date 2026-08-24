import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { buildReviewQueue } from "../core/memory-consolidation";
import type { ReviewOutcome } from "../core/memory-consolidation";
import { parseConsolidationMergePreview, parseConsolidationPreview, parseConsolidationRecoveryStatus, parseConsolidationResolutionResult, parseConsolidationRestorationResult, type ConsolidationCandidate, type ConsolidationMergeDifferenceField, type ConsolidationMergePreview, type ConsolidationPreviewSnapshot, type ConsolidationRecoveryStatusSnapshot, type ConsolidationRecoveryStep } from "../core/memory-consolidation-preview";
import { parseLayeredMemorySnapshot, type LayeredMemorySnapshot } from "../core/layered-memory";
import { parseMemoryAccessibilityAssessmentResult, parseMemoryLifecyclePreview, parseMemorySuppressionAssessmentResult, parseMemoryValidityAssessmentResult, type MemoryAccessibilityAssessmentAction, type MemoryLifecyclePreviewSnapshot, type MemorySuppressionAction, type MemorySuppressionReason, type MemoryValidityAssessmentAction } from "../core/memory-lifecycle";
import { parseMemoryArchivePreview, parseMemoryArchiveResult, type MemoryArchiveAction, type MemoryArchivePreview, type MemoryArchiveReason } from "../core/memory-archive";
import { parseMemoryDeletionPreview, parseMemoryDeletionResult, parseMemoryDeletionSchedulePreview, parseMemoryDeletionScheduleResult, type MemoryDeletionPreview, type MemoryDeletionReason, type MemoryDeletionScheduleAction, type MemoryDeletionSchedulePreview } from "../core/memory-deletion";
import { parseMemoryReconsolidationPreview, parseMemoryReconsolidationResult, type MemoryReconsolidationPreview, type MemoryReconsolidationReason } from "../core/memory-reconsolidation";
import { workingMemoryRemainingLabel, workingMemoryUsagePercent } from "../core/working-memory";
import type { WorkingMemoryOperationResult, WorkingMemorySnapshot } from "../core/working-memory";
import type { OwnerProfileSnapshot } from "../core/owner-profile";

type MemoryType = "semantic" | "procedural" | "preference" | "episodic";
type MemoryView = "records" | "working" | "profile" | "layers" | "review" | "consolidate" | "safety";

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
  accessibilityStatus?: "accessible" | "dormant";
  accessibilityUpdatedAt?: string;
  suppressionStatus?: "suppressed";
  suppressionReason?: MemorySuppressionReason;
  suppressionUpdatedAt?: string;
  archiveStatus?: "archived";
  archiveReason?: "ownerChoice" | "superseded" | "noLongerRelevant";
  archiveUpdatedAt?: string;
  deletionStatus?: "scheduled";
  deletionReason?: MemoryDeletionReason;
  deletionRequestedAt?: string;
  deletionEligibleAt?: string;
  memoryVersion?: number;
  reconsolidatedAt?: string;
  reconsolidationReason?: MemoryReconsolidationReason;
  previousVersionSha256?: string;
  successfulRecalls?: number;
  failedRecalls?: number;
  lastRecalledAt?: string;
  retrievalEvidenceVersion?: 1;
  successfulReviews?: number;
  correctionCount?: number;
  lastReviewedAt?: string;
};

type MemoriaProps = {
  sessions: MemorySession[];
  ownerProfile: OwnerProfileSnapshot | null;
  workingMemory: WorkingMemorySnapshot | null;
  onClearWorkingMemory: (expectedGeneration: number) => Promise<WorkingMemoryOperationResult>;
  onUpdate: (id: string, changes: { intention?: string; summary: string; nextStep: string; source?: string; importance?: number }) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, outcome: ReviewOutcome) => void;
  onExport: () => Promise<string>;
  onRestore: () => Promise<number>;
  onReloadMemory: () => Promise<number>;
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
  suppressionStatus: "estado de supresión",
  suppressionReason: "motivo de supresión",
  suppressionUpdatedAt: "fecha de supresión",
  archiveStatus: "estado de archivo",
  archiveReason: "motivo de archivo",
  archiveUpdatedAt: "fecha de archivo",
  deletionStatus: "retención para eliminación",
  deletionReason: "motivo de eliminación",
  deletionRequestedAt: "solicitud de eliminación",
  deletionEligibleAt: "fin de espera",
  memoryVersion: "versión de memoria",
  reconsolidatedAt: "fecha de reconsolidación",
  reconsolidationReason: "motivo de reconsolidación",
  previousVersionSha256: "huella de versión anterior",
  successfulRecalls: "usos correctos",
  failedRecalls: "usos fallidos",
  lastRecalledAt: "último uso",
  retrievalEvidenceVersion: "versión de evidencia de recuperación",
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

export function Memoria({ sessions, ownerProfile, workingMemory, onClearWorkingMemory, onUpdate, onDelete, onReview, onExport, onRestore, onReloadMemory, onOpenDirectory, storageStatus, storagePath }: MemoriaProps) {
  const requestedView = new URLSearchParams(window.location.search).get("memoryView");
  const initialView: MemoryView = requestedView === "working" || requestedView === "profile" || requestedView === "layers" || requestedView === "review" || requestedView === "consolidate" || requestedView === "safety" ? requestedView : "records";
  const [view, setView] = useState<MemoryView>(initialView);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIntention, setEditIntention] = useState("");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editImportance, setEditImportance] = useState(3);
  const [operationMessage, setOperationMessage] = useState("");
  const [operationRunning, setOperationRunning] = useState(false);
  const [layeredMemory, setLayeredMemory] = useState<LayeredMemorySnapshot | null>(null);
  const [lifecyclePreview, setLifecyclePreview] = useState<MemoryLifecyclePreviewSnapshot | null>(null);
  const [consolidationPreview, setConsolidationPreview] = useState<ConsolidationPreviewSnapshot | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<ConsolidationRecoveryStatusSnapshot | null>(null);
  const [mergeSelections, setMergeSelections] = useState<Record<string, string>>({});
  const [mergePreviews, setMergePreviews] = useState<Record<string, ConsolidationMergePreview>>({});
  const [suppressionReason, setSuppressionReason] = useState<MemorySuppressionReason>("ownerChoice");
  const [archiveReason, setArchiveReason] = useState<MemoryArchiveReason>("ownerChoice");
  const [archiveNote, setArchiveNote] = useState("");
  const [archivePreview, setArchivePreview] = useState<MemoryArchivePreview | null>(null);
  const [deletionReason, setDeletionReason] = useState<MemoryDeletionReason>("ownerRequest");
  const [deletionNote, setDeletionNote] = useState("");
  const [deletionSchedulePreview, setDeletionSchedulePreview] = useState<MemoryDeletionSchedulePreview | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<MemoryDeletionPreview | null>(null);
  const [reconsolidationReason, setReconsolidationReason] = useState<MemoryReconsolidationReason>("clarification");
  const [reconsolidationNote, setReconsolidationNote] = useState("");
  const [reconsolidationPreview, setReconsolidationPreview] = useState<MemoryReconsolidationPreview | null>(null);
  const [validitySources, setValiditySources] = useState<Record<string, string>>({});
  const remembered = sessions.filter((session) => session.finishedAt);
  const reviewQueue = useMemo(() => buildReviewQueue(remembered.filter((session) => session.kind === "Enseñanza" && session.memoryStatus !== undefined && session.archiveStatus !== "archived")), [remembered]);
  const pendingReviews = reviewQueue.filter((review) => review.due);
  const nextReview = reviewQueue.find((review) => !review.due);
  const filtered = useMemo(() => remembered.filter((session) => {
    const text = `${session.intention} ${session.summary ?? ""} ${session.nextStep ?? ""} ${session.source ?? ""} ${session.memoryType ?? ""}`.toLocaleLowerCase();
    return text.includes(query.toLocaleLowerCase().trim());
  }), [query, remembered]);
  const sessionsById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const unassessedValidity = useMemo(() => lifecyclePreview?.preview?.references
    .filter((reference) => reference.validity === "notAssessed")
    .map((reference) => ({ reference, memory: sessionsById.get(reference.recordId) })) ?? [], [lifecyclePreview, sessionsById]);
  const currentAccessibility = useMemo(() => lifecyclePreview?.preview?.references
    .filter((reference) => reference.validity === "current")
    .map((reference) => ({ reference, memory: sessionsById.get(reference.recordId) })) ?? [], [lifecyclePreview, sessionsById]);
  const weakeningEvidence = useMemo(() => lifecyclePreview?.preview?.weakeningAssessments
    .filter((assessment) => assessment.state !== "notAssessed")
    .map((assessment) => ({ assessment, memory: sessionsById.get(assessment.recordId) })) ?? [], [lifecyclePreview, sessionsById]);
  const suppressionCandidates = useMemo(() => lifecyclePreview?.preview?.references
    .filter((reference) => reference.validity === "current" || reference.suppressed)
    .map((reference) => ({ reference, memory: sessionsById.get(reference.recordId) })) ?? [], [lifecyclePreview, sessionsById]);
  const archiveCandidates = useMemo(() => lifecyclePreview?.preview?.references
    .filter((reference) => reference.validity === "current" || reference.validity === "conflict")
    .map((reference) => ({ reference, memory: sessionsById.get(reference.recordId) })) ?? [], [lifecyclePreview, sessionsById]);
  const deletionCandidates = useMemo(() => lifecyclePreview?.preview?.references
    .filter((reference) => reference.archived && reference.validity !== "archived")
    .map((reference) => ({ reference, memory: sessionsById.get(reference.recordId) })) ?? [], [lifecyclePreview, sessionsById]);

  async function refreshLayeredMemory() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try { setLayeredMemory(parseLayeredMemorySnapshot(await invoke<unknown>("layered_memory_status"))); }
    catch (error) { setOperationMessage(`No se pudo verificar R6.1: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "layers") void refreshLayeredMemory(); }, [view, sessions]);

  async function refreshLifecyclePreview() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try { setLifecyclePreview(parseMemoryLifecyclePreview(await invoke<unknown>("memory_lifecycle_preview"))); }
    catch (error) { setOperationMessage(`No se pudo verificar el ciclo de memoria: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "review") void refreshLifecyclePreview(); }, [view, sessions]);

  async function activateLifecycle() {
    const sourceSha256 = lifecyclePreview?.preview?.sourceSha256;
    if (!sourceSha256 || !lifecyclePreview.lifecycleWritesAvailable || !window.confirm("¿Activar esta revisión del ciclo de memoria? Rust volverá a verificar records.json, respaldará el índice lateral y conservará los recuerdos byte a byte.")) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      setLifecyclePreview(parseMemoryLifecyclePreview(await invoke<unknown>("activate_memory_lifecycle", { input: { expectedSourceSha256: sourceSha256, confirmed: true } })));
      setOperationMessage("Índice del ciclo activado, verificado y auditado. records.json permaneció intacto.");
    } catch (error) { setOperationMessage(`No se activó el ciclo de memoria: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function rollbackLifecycle() {
    const revisionId = lifecyclePreview?.activeRevisionId;
    if (!revisionId || !window.confirm("¿Desactivar la revisión activa del ciclo? La revisión y sus respaldos se conservarán; records.json no se modificará.")) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      setLifecyclePreview(parseMemoryLifecyclePreview(await invoke<unknown>("rollback_memory_lifecycle", { input: { expectedRevisionId: revisionId, confirmed: true } })));
      setOperationMessage("Revisión del ciclo desactivada de forma reversible. El historial y records.json permanecen intactos.");
    } catch (error) { setOperationMessage(`No se revirtió el ciclo de memoria: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function assessValidity(recordId: string, recordSha256: string, action: MemoryValidityAssessmentAction) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    const memory = sessionsById.get(recordId);
    if (!sourceSha256 || !memory) return;
    const declaredSource = memory.source?.trim() || validitySources[recordId]?.trim();
    if (!declaredSource) {
      setOperationMessage("Este recuerdo necesita una procedencia explícita antes de decidir su vigencia.");
      return;
    }
    const decision = action === "confirmCurrent" ? "confirmar que sigue vigente" : "marcar que requiere corrección";
    if (!window.confirm(`¿Querés ${decision}?\n\n${memory.intention}\nProcedencia: ${declaredSource}\n\nRust comprobará las huellas, respaldará records.json y auditará la decisión. No cambiará la fuerza del recuerdo.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseMemoryValidityAssessmentResult(await invoke<unknown>("assess_memory_validity", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, action, declaredSource: memory.source ? null : declaredSource, confirmed: true } }));
      setLifecyclePreview(result.lifecycle);
      setValiditySources((current) => { const next = { ...current }; delete next[recordId]; return next; });
      const recordCount = await onReloadMemory();
      setOperationMessage(`${action === "confirmCurrent" ? "Vigencia confirmada" : "Conflicto marcado"}, con respaldo exacto y auditoría. ${recordCount} recuerdos recargados; la revisión del índice puede reactivarse sobre la nueva huella.`);
    } catch (error) { setOperationMessage(`No se modificó la vigencia: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function assessAccessibility(recordId: string, recordSha256: string, action: MemoryAccessibilityAssessmentAction) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    const memory = sessionsById.get(recordId);
    if (!sourceSha256 || !memory) return;
    const decision = action === "makeAccessible" ? "permitir que vuelva a recuperarse" : "ponerlo en reposo y excluirlo de la recuperación espontánea";
    if (!window.confirm(`¿Querés ${decision}?\n\n${memory.intention}\n\nEl recuerdo no se borrará ni cambiará su fuerza o contenido. Rust verificará ambas huellas, creará un respaldo exacto y auditará la decisión.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseMemoryAccessibilityAssessmentResult(await invoke<unknown>("assess_memory_accessibility", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, action, confirmed: true } }));
      setLifecyclePreview(result.lifecycle);
      const recordCount = await onReloadMemory();
      setOperationMessage(`${action === "makeAccessible" ? "Recuerdo nuevamente accesible" : "Recuerdo puesto en reposo"}, con respaldo exacto y auditoría. ${recordCount} recuerdos recargados; Conversación aplicará la nueva política.`);
    } catch (error) { setOperationMessage(`No se modificó la accesibilidad: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function assessSuppression(recordId: string, recordSha256: string, action: MemorySuppressionAction) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    const memory = sessionsById.get(recordId);
    if (!sourceSha256 || !memory) return;
    const decision = action === "suppress" ? "suprimir voluntariamente" : "liberar de la supresión";
    if (!window.confirm(`¿Querés ${decision} este recuerdo?\n\n${memory.intention}\n\nLa decisión bloqueará o restaurará su recuperación, con respaldo exacto y auditoría. No borra ni altera el contenido.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseMemorySuppressionAssessmentResult(await invoke<unknown>("assess_memory_suppression", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, action, reason: suppressionReason, confirmed: true } }));
      setLifecyclePreview(result.lifecycle);
      const recordCount = await onReloadMemory();
      setOperationMessage(`${action === "suppress" ? "Recuerdo suprimido" : "Supresión liberada"}, con respaldo exacto y auditoría. ${recordCount} recuerdos recargados.`);
    } catch (error) { setOperationMessage(`No se modificó la supresión: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function previewArchive(recordId: string, recordSha256: string, action: MemoryArchiveAction) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    const memory = sessionsById.get(recordId);
    if (!sourceSha256 || !memory || !isTauri()) return;
    const reason: MemoryArchiveReason = action === "restore" ? "relevantAgain" : archiveReason;
    setOperationRunning(true);
    setOperationMessage("");
    setArchivePreview(null);
    try {
      const preview = parseMemoryArchivePreview(await invoke<unknown>("preview_memory_archive", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, action, reason, note: archiveNote } }));
      setArchivePreview(preview);
      setOperationMessage(`Vista previa verificada para ${action === "archive" ? "archivar" : "restaurar"} “${memory.intention}”. Todavía no se modificó records.json.`);
    } catch (error) { setOperationMessage(`No se preparó el archivo reversible: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function confirmArchive() {
    if (!archivePreview) return;
    const memory = sessionsById.get(archivePreview.recordId);
    if (!memory) return;
    const actionLabel = archivePreview.action === "archive" ? "archivar" : "restaurar";
    if (!window.confirm(`¿Confirmás ${actionLabel} este recuerdo?\n\n${memory.intention}\n\nRust volverá a comprobar el plan y ambas huellas, creará un respaldo exacto y restaurará records.json si falla la auditoría.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseMemoryArchiveResult(await invoke<unknown>("confirm_memory_archive", { input: { expectedPlanId: archivePreview.planId, plannedAt: archivePreview.plannedAt, expectedSourceSha256: archivePreview.sourceSha256, recordId: archivePreview.recordId, expectedRecordSha256: archivePreview.recordSha256Before, action: archivePreview.action, reason: archivePreview.reason, note: archiveNote, confirmed: true } }));
      setLifecyclePreview(result.lifecycle);
      const recordCount = await onReloadMemory();
      setArchivePreview(null);
      setArchiveNote("");
      setOperationMessage(`${result.newArchived ? "Recuerdo archivado" : "Recuerdo restaurado"}, con vigencia subyacente preservada, respaldo exacto y auditoría. ${recordCount} recuerdos recargados.`);
    } catch (error) { setOperationMessage(`No se confirmó el archivo reversible: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function previewDeletionSchedule(recordId: string, recordSha256: string, action: MemoryDeletionScheduleAction) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    const memory = sessionsById.get(recordId);
    if (!sourceSha256 || !memory || !isTauri()) return;
    const reason = action === "cancel" ? memory.deletionReason : deletionReason;
    if (!reason) return;
    setOperationRunning(true); setOperationMessage(""); setDeletionSchedulePreview(null); setDeletionPreview(null);
    try {
      const preview = parseMemoryDeletionSchedulePreview(await invoke<unknown>("preview_memory_deletion_schedule", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, action, reason, note: deletionNote } }));
      setDeletionSchedulePreview(preview);
      setOperationMessage(`Plan de ${action === "schedule" ? "espera de siete días" : "cancelación"} verificado. records.json todavía está intacto.`);
    } catch (error) { setOperationMessage(`No se preparó la retención: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function confirmDeletionSchedule() {
    if (!deletionSchedulePreview || !window.confirm(`¿Confirmás ${deletionSchedulePreview.action === "schedule" ? "programar la eliminación con siete días de espera" : "cancelar la eliminación"}?\n\nEsta es la segunda autorización. No se eliminará contenido en esta operación.`)) return;
    setOperationRunning(true); setOperationMessage("");
    try {
      const plan = deletionSchedulePreview;
      const result = parseMemoryDeletionScheduleResult(await invoke<unknown>("confirm_memory_deletion_schedule", { input: { expectedPlanId: plan.planId, plannedAt: plan.plannedAt, eligibleAt: plan.eligibleAt, expectedSourceSha256: plan.sourceSha256, recordId: plan.recordId, expectedRecordSha256: plan.recordSha256Before, action: plan.action, reason: plan.reason, note: deletionNote, confirmed: true } }));
      setLifecyclePreview(result.lifecycle); await onReloadMemory(); setDeletionSchedulePreview(null); setDeletionNote("");
      setOperationMessage(result.newScheduled ? `Eliminación programada. No podrá ejecutarse antes de ${formatDate(result.eligibleAt!)}.` : "Programación cancelada; el recuerdo sigue archivado y preservado.");
    } catch (error) { setOperationMessage(`No se confirmó la retención: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function previewFinalDeletion(recordId: string, recordSha256: string) {
    const sourceSha256 = lifecyclePreview?.sourceSha256;
    if (!sourceSha256 || !isTauri()) return;
    setOperationRunning(true); setOperationMessage(""); setDeletionPreview(null); setDeletionSchedulePreview(null);
    try {
      const preview = parseMemoryDeletionPreview(await invoke<unknown>("preview_memory_deletion", { input: { expectedSourceSha256: sourceSha256, recordId, expectedRecordSha256: recordSha256, note: deletionNote } }));
      setDeletionPreview(preview);
      setOperationMessage("Vista final verificada. No se escribió ni eliminó nada todavía.");
    } catch (error) { setOperationMessage(`No se preparó la eliminación final: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function confirmFinalDeletion() {
    if (!deletionPreview || !window.confirm("¿Confirmás retirar definitivamente este recuerdo de records.json?\n\nRust volverá a verificar la espera y las huellas. Se conservará un resguardo privado exacto y una lápida sin contenido. Esto no afirma borrado seguro del disco.")) return;
    setOperationRunning(true); setOperationMessage("");
    try {
      const plan = deletionPreview;
      const result = parseMemoryDeletionResult(await invoke<unknown>("confirm_memory_deletion", { input: { expectedPlanId: plan.planId, plannedAt: plan.plannedAt, expectedSourceSha256: plan.sourceSha256, recordId: plan.recordId, expectedRecordSha256: plan.recordSha256, note: deletionNote, confirmed: true } }));
      setLifecyclePreview(result.lifecycle); await onReloadMemory(); setDeletionPreview(null); setDeletionNote("");
      setOperationMessage(`Recuerdo retirado de records.json tras la espera. Quedan ${result.remainingRecordCount}; resguardo privado y lápida verificados.`);
    } catch (error) { setOperationMessage(`No se ejecutó la eliminación: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function refreshConsolidationPreview() {
    if (!isTauri()) return;
    setOperationRunning(true);
    try {
      const [preview, recovery] = await Promise.all([
        invoke<unknown>("consolidation_preview"),
        invoke<unknown>("consolidation_recovery_status"),
      ]);
      setConsolidationPreview(parseConsolidationPreview(preview));
      setRecoveryStatus(parseConsolidationRecoveryStatus(recovery));
      setMergeSelections({});
      setMergePreviews({});
    }
    catch (error) { setOperationMessage(`No se pudo verificar R6.3: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  useEffect(() => { if (view === "consolidate") void refreshConsolidationPreview(); }, [view, sessions]);

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
      setOperationMessage("Vista R6.3-F verificada. La fusión sigue bloqueada; sólo una restauración de seguridad puede usar un recibo ya existente.");
    } catch (error) { setOperationMessage(`No se pudo planificar R6.3-F: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function restoreInterruptedConsolidation() {
    const receipt = recoveryStatus?.receipt;
    if (!receipt || !recoveryStatus.restorationAvailable || receipt.state === "restored") return;
    const confirmed = window.confirm(`Alice detectó una consolidación interrumpida.\n\nEstado del recibo: ${receipt.state}\nFuente actual: ${recoveryStatus.sourceRelation}\n\n¿Restaurar ahora el respaldo original verificado? No se ejecutará ninguna fusión.`);
    if (!confirmed) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseConsolidationRestorationResult(await invoke<unknown>("restore_consolidation_transaction", { input: { transactionId: receipt.transactionId, expectedSourceSha256: receipt.sourceSha256, expectedProjectedSourceSha256: receipt.projectedSourceSha256, confirmed: true } }));
      setRecoveryStatus(result.status);
      try {
        const recordCount = await onReloadMemory();
        setConsolidationPreview(parseConsolidationPreview(await invoke<unknown>("consolidation_preview")));
        setMergeSelections({});
        setMergePreviews({});
        setOperationMessage(`${result.alreadyRestored ? "La restauración ya estaba cerrada" : "Fuente original restaurada y auditada"}. ${recordCount} recuerdos recargados desde disco.`);
      } catch (reloadError) {
        setOperationMessage(`La fuente original quedó restaurada y auditada, pero la interfaz no pudo recargarla: ${String(reloadError)}`);
      }
    } catch (error) { setOperationMessage(`R6.3-F no restauró la transacción: ${String(error)}`); }
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

  function edit(session: MemorySession) {
    setEditingId(session.id);
    setEditIntention(session.intention);
    setSummary(session.summary ?? "");
    setNextStep(session.nextStep ?? "");
    setEditSource(session.source ?? "");
    setEditImportance(session.importance ?? 3);
    setReconsolidationReason(session.memoryStatus === "conflict" ? "ownerCorrection" : "clarification");
    setReconsolidationNote("");
    setReconsolidationPreview(null);
  }

  async function saveOrPreview() {
    if (!editingId) return;
    const memory = sessionsById.get(editingId);
    if (!memory) return;
    if (memory.memoryStatus !== "confirmed" && memory.memoryStatus !== "conflict") {
      onUpdate(editingId, { intention: editIntention.trim(), summary: summary.trim(), nextStep: nextStep.trim(), source: editSource.trim() || undefined, importance: editImportance });
      setEditingId(null);
      return;
    }
    if (!isTauri()) {
      setOperationMessage("La reconsolidación versionada requiere la aplicación de escritorio.");
      return;
    }
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const lifecycle = parseMemoryLifecyclePreview(await invoke<unknown>("memory_lifecycle_preview"));
      const reference = lifecycle.preview?.references.find((item) => item.recordId === editingId);
      if (!lifecycle.sourceSha256 || !reference) throw new Error("El recuerdo no aparece en la fuente vigente.");
      const preview = parseMemoryReconsolidationPreview(await invoke<unknown>("preview_memory_reconsolidation", { input: {
        expectedSourceSha256: lifecycle.sourceSha256,
        recordId: editingId,
        expectedRecordSha256: reference.recordSha256,
        reason: reconsolidationReason,
        note: reconsolidationNote,
        proposedIntention: editIntention,
        proposedSummary: summary.trim() || null,
        proposedNextStep: nextStep.trim() || null,
        proposedSource: editSource.trim() || null,
      } }));
      setLifecyclePreview(lifecycle);
      setReconsolidationPreview(preview);
      setOperationMessage("Vista previa verificada. Todavía no se modificó records.json ni se escribió una versión.");
    } catch (error) { setOperationMessage(`No se preparó la reconsolidación: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }

  async function confirmReconsolidation() {
    if (!editingId || !reconsolidationPreview) return;
    if (!window.confirm(`¿Crear la versión ${reconsolidationPreview.projectedVersion} de este recuerdo?\n\nLa versión ${reconsolidationPreview.previousVersion} quedará preservada de forma inmutable. Rust volverá a comprobar el plan, respaldará records.json y restaurará todo si falla la auditoría.`)) return;
    setOperationRunning(true);
    setOperationMessage("");
    try {
      const result = parseMemoryReconsolidationResult(await invoke<unknown>("confirm_memory_reconsolidation", { input: {
        expectedPlanId: reconsolidationPreview.planId,
        plannedAt: reconsolidationPreview.plannedAt,
        expectedSourceSha256: reconsolidationPreview.sourceSha256,
        recordId: editingId,
        expectedRecordSha256: reconsolidationPreview.recordSha256Before,
        reason: reconsolidationReason,
        note: reconsolidationNote,
        proposedIntention: editIntention,
        proposedSummary: summary.trim() || null,
        proposedNextStep: nextStep.trim() || null,
        proposedSource: editSource.trim() || null,
        confirmed: true,
      } }));
      setLifecyclePreview(result.lifecycle);
      const recordCount = await onReloadMemory();
      setEditingId(null);
      setReconsolidationPreview(null);
      setOperationMessage(`Reconsolidación confirmada: versión ${result.previousVersion} → ${result.newVersion}. La versión anterior, el respaldo exacto y la auditoría quedaron verificados. ${recordCount} recuerdos recargados.`);
    } catch (error) { setOperationMessage(`No se confirmó la reconsolidación: ${String(error)}`); }
    finally { setOperationRunning(false); }
  }
  function remove(session: MemorySession) {
    if (session.memoryStatus || session.memoryVersion) {
      setOperationMessage("Un recuerdo durable no puede borrarse. Usá Archivo reversible en la pestaña Ciclo para retirarlo del RAG sin perderlo.");
      return;
    }
    if (window.confirm(`¿Eliminar el registro todavía no evaluado de “${session.intention}”? Esta acción conserva el respaldo local anterior.`)) onDelete(session.id);
  }
  function review(session: MemorySession, outcome: ReviewOutcome) {
    onReview(session.id, outcome);
    if (outcome === "confirmed") {
      setOperationMessage(`Repaso confirmado: “${session.intention}” sigue vigente.`);
      return;
    }
    setOperationMessage(`“${session.intention}” quedó marcado para corrección. Guardá los cambios para resolver el conflicto.`);
    edit(session);
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
    <div className="memory-heading"><div><p className="eyebrow">ALMACÉN COGNITIVO · LOCAL</p><h2 id="memory-title">Memoria de Alice</h2><p>Acá se inspecciona lo que Alice ya conserva: recuerdos, contexto de trabajo, perfil confirmado, capas, vigencia, consolidación y recuperación.</p></div><div className="memory-side"><div className={`memory-storage storage-${storageStatus}`} title={storagePath || "Almacenamiento aún no disponible"}><i />{storageStatus === "native" ? "ARCHIVO LOCAL" : storageStatus === "loading" ? "CARGANDO" : storageStatus === "error" ? "ERROR DE MEMORIA" : "NAVEGADOR DEV"}</div><div className="memory-count"><strong>{remembered.length + (ownerProfile?.records.length ?? 0)}</strong><span>recuerdos<br />consultables</span></div></div></div>
    <nav className="memory-view-tabs" role="tablist" aria-label="Funciones de memoria"><button type="button" role="tab" aria-selected={view === "records"} className={view === "records" ? "selected" : ""} onClick={() => setView("records")}><span>01</span>RECUERDOS <em>{remembered.length}</em></button><button type="button" role="tab" aria-selected={view === "working"} className={view === "working" ? "selected" : ""} onClick={() => setView("working")}><span>02</span>TRABAJO RAM <em>{workingMemory?.messageCount ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "profile"} className={view === "profile" ? "selected" : ""} onClick={() => setView("profile")}><span>03</span>PERFIL <em>{ownerProfile?.records.length ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "layers"} className={view === "layers" ? "selected" : ""} onClick={() => setView("layers")}><span>04</span>CAPAS R6</button><button type="button" role="tab" aria-selected={view === "review"} className={view === "review" ? "selected" : ""} onClick={() => setView("review")}><span>05</span>CICLO <em>{pendingReviews.length}</em></button><button type="button" role="tab" aria-selected={view === "consolidate"} className={view === "consolidate" ? "selected" : ""} onClick={() => setView("consolidate")}><span>06</span>CONSOLIDAR <em>{consolidationPreview?.pendingCandidateCount ?? 0}</em></button><button type="button" role="tab" aria-selected={view === "safety"} className={view === "safety" ? "selected" : ""} onClick={() => setView("safety")}><span>07</span>RESPALDO</button></nav>
    {view === "working" && <section className={`working-memory-panel memory-view-panel state-${workingMemory?.state ?? "unavailable"}`} aria-labelledby="working-memory-title">
      <header><div><p className="eyebrow">R6.2-B · CONTEXTO EFÍMERO NATIVO</p><h3 id="working-memory-title">Memoria de trabajo de la sesión</h3><p>Contexto conversacional reciente dentro del proceso. No es un recuerdo, aprendizaje ni archivo local.</p></div><span>{workingMemory ? workingMemory.state === "active" ? "ACTIVA" : workingMemory.state === "expired" ? "EXPIRADA" : "VACÍA" : "SIN BACKEND"}</span></header>
      {workingMemory ? <>
        <div className="working-memory-grid"><article><strong>{workingMemory.messageCount}<small> / {workingMemory.maximumMessages}</small></strong><span>MENSAJES</span><small>{workingMemory.exchangeCount} / {workingMemory.maximumMessages / 2} intercambios completos</small></article><article><strong>{workingMemory.characterCount.toLocaleString("es-PY")}<small> / {workingMemory.maximumCharacters.toLocaleString("es-PY")}</small></strong><span>CARACTERES</span><small>Presupuesto usado: {workingMemoryUsagePercent(workingMemory)}%</small></article><article><strong>{workingMemoryRemainingLabel(workingMemory)}</strong><span>VENCIMIENTO</span><small>Actualización nativa cada 5 segundos</small></article><article><strong>{workingMemory.generation}</strong><span>GENERACIÓN</span><small>Evita vaciar estado no revisado</small></article></div>
        <div className="working-memory-budget" aria-label={`Presupuesto de caracteres utilizado: ${workingMemoryUsagePercent(workingMemory)}%`}><span style={{ width: `${workingMemoryUsagePercent(workingMemory)}%` }} /></div>
        {workingMemory.exchanges.length ? <div className="working-memory-exchanges"><header><span>INTERCAMBIOS EN RAM</span><small>METADATOS · SIN REPETIR CONTENIDO</small></header>{workingMemory.exchanges.map((exchange, index) => <article key={exchange.exchangeId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{exchange.provider} · {exchange.model}</strong><small>{formatDate(exchange.createdAt)} · {exchange.provider === "Ollama local" ? "inferenciaLocal" : "cloudConversation"}</small></div><em>2 MENSAJES</em></article>)}</div> : <div className="working-memory-empty"><strong>{workingMemory.state === "expired" ? "EL CONTEXTO VENCIÓ" : "SIN CONTEXTO ACTIVO"}</strong><span>{workingMemory.state === "expired" ? "Rust eliminó los mensajes al cumplirse el TTL." : "Aparecerá aquí después de una respuesta real del proveedor."}</span></div>}
        <footer><div><strong>SOLO RAM · NO PERSISTENTE</strong><span>Al cerrar Alice se descarta · R3 conserva únicamente SHA-256</span></div><button className="danger" type="button" onClick={() => void clearSessionWorkingMemory()} disabled={operationRunning || workingMemory.messageCount === 0}>Vaciar memoria de trabajo</button></footer>
      </> : <div className="working-memory-empty"><strong>SNAPSHOT NATIVO NO DISPONIBLE</strong><span>Abre Alice como aplicación de escritorio para consultar el estado real.</span></div>}
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "layers" && <section className={`memory-layer-panel memory-view-panel state-${layeredMemory?.state ?? "loading"}`} aria-labelledby="memory-layer-title">
      <header><div><p className="eyebrow">R6.6-A · ÍNDICE V3 REVERSIBLE</p><h3 id="memory-layer-title">Memoria por capas</h3><p>Clasifica referencias explícitas sin copiar contenido ni modificar <code>records.json</code>. Un procedimiento sin enlace R5 conserva su capa, pero no se presenta como habilidad ejecutable.</p></div><span>{layeredMemory?.state === "active" ? "ACTIVA" : layeredMemory?.state === "sourceChanged" ? "FUENTE CAMBIÓ" : layeredMemory?.state === "rolledBack" ? "REVERTIDA" : layeredMemory?.state === "blocked" ? "BLOQUEADA" : layeredMemory?.state === "unavailable" ? "SIN FUENTE" : "LISTA PARA REVISAR"}</span></header>
      {layeredMemory?.blockedReason && <p className="memory-layer-blocked" role="alert">{layeredMemory.blockedReason}</p>}
      {layeredMemory?.preview ? <><div className="memory-layer-grid"><article><strong>{layeredMemory.preview.workingCount}</strong><span>TRABAJO EN ÍNDICE</span><small>La RAM real se consulta en Trabajo RAM</small></article><article><strong>{layeredMemory.preview.episodicCount}</strong><span>EPISODIOS</span><small>Conversaciones y experiencias explícitas</small></article><article><strong>{layeredMemory.preview.taughtFactCount}</strong><span>HECHOS ENSEÑADOS</span><small>Sólo enseñanza semántica directa</small></article><article className={layeredMemory.preview.proceduralPendingCount || layeredMemory.preview.unclassifiedCount ? "pending" : ""}><strong>{layeredMemory.preview.proceduralCount}</strong><span>PROCEDIMIENTOS</span><small>{layeredMemory.preview.proceduralPendingCount} sin enlace R5 · {layeredMemory.preview.unclassifiedCount} sin clasificar</small></article></div><div className="memory-layer-evidence"><span>FUENTE · {layeredMemory.preview.recordCount} REGISTROS</span><code>{layeredMemory.preview.sourceSha256}</code><span>{layeredMemory.revisionCount} REVISIONES INMUTABLES V3</span></div></> : <div className="memory-layer-empty">{operationRunning ? "Verificando la fuente local…" : "No existe una vista previa disponible."}</div>}
      <footer><div><strong>CERO CONTENIDO COPIADO</strong><span>Sin LLM · sin señal sensorial · sin migración automática</span></div><div><button className="secondary" onClick={() => void refreshLayeredMemory()} disabled={operationRunning}>Actualizar vista previa</button>{(layeredMemory?.state === "ready" || layeredMemory?.state === "rolledBack" || layeredMemory?.state === "sourceChanged") && <button className="primary" onClick={() => void activateLayers()} disabled={operationRunning || !layeredMemory.preview}>Revisé la huella · activar</button>}{(layeredMemory?.state === "active" || layeredMemory?.state === "sourceChanged") && <button className="danger" onClick={() => void rollbackLayers()} disabled={operationRunning || !layeredMemory.activeRevisionId}>Desactivar proyección</button>}</div></footer>
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "profile" && <section className="memory-view-panel owner-profile-panel" aria-labelledby="owner-profile-title"><header><div><p className="eyebrow">PERFIL DEL PROPIETARIO · PRIVADO · SOLO LECTURA</p><h3 id="owner-profile-title">Lo que Alice conoce de Carlos</h3><p>Hechos confirmados por Carlos y derivados de fuentes preservadas de Gemini y Claude. Las instrucciones internas de esos documentos no se ejecutan.</p></div><span>{ownerProfile?.state === "available" ? "CONFIRMADO" : "NO DISPONIBLE"}</span></header>{ownerProfile?.state === "available" ? <><div className="memory-evidence"><span>{ownerProfile.records.length} RECUERDOS DE PERFIL</span><span>{ownerProfile.sourceFiles.length} FUENTES</span><span>CONFIRMÓ · {ownerProfile.confirmedBy}</span></div><div className="memory-list">{ownerProfile.records.map((record) => <article className="memory-record" key={record.id}><div className="memory-meta"><span className="tag">PERFIL</span><small>{record.id}</small></div><div className="memory-body"><h3>{record.intention}</h3><p>{record.summary}</p><div className="memory-evidence"><span>FUENTE · {record.source}</span><span>ESTADO · CONFIRMADO</span></div></div></article>)}</div><footer><code>{ownerProfile.storagePath}</code><span>Solo se adjunta a una conversación cuando autorizás “Recuerdos relevantes”.</span></footer></> : <div className="memory-empty"><h3>Perfil privado no cargado</h3><p>Abre Alice como aplicación de escritorio para validar el archivo local.</p></div>}</section>}
    {view === "review" && <section className={`memory-review-panel memory-view-panel state-${lifecyclePreview?.state ?? "unavailable"}`} aria-labelledby="memory-review-title">
      <header><div><p className="eyebrow">R6.5-I · ARCHIVO REVERSIBLE · CICLO GOBERNADO</p><h3 id="memory-review-title">Ciclo, vigencia, accesibilidad y recuperación</h3><p>Vigencia, accesibilidad, debilitamiento, supresión, archivo y reconsolidación son decisiones separadas. Ninguna salida de modelo puede cambiar esos estados.</p></div><div className={lifecyclePreview?.state === "blocked" || lifecyclePreview?.state === "sourceChanged" ? "review-counter pending" : "review-counter"}><strong>{lifecyclePreview?.preview?.recordCount ?? 0}</strong><span>{lifecyclePreview?.state === "active" ? "ACTIVO" : lifecyclePreview?.state === "rolledBack" ? "REVERTIDO" : lifecyclePreview?.state === "sourceChanged" ? "FUENTE CAMBIÓ" : "referencias"}</span></div></header>
      {lifecyclePreview?.blockedReason && <p className="memory-layer-blocked" role="alert">{lifecyclePreview.blockedReason}</p>}
      {lifecyclePreview?.preview ? <><div className="memory-lifecycle-grid"><article><strong>{lifecyclePreview.preview.currentCount}</strong><span>VIGENTES</span><small>Estado confirmado explícito</small></article><article className={lifecyclePreview.preview.notAssessedCount ? "pending" : ""}><strong>{lifecyclePreview.preview.notAssessedCount}</strong><span>VIGENCIA NO EVALUADA</span><small>Registros históricos sin inferencia</small></article><article><strong>{lifecyclePreview.preview.accessibleCount}</strong><span>ACCESIBLES EXPLÍCITOS</span><small>{lifecyclePreview.preview.accessibilityAssessedCount} decisiones de accesibilidad</small></article><article className={lifecyclePreview.preview.dormantCount ? "pending" : ""}><strong>{lifecyclePreview.preview.dormantCount}</strong><span>EN REPOSO</span><small>Persisten, pero RAG no los recupera</small></article><article className={lifecyclePreview.preview.retrievalBlockedCount ? "blocked" : ""}><strong>{lifecyclePreview.preview.retrievalBlockedCount}</strong><span>RECUPERACIÓN BLOQUEADA</span><small>{lifecyclePreview.preview.conflictCount} conflictos · {lifecyclePreview.preview.archivedCount} archivados · {lifecyclePreview.preview.dormantCount} en reposo · {lifecyclePreview.preview.suppressedCount} suprimidos</small></article><article><strong>{lifecyclePreview.preview.retrievalOutcomeCount}</strong><span>RESULTADOS CONFIRMADOS</span><small>Útil o no ayudó · sólo evidencia R6.5-F</small></article><article className={lifecyclePreview.preview.weakeningReviewRequiredCount ? "pending" : ""}><strong>{lifecyclePreview.preview.functionalAssessmentCount}</strong><span>EVALUACIONES SUFICIENTES</span><small>{lifecyclePreview.preview.weakeningReviewRequiredCount} requieren revisión humana</small></article><article className={lifecyclePreview.preview.suppressedCount ? "pending" : ""}><strong>{lifecyclePreview.preview.suppressedCount}</strong><span>SUPRIMIDOS</span><small>Decisiones voluntarias y reversibles R6.5-G</small></article><article><strong>{lifecyclePreview.preview.reconsolidatedCount}</strong><span>RECONSOLIDADOS</span><small>Versión anterior preservada · R6.5-H</small></article></div><div className="memory-layer-evidence"><span>FUENTE · {lifecyclePreview.preview.recordCount} REGISTROS REALES</span><code>{lifecyclePreview.preview.sourceSha256}</code><span>{lifecyclePreview.revisionCount} REVISIONES · POLÍTICA APLICADA POR RAG</span></div></> : <div className="memory-layer-empty">{operationRunning ? "Verificando records.json…" : lifecyclePreview?.state === "unavailable" ? "Abre Alice como aplicación de escritorio para consultar el ciclo nativo." : "No existe una vista previa disponible."}</div>}
      <div className="memory-lifecycle-boundary"><strong>FRONTERA ACTUAL</strong><span>R6.5-J separa archivo reversible y eliminación: retirar un recuerdo exige archivo previo, siete días cancelables, otra vista previa, segunda confirmación, resguardo exacto y auditoría. No existe acción automática.</span><div className="memory-lifecycle-actions"><button className="secondary" type="button" onClick={() => void refreshLifecyclePreview()} disabled={operationRunning}>Actualizar</button>{lifecyclePreview?.lifecycleWritesAvailable && lifecyclePreview.state !== "active" && <button className="primary" type="button" onClick={() => void activateLifecycle()} disabled={operationRunning || !lifecyclePreview.preview}>Revisé la huella · activar</button>}{lifecyclePreview?.activeRevisionId && <button className="danger" type="button" onClick={() => void rollbackLifecycle()} disabled={operationRunning}>Desactivar</button>}</div></div>
      <section className="memory-accessibility-assessment memory-weakening-assessment" aria-label="Debilitamiento funcional evaluado"><header><div><p className="eyebrow">EVIDENCIA FUNCIONAL · MÍNIMO 3 RESULTADOS · SIN ACCIÓN AUTOMÁTICA</p><h4>Utilidad de recuerdos recuperados</h4><p>Después de usar RAG, Conversación pregunta si cada recuerdo ayudó. Dos tercios de resultados “no ayudó”, con al menos tres intentos, sólo generan una señal para revisar.</p></div><div className={lifecyclePreview?.preview?.weakeningReviewRequiredCount ? "review-counter pending" : "review-counter"}><strong>{lifecyclePreview?.preview?.weakeningReviewRequiredCount ?? 0}</strong><span>por revisar</span></div></header>{weakeningEvidence.length ? <div className="memory-accessibility-list">{weakeningEvidence.map(({ assessment, memory }) => <article key={assessment.recordId} className={`state-${assessment.state}`}><div><span>{assessment.state === "reviewRequired" ? "REVISIÓN REQUERIDA" : assessment.state === "noWeakeningSignal" ? "SIN SEÑAL DE DEBILITAMIENTO" : "EVIDENCIA AÚN INSUFICIENTE"}</span><h4>{memory?.intention ?? assessment.recordId}</h4><small>{assessment.helpfulOutcomes} útil · {assessment.notHelpfulOutcomes} no ayudó · {assessment.evidenceCount}/3 mínimo</small></div><div className="memory-review-actions"><small>SIN CAMBIO AUTOMÁTICO</small></div></article>)}</div> : <div className="memory-review-empty"><div><span>○</span><strong>Sin resultados explícitos todavía</strong></div><p>Los contadores anteriores a R6.5-F no se consideran evidencia. La próxima conversación real que use recuerdos permitirá evaluarlos.</p></div>}</section>
      <section className="memory-accessibility-assessment memory-suppression-assessment" aria-label="Supresión voluntaria de recuerdos"><header><div><p className="eyebrow">R6.5-G · DECISIÓN DEL PROPIETARIO · REVERSIBLE · AUDITADA</p><h4>Supresión voluntaria</h4><p>Impide que un recuerdo aparezca espontáneamente sin borrarlo, debilitarlo ni ocultar su existencia. Liberarlo restaura la política que corresponda por vigencia y accesibilidad.</p></div><label className="suppression-reason"><span>MOTIVO CERRADO</span><select value={suppressionReason} onChange={(event) => setSuppressionReason(event.target.value as MemorySuppressionReason)} disabled={operationRunning}><option value="ownerChoice">Elección del propietario</option><option value="sensitiveContext">Contexto sensible</option><option value="temporaryBoundary">Límite temporal</option></select></label></header>{suppressionCandidates.length ? <div className="memory-accessibility-list">{suppressionCandidates.map(({ reference, memory }) => <article key={reference.recordId} className={reference.suppressed ? "state-suppressed" : "state-available"}><div><span>{reference.suppressed ? "SUPRIMIDO · EXCLUIDO DEL RAG" : "NO SUPRIMIDO"}</span><h4>{memory?.intention ?? reference.recordId}</h4><small>{reference.validity.toUpperCase()} · huella {reference.recordSha256.slice(7, 19)}</small></div><div className="memory-review-actions"><button className="secondary" type="button" disabled={operationRunning || !memory || reference.suppressed} onClick={() => void assessSuppression(reference.recordId, reference.recordSha256, "suppress")}>Suprimir</button><button className="primary" type="button" disabled={operationRunning || !memory || !reference.suppressed} onClick={() => void assessSuppression(reference.recordId, reference.recordSha256, "release")}>Liberar</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>○</span><strong>Sin recuerdos gobernables</strong></div><p>Se necesita un recuerdo vigente; uno ya suprimido siempre seguirá disponible para liberación.</p></div>}</section>
      <section className="memory-accessibility-assessment memory-archive-assessment" aria-label="Archivo reversible de recuerdos">
        <header><div><p className="eyebrow">R6.5-I · ARCHIVO INDEPENDIENTE · DOS CONFIRMACIONES · AUDITADO</p><h4>Archivo reversible</h4><p>Retira un recuerdo del RAG sin borrarlo ni cambiar su vigencia, contenido, reposo, supresión o versión. Restaurar recupera exactamente la política que corresponda a esos ejes.</p></div><label className="suppression-reason"><span>MOTIVO DE ARCHIVO</span><select value={archiveReason} onChange={(event) => { setArchiveReason(event.target.value as MemoryArchiveReason); setArchivePreview(null); }} disabled={operationRunning}><option value="ownerChoice">Elección del propietario</option><option value="superseded">Sustituido por otro recuerdo</option><option value="noLongerRelevant">Ya no es relevante</option></select></label></header>
        <label className="archive-note"><span>NOTA OBLIGATORIA · SE CONSERVA SÓLO SU SHA-256</span><textarea value={archiveNote} maxLength={500} onChange={(event) => { setArchiveNote(event.target.value); setArchivePreview(null); }} placeholder="Explicá por qué debe archivarse o por qué vuelve a ser relevante…" disabled={operationRunning} /></label>
        {archiveCandidates.length ? <div className="memory-accessibility-list">{archiveCandidates.map(({ reference, memory }) => <article key={reference.recordId} className={reference.archived ? "state-archived" : "state-available"}><div><span>{reference.archived ? "ARCHIVADO · EXCLUIDO DEL RAG" : "ACTIVO · NO ARCHIVADO"}</span><h4>{memory?.intention ?? reference.recordId}</h4><small>VIGENCIA {reference.validity.toUpperCase()} · {reference.suppressed ? "SUPRIMIDO · " : ""}{reference.accessibility.toUpperCase()} · huella {reference.recordSha256.slice(7, 19)}</small></div><div className="memory-review-actions"><button className="secondary" type="button" disabled={operationRunning || !memory || reference.archived || !archiveNote.trim()} onClick={() => void previewArchive(reference.recordId, reference.recordSha256, "archive")}>Preparar archivo</button><button className="primary" type="button" disabled={operationRunning || !memory || !reference.archived || !archiveNote.trim()} onClick={() => void previewArchive(reference.recordId, reference.recordSha256, "restore")}>Preparar restauración</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>○</span><strong>Sin recuerdos con vigencia restaurable</strong></div><p>Los archivos heredados permanecen bloqueados, pero no se restauran automáticamente porque no conservan su vigencia anterior.</p></div>}
        {archivePreview && <div className="archive-plan"><div><strong>{archivePreview.action === "archive" ? "PLAN DE ARCHIVO VERIFICADO" : "PLAN DE RESTAURACIÓN VERIFICADO"}</strong><span>{archivePreview.recordId} · {archivePreview.reason}</span><code>{archivePreview.planId}</code><small>records.json intacto · acción automática: NO</small></div><button className="danger" type="button" onClick={() => void confirmArchive()} disabled={operationRunning}>Segunda confirmación</button></div>}
      </section>
      <section className="memory-accessibility-assessment memory-deletion-assessment" aria-label="Retención y eliminación gobernada de recuerdos">
        <header><div><p className="eyebrow">R6.5-J · ARCHIVO PREVIO · 7 DÍAS · DOBLE CONFIRMACIÓN · RESGUARDO</p><h4>Retención antes de eliminar</h4><p>Eliminar de la memoria activa es un contrato distinto de archivar. Primero se programa una espera cancelable; al vencer, una nueva vista previa y confirmación pueden retirar el registro. El resguardo privado obligatorio no se presenta como borrado seguro del disco.</p></div><label className="suppression-reason"><span>MOTIVO CERRADO</span><select value={deletionReason} onChange={(event) => { setDeletionReason(event.target.value as MemoryDeletionReason); setDeletionSchedulePreview(null); setDeletionPreview(null); }} disabled={operationRunning}><option value="ownerRequest">Solicitud del propietario</option><option value="duplicateAfterMerge">Duplicado tras consolidación</option><option value="privacyRemoval">Retiro por privacidad</option></select></label></header>
        <label className="archive-note"><span>NOTA OBLIGATORIA · SÓLO SE CONSERVA SU SHA-256</span><textarea value={deletionNote} maxLength={500} onChange={(event) => { setDeletionNote(event.target.value); setDeletionSchedulePreview(null); setDeletionPreview(null); }} placeholder="Explicá por qué se programa, cancela o confirma el retiro…" disabled={operationRunning} /></label>
        {deletionCandidates.length ? <div className="memory-accessibility-list">{deletionCandidates.map(({ reference, memory }) => { const scheduled = reference.retention === "deletionScheduled"; const eligible = Boolean(memory?.deletionEligibleAt && Date.now() >= new Date(memory.deletionEligibleAt).getTime()); return <article key={reference.recordId} className={scheduled ? "state-suppressed" : "state-archived"}><div><span>{scheduled ? eligible ? "ESPERA CUMPLIDA · ELIMINACIÓN DISPONIBLE" : "ELIMINACIÓN PROGRAMADA · CANCELABLE" : "ARCHIVADO · SIN ELIMINACIÓN PROGRAMADA"}</span><h4>{memory?.intention ?? reference.recordId}</h4><small>{scheduled && memory?.deletionEligibleAt ? `ELEGIBLE ${formatDate(memory.deletionEligibleAt)}` : "ESPERA FIJA DE 7 DÍAS"} · huella {reference.recordSha256.slice(7, 19)}</small></div><div className="memory-review-actions"><button className="secondary" type="button" disabled={operationRunning || !memory || scheduled || !deletionNote.trim()} onClick={() => void previewDeletionSchedule(reference.recordId, reference.recordSha256, "schedule")}>Programar espera</button><button className="primary" type="button" disabled={operationRunning || !memory || !scheduled || !deletionNote.trim()} onClick={() => void previewDeletionSchedule(reference.recordId, reference.recordSha256, "cancel")}>Cancelar</button><button className="danger" type="button" disabled={operationRunning || !memory || !scheduled || !eligible || !deletionNote.trim()} onClick={() => void previewFinalDeletion(reference.recordId, reference.recordSha256)}>Preparar retiro final</button></div></article>; })}</div> : <div className="memory-review-empty"><div><span>○</span><strong>Sin recuerdos archivados elegibles</strong></div><p>Archivar es el paso previo obligatorio. Los archivos heredados no entran en este contrato porque perdieron su vigencia anterior.</p></div>}
        {deletionSchedulePreview && <div className="archive-plan"><div><strong>{deletionSchedulePreview.action === "schedule" ? "PLAN DE RETENCIÓN VERIFICADO" : "CANCELACIÓN VERIFICADA"}</strong><span>{deletionSchedulePreview.recordId} · {deletionSchedulePreview.reason}</span><code>{deletionSchedulePreview.planId}</code><small>{deletionSchedulePreview.action === "schedule" ? `elegible ${formatDate(deletionSchedulePreview.eligibleAt)}` : "la espera será retirada"} · acción automática: NO</small></div><button className="danger" type="button" onClick={() => void confirmDeletionSchedule()} disabled={operationRunning}>Segunda confirmación</button></div>}
        {deletionPreview && <div className="archive-plan deletion-final-plan"><div><strong>RETIRO FINAL VERIFICADO</strong><span>{deletionPreview.recordId} · espera cumplida</span><code>{deletionPreview.planId}</code><small>resguardo exacto obligatorio · lápida sin contenido · acción automática: NO</small></div><button className="danger" type="button" onClick={() => void confirmFinalDeletion()} disabled={operationRunning}>Confirmar retiro de records.json</button></div>}
      </section>
      <section className="memory-validity-assessment" aria-label="Recuerdos sin vigencia evaluada">
        <header><div><p className="eyebrow">DECISIÓN HUMANA · PROCEDENCIA · RESPALDO EXACTO · AUDITORÍA</p><h4>Recuerdos aún no evaluados</h4><p>Si falta la procedencia, debe declararse junto con la primera decisión de vigencia. La operación no altera contenido, clase ni fuerza.</p></div><div className={unassessedValidity.length ? "review-counter pending" : "review-counter"}><strong>{unassessedValidity.length}</strong><span>sin evaluar</span></div></header>
        {unassessedValidity.length ? <div className="memory-validity-list">{unassessedValidity.map(({ reference, memory }) => {
          const declaredSource = memory?.source?.trim() || validitySources[reference.recordId]?.trim();
          return <article key={reference.recordId}><div><span>NO EVALUADO · {memory?.memoryType ? memoryTypeLabels[memory.memoryType] : memory?.kind ?? "REGISTRO"}</span><h4>{memory?.intention ?? reference.recordId}</h4><small>{memory?.finishedAt ? formatDate(memory.finishedAt) : "Fecha no disponible"} · huella {reference.recordSha256.slice(7, 19)}</small>{memory && !memory.source && <label className="memory-validity-source"><span>PROCEDENCIA OBLIGATORIA</span><input value={validitySources[reference.recordId] ?? ""} maxLength={300} onChange={(event) => setValiditySources((current) => ({ ...current, [reference.recordId]: event.target.value }))} placeholder="Ej.: conversación directa, importación Gemini o perfil Claude" /></label>}{memory?.source && <em className="memory-validity-source-declared">PROCEDENCIA DECLARADA · {memory.source}</em>}</div><div className="memory-review-actions"><button className="secondary" type="button" disabled={operationRunning || !memory || !declaredSource} onClick={() => void assessValidity(reference.recordId, reference.recordSha256, "markConflict")}>Necesita corrección</button><button className="primary" type="button" disabled={operationRunning || !memory || !declaredSource} onClick={() => void assessValidity(reference.recordId, reference.recordSha256, "confirmCurrent")}>Confirmar vigente</button></div></article>;
        })}</div> : <div className="memory-review-empty"><div><span>✓</span><strong>Todos poseen vigencia explícita</strong></div><p>No se aplicó ninguna inferencia automática.</p></div>}
      </section>
      <section className="memory-accessibility-assessment" aria-label="Accesibilidad de recuerdos vigentes"><header><div><p className="eyebrow">ACCESIBILIDAD · DIFERENTE DE VERDAD, VIGENCIA Y FUERZA</p><h4>Disponibilidad para recuperación</h4><p>Un recuerdo en reposo sigue existiendo y puede volver a habilitarse. Conversación lo excluye del RAG mientras permanezca así.</p></div><div className={lifecyclePreview?.preview?.dormantCount ? "review-counter pending" : "review-counter"}><strong>{lifecyclePreview?.preview?.dormantCount ?? 0}</strong><span>en reposo</span></div></header>{currentAccessibility.length ? <div className="memory-accessibility-list">{currentAccessibility.map(({ reference, memory }) => <article key={reference.recordId} className={`state-${reference.accessibility}`}><div><span>{reference.accessibility === "dormant" ? "EN REPOSO" : reference.accessibility === "accessible" ? "ACCESIBLE EXPLÍCITO" : "ACCESIBILIDAD NO EVALUADA"}</span><h4>{memory?.intention ?? reference.recordId}</h4><small>{reference.retrievalPolicy === "blockedByDormancy" ? "EXCLUIDO DEL RAG" : "ELEGIBLE PARA RAG"} · huella {reference.recordSha256.slice(7, 19)}</small></div><div className="memory-review-actions"><button className="secondary" type="button" disabled={operationRunning || !memory || reference.accessibility === "dormant"} onClick={() => void assessAccessibility(reference.recordId, reference.recordSha256, "setDormant")}>Poner en reposo</button><button className="primary" type="button" disabled={operationRunning || !memory || reference.accessibility === "accessible"} onClick={() => void assessAccessibility(reference.recordId, reference.recordSha256, "makeAccessible")}>Permitir recuperación</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>○</span><strong>Sin recuerdos vigentes</strong></div><p>Primero debe resolverse su vigencia.</p></div>}</section>
      <section className="memory-review-queue" aria-label="Repaso espaciado de enseñanzas evaluadas"><header><div><p className="eyebrow">REPASO ESPACIADO · SÓLO ENSEÑANZAS YA EVALUADAS</p><h4>Cola de estabilidad</h4><p>Esta cola es posterior a la vigencia inicial: ajusta el indicador local de estabilidad, no entrena al modelo ni prueba verdad factual.</p></div><div className={pendingReviews.length ? "review-counter pending" : "review-counter"}><strong>{pendingReviews.length}</strong><span>{pendingReviews.length === 1 ? "pendiente" : "pendientes"}</span></div></header>{pendingReviews.length ? <div className="memory-review-list">{pendingReviews.slice(0, 3).map((item) => <article key={item.memory.id}><div><span>{item.memory.memoryStatus === "conflict" ? "CORRECCIÓN NECESARIA" : "REPASO VENCIDO"}</span><h4>{item.memory.intention}</h4><small>Estabilidad {Math.round((item.memory.storageStrength ?? .08) * 100)}% · importancia {item.memory.importance ?? 3}/5</small></div><div className="memory-review-actions"><button className="secondary" onClick={() => review(item.memory, "needs-correction")}>Necesita corrección</button><button className="primary" onClick={() => review(item.memory, "confirmed")}>Repaso correcto</button></div></article>)}</div> : <div className="memory-review-empty"><div><span>✓</span><strong>Sin repasos pendientes</strong></div><p>{nextReview ? `Próximo repaso: “${nextReview.memory.intention}”, ${formatDate(nextReview.dueAt)}.` : "No hay enseñanzas ya evaluadas con un repaso programado."}</p></div>}</section>
      <footer>INTERVALOS EXPLICABLES · 1 · 3 · 7 · 14 · 30 · 60 · 120 DÍAS</footer>
      {operationMessage && <p className="memory-operation-message" role="status">{operationMessage}</p>}
    </section>}
    {view === "consolidate" && <section className={`consolidation-preview memory-view-panel state-${consolidationPreview?.state ?? "unavailable"}`} aria-labelledby="consolidation-preview-title">
      <header><div><p className="eyebrow">R6.3-F · ESTADO NATIVO · RESTAURACIÓN GOBERNADA</p><h3 id="consolidation-preview-title">Candidatos de consolidación</h3><p>Compara registros terminados y consulta el recibo durable. Si Alice detecta una interrupción puede restaurar la fuente original con confirmación y auditoría; crear o ejecutar una fusión sigue inaccesible.</p></div><span>{recoveryStatus?.state === "recoveryRequired" ? "RECUPERACIÓN REQUERIDA" : recoveryStatus?.state === "blocked" ? "RECUPERACIÓN BLOQUEADA" : consolidationPreview ? consolidationPreview.state === "ready" ? `${consolidationPreview.pendingCandidateCount} PENDIENTES` : consolidationPreview.state === "blocked" ? "BLOQUEADA" : "SIN FUENTE" : "SIN BACKEND"}</span></header>
      {recoveryStatus ? <section className={`consolidation-recovery-status state-${recoveryStatus.state}`} aria-label="Estado nativo de recuperación R6.3-F">
        <div><strong>{recoveryStatus.state === "idle" ? "SIN TRANSACCIONES PENDIENTES" : recoveryStatus.state === "recoveryRequired" ? "RESTAURACIÓN DE SEGURIDAD DISPONIBLE" : recoveryStatus.state === "restored" ? "ÚLTIMA TRANSACCIÓN RESTAURADA" : "RECUPERACIÓN BLOQUEADA"}</strong><span>{recoveryStatus.state === "idle" ? "No existe un recibo que requiera intervención." : recoveryStatus.state === "recoveryRequired" ? `RECIBO ${recoveryStatus.receipt?.state.toUpperCase()} · FUENTE ${recoveryStatus.sourceRelation?.toUpperCase()}` : recoveryStatus.state === "restored" ? "FUENTE ORIGINAL VERIFICADA · AUDITORÍA CERRADA" : recoveryStatus.blockedReason}</span></div>
        {recoveryStatus.receipt && <code>{recoveryStatus.receipt.transactionId}</code>}
        {recoveryStatus.restorationAvailable && <button className="danger" type="button" disabled={operationRunning} onClick={() => void restoreInterruptedConsolidation()}>Confirmar y restaurar original</button>}
        {!recoveryStatus.mergeExecutionAvailable && <em>FUSIÓN NO DISPONIBLE</em>}
      </section> : <section className="consolidation-recovery-status state-unavailable"><div><strong>ESTADO NATIVO NO DISPONIBLE</strong><span>Abre Alice como aplicación de escritorio; el navegador no fabrica recibos.</span></div><em>FUSIÓN NO DISPONIBLE</em></section>}
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
              <header><div><strong>PLAN R6.3-F VERIFICADO</strong><span>SOLO LECTURA · NO EJECUTABLE</span></div><code>{mergePlan.projectedSourceSha256}</code></header>
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
              <div className="merge-transaction-receipt"><div><strong>RECIBO R6.3-E · V{mergePlan.transactionReceiptVersion}</strong><span>RECUPERACIÓN TRAS REINICIO OBLIGATORIA</span></div><code>{mergePlan.transactionReceiptFile}</code><em>{mergePlan.restorationCommandAvailable ? "RESTAURACIÓN R6.3-F DISPONIBLE SÓLO CON RECIBO" : "RESTAURACIÓN DESCONECTADA"}</em></div>
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
    {filtered.length === 0 ? <div className="memory-empty"><span>◌</span><h3>{remembered.length ? "No encontramos recuerdos con esa búsqueda." : "La memoria duradera todavía está vacía."}</h3><p>{remembered.length ? "Probá con otras palabras." : "Una conversación u observación autorizada podrá producir candidatos; ninguno se consolidará automáticamente."}</p></div> : <div className="memory-list">{filtered.map((session) => <article className="memory-record" key={session.id}>
      <div className="memory-meta"><div><span className="tag">{session.kind}</span>{session.memoryType && <span className="memory-type">{memoryTypeLabels[session.memoryType]}</span>}{session.memoryVersion && <span className="memory-type version">V{session.memoryVersion}</span>}</div><small>{session.finishedAt && formatDate(session.finishedAt)}</small></div>
      <div className="memory-body"><h3>{session.intention}</h3>{editingId === session.id ? <div className="memory-editor reconsolidation-editor">
        <label>Título o intención<input value={editIntention} onChange={(event) => { setEditIntention(event.target.value); setReconsolidationPreview(null); }} /></label>
        <label>Contenido<textarea value={summary} onChange={(event) => { setSummary(event.target.value); setReconsolidationPreview(null); }} /></label>
        <label>Próximo paso<input value={nextStep} onChange={(event) => { setNextStep(event.target.value); setReconsolidationPreview(null); }} /></label>
        {session.kind === "Enseñanza" && <label>Fuente<input value={editSource} onChange={(event) => { setEditSource(event.target.value); setReconsolidationPreview(null); }} /></label>}
        {session.memoryStatus === "confirmed" || session.memoryStatus === "conflict" ? <div className="reconsolidation-controls"><p><strong>R6.5-H · EDICIÓN VERSIONADA</strong> La versión actual no se sobrescribirá. Primero se crea una vista previa y después pedirá una segunda confirmación.</p><label>Motivo<select value={reconsolidationReason} onChange={(event) => { setReconsolidationReason(event.target.value as MemoryReconsolidationReason); setReconsolidationPreview(null); }}><option value="ownerCorrection">Corrección del propietario</option><option value="newContext">Información o contexto nuevo</option><option value="clarification">Aclaración</option></select></label><label>Por qué debe actualizarse<textarea value={reconsolidationNote} maxLength={500} onChange={(event) => { setReconsolidationNote(event.target.value); setReconsolidationPreview(null); }} placeholder="Explicá la evidencia o el contexto de esta actualización" /></label>{reconsolidationPreview && <div className="reconsolidation-preview"><strong>PLAN VERIFICADO · V{reconsolidationPreview.previousVersion} → V{reconsolidationPreview.projectedVersion}</strong><span>{reconsolidationPreview.changedFields.join(" · ")}</span><code>{reconsolidationPreview.planId}</code><small>SIN ESCRITURAS · SIN ACCIÓN AUTOMÁTICA</small></div>}</div> : session.kind === "Enseñanza" && <label>Importancia: {editImportance}/5<input type="range" min="1" max="5" step="1" value={editImportance} onChange={(event) => setEditImportance(Number(event.target.value))} /></label>}
        <div className="action-row"><button className="secondary" onClick={() => { setEditingId(null); setReconsolidationPreview(null); }}>Cancelar</button>{reconsolidationPreview ? <button className="primary" disabled={operationRunning} onClick={() => void confirmReconsolidation()}>Confirmar nueva versión</button> : <button className="primary" disabled={operationRunning} onClick={() => void saveOrPreview()}>{session.memoryStatus === "confirmed" || session.memoryStatus === "conflict" ? "Preparar versión" : "Guardar cambios"}</button>}</div>
      </div> : <><p>{session.summary || "Sin resumen todavía."}</p><div className="memory-evidence">{session.source && <span>FUENTE · {session.source}</span>}<span>IMPORTANCIA · {session.importance ?? 3}/5</span><span>ESTABILIDAD · {Math.round((session.storageStrength ?? .08) * 100)}%</span><span>RECUPERACIONES · {session.successfulRecalls ?? 0}</span><span>REVISIONES · {session.successfulReviews ?? 0}</span><span>VERSIÓN · {session.memoryVersion ?? 1}</span>{session.archiveStatus === "archived" && <span>ARCHIVO · REVERSIBLE</span>}{session.deletionStatus === "scheduled" && <span>ELIMINACIÓN · EN ESPERA HASTA {session.deletionEligibleAt ? formatDate(session.deletionEligibleAt) : "FECHA NO DISPONIBLE"}</span>}</div>{session.nextStep && <p className="next"><strong>Sigue:</strong> {session.nextStep}</p>}<div className="memory-actions"><button disabled={session.archiveStatus === "archived"} title={session.archiveStatus === "archived" ? "Restaurá el recuerdo antes de editarlo" : "Crear una versión sucesora"} onClick={() => edit(session)}>Editar con versión</button><button className="danger" disabled={Boolean(session.memoryStatus || session.memoryVersion || session.archiveStatus)} title={session.memoryStatus || session.memoryVersion || session.archiveStatus ? "Los recuerdos durables se retiran desde Ciclo con archivo, espera y resguardo" : "Eliminar registro no evaluado"} onClick={() => remove(session)}>Eliminar</button></div></>}</div>
    </article>)}</div>}</div>}
  </section>;
}
