import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  parseMemoryAccessibilityAssessmentResult, parseMemoryLifecyclePreview, parseMemorySuppressionAssessmentResult,
  parseMemoryValidityAssessmentResult, retainLifecycleEntriesForKnownRecords, type MemoryLifecyclePreviewSnapshot,
} from "./memory-lifecycle";
import { parseMemoryArchivePreview, parseMemoryArchiveResult } from "./memory-archive";
import {
  parseMemoryDeletionPreview, parseMemoryDeletionResult, parseMemoryDeletionSchedulePreview, parseMemoryDeletionScheduleResult,
} from "./memory-deletion";
import {
  parseConsolidationMergePreview, parseConsolidationPreview, parseConsolidationRecoveryStatus,
  parseConsolidationResolutionResult, parseConsolidationRestorationResult, type ConsolidationMergePreview,
  type ConsolidationPreviewSnapshot, type ConsolidationRecoveryStatusSnapshot,
} from "./memory-consolidation-preview";
import { buildReviewQueue } from "./memory-consolidation";
import { isLegacyMemoryDiscardable } from "./memory-discard";
import { memoryDateLabel } from "./memory-page-projection";
import { memorySessionSnapshot, reloadMemoryFromDisk, reviewMemory } from "./memory-session";

export type MaintenanceView = "review" | "consolidate";
type Action = Record<string, unknown>;
type Result = { message?: string; editRecord?: string; clearNotes?: PlanGroup; clearSource?: string };
type PlanGroup = "archive" | "retention";
type RecordPlan = {
  id: string;
  recordId: string;
  label: string;
  detail: string;
  note: string;
  final: boolean;
  confirm: () => Promise<Result>;
};

function usableNote(value: unknown) {
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > 500) {
    throw new Error("Escribí una nota de 1 a 500 caracteres para revisar el plan.");
  }
  return value;
}

const memoryTypes = { semantic: "Concepto", procedural: "Procedimiento", preference: "Preferencia", episodic: "Experiencia" };

function planDetails(plan?: RecordPlan) {
  if (!plan) return null;
  const { id, recordId, label, detail, note, final } = plan;
  return { id, recordId, label, detail, note, final };
}

export function createMemoryMaintenance(reply: (value: unknown) => void) {
  let view: MaintenanceView | null = null;
  let revision = 0;
  let loading = false;
  let error = "";
  let lifecycle: MemoryLifecyclePreviewSnapshot | null = null;
  let consolidation: ConsolidationPreviewSnapshot | null = null;
  let recovery: ConsolidationRecoveryStatusSnapshot | null = null;
  const plans = new Map<PlanGroup, RecordPlan>();
  const merges = new Map<string, ConsolidationMergePreview>();

  function publish() {
    const sessions = memorySessionSnapshot().sessions;
    const records = new Map(sessions.map(item => [item.id, item]));
    const ids = new Set(records.keys());
    const queue = buildReviewQueue(sessions.filter(item => item.finishedAt && item.kind === "Enseñanza" && item.memoryStatus !== undefined && item.archiveStatus !== "archived"));
    const next = queue.find(item => !item.due);
    const assessments = retainLifecycleEntriesForKnownRecords(lifecycle?.preview?.weakeningAssessments ?? [], ids);
    const references = retainLifecycleEntriesForKnownRecords(lifecycle?.preview?.references ?? [], ids);
    reply({
      type: "maintenance",
      data: {
        loading, error, lifecycle, consolidation, recovery,
        rows: references.map(reference => {
          const record = records.get(reference.recordId)!;
          return {
            ...reference, title: record.intention, source: record.source?.trim() ?? "", date: memoryDateLabel(record.finishedAt),
            kind: (record.memoryType && memoryTypes[record.memoryType]) || record.kind,
            discardable: isLegacyMemoryDiscardable(record),
            eligibleAt: record.deletionEligibleAt ? memoryDateLabel(record.deletionEligibleAt) : null,
            eligibleAtMs: record.deletionEligibleAt ? Date.parse(record.deletionEligibleAt) : null,
          };
        }),
        evidence: assessments.filter(item => item.state !== "notAssessed").map(item => ({ ...item, title: records.get(item.recordId)!.intention })),
        pendingReviews: queue.filter(item => item.due).slice(0, 3).map(({ memory }) => ({
          id: memory.id, title: memory.intention, conflict: memory.memoryStatus === "conflict",
          stability: Math.round((memory.storageStrength ?? .08) * 100), importance: memory.importance ?? 3,
        })),
        nextReview: next ? `Próximo repaso: “${next.memory.intention}”, ${memoryDateLabel(next.dueAt)}.` : null,
        candidateRecords: Object.fromEntries((consolidation?.candidates ?? []).flatMap(candidate => candidate.recordIds)
          .map(id => [id, { title: records.get(id)?.intention ?? "Registro no cargado", summary: records.get(id)?.summary || "Sin resumen" }])),
        archivePlan: planDetails(plans.get("archive")), retentionPlan: planDetails(plans.get("retention")),
        merges: Object.fromEntries(merges),
      },
    });
  }

  function invalidate() {
    ++revision;
    loading = false;
    error = "";
    lifecycle = null;
    consolidation = null;
    recovery = null;
    plans.clear();
    merges.clear();
    if (view) publish();
  }

  async function refresh(section: MaintenanceView) {
    if (!isTauri()) return;
    const reading = ++revision;
    plans.clear();
    if (section === "consolidate") merges.clear();
    loading = true;
    error = "";
    publish();
    try {
      if (section === "review") {
        const snapshot = parseMemoryLifecyclePreview(await invoke("memory_lifecycle_preview"));
        if (reading === revision) lifecycle = snapshot;
      } else {
        const [preview, status] = await Promise.all([invoke("consolidation_preview"), invoke("consolidation_recovery_status")]);
        if (reading === revision) {
          consolidation = parseConsolidationPreview(preview);
          recovery = parseConsolidationRecoveryStatus(status);
        }
      }
    } catch (cause) {
      if (reading === revision) {
        error = String(cause);
        if (section === "review") lifecycle = null;
        else { consolidation = null; recovery = null; }
      }
    } finally {
      if (reading === revision) { loading = false; publish(); }
    }
  }

  async function reloaded(message: string, snapshot?: MemoryLifecyclePreviewSnapshot) {
    plans.clear();
    if (snapshot) lifecycle = snapshot;
    try {
      const count = await reloadMemoryFromDisk();
      return { message: `${message} ${count} recuerdos recargados.` };
    } catch (cause) {
      publish();
      return { message: `${message} La escritura quedó auditada. Falló la recarga: ${String(cause)}` };
    }
  }

  function recordContext(action: Action) {
    const reference = lifecycle?.preview?.references.find(item => item.recordId === action.id && item.recordSha256 === action.hash);
    const record = memorySessionSnapshot().sessions.find(item => item.id === action.id);
    const source = lifecycle?.sourceSha256;
    if (!reference || !record || !source || action.source !== source) throw new Error("Volvé a consultar la huella del recuerdo.");
    return {
      reference, record,
      input: { expectedSourceSha256: source, recordId: record.id, expectedRecordSha256: reference.recordSha256 },
    };
  }

  function candidateContext(action: Action) {
    const candidate = consolidation?.candidates.find(item => item.candidateId === action.id);
    if (!candidate || candidate.resolution || !consolidation?.sourceSha256 || consolidation.sourceSha256 !== action.source) {
      throw new Error("Volvé a consultar los candidatos de la fuente actual.");
    }
    return { candidate, input: { expectedSourceSha256: consolidation.sourceSha256, candidateId: candidate.candidateId, expectedRecordIds: candidate.recordIds } };
  }

  async function assess(action: Action): Promise<Result> {
    const { record, reference, input } = recordContext(action);
    const decision = action.decision;
    if (action.type === "assessValidity" && reference.validity === "notAssessed" && (decision === "confirmCurrent" || decision === "markConflict")) {
      const declaredSource = record.source?.trim() || (typeof action.declaredSource === "string" ? action.declaredSource.trim() : "");
      if (!declaredSource) throw new Error("Declará la procedencia antes de decidir la vigencia.");
      const label = decision === "confirmCurrent" ? "confirmar la vigencia" : "marcar el conflicto";
      if (!window.confirm(`¿Querés ${label}?\n\n${record.intention}\nProcedencia: ${declaredSource}\n\nAlice verificará las huellas, respaldará la fuente y auditará la decisión.`)) return {};
      const result = parseMemoryValidityAssessmentResult(await invoke("assess_memory_validity", {
        input: { ...input, action: decision, declaredSource: record.source?.trim() ? null : declaredSource, confirmed: true },
      }));
      const updated = await reloaded(decision === "confirmCurrent" ? "Vigencia confirmada con respaldo y auditoría." : "Conflicto marcado con respaldo y auditoría.", result.lifecycle);
      return { ...updated, clearSource: record.id };
    }
    if (action.type === "assessAccessibility" && reference.validity === "current"
      && ((decision === "setDormant" && reference.accessibility !== "dormant") || (decision === "makeAccessible" && reference.accessibility !== "accessible"))) {
      const label = decision === "setDormant" ? "poner en reposo" : "permitir la recuperación de";
      if (!window.confirm(`¿Querés ${label} este recuerdo?\n\n${record.intention}\n\nSe conservará el contenido y quedarán registrados respaldo y auditoría.`)) return {};
      const result = parseMemoryAccessibilityAssessmentResult(await invoke("assess_memory_accessibility", { input: { ...input, action: decision, confirmed: true } }));
      return reloaded(decision === "setDormant" ? "Recuerdo puesto en reposo." : "Recuerdo nuevamente accesible.", result.lifecycle);
    }
    const reason = action.reason;
    if (action.type === "assessSuppression" && ((decision === "suppress" && reference.validity === "current" && !reference.suppressed) || (decision === "release" && reference.suppressed))
      && (reason === "ownerChoice" || reason === "sensitiveContext" || reason === "temporaryBoundary")) {
      const label = decision === "suppress" ? "suprimir" : "liberar de la supresión";
      if (!window.confirm(`¿Querés ${label} este recuerdo?\n\n${record.intention}\n\nLa decisión ajustará la recuperación con respaldo exacto y auditoría.`)) return {};
      const result = parseMemorySuppressionAssessmentResult(await invoke("assess_memory_suppression", { input: { ...input, action: decision, reason, confirmed: true } }));
      return reloaded(decision === "suppress" ? "Recuerdo suprimido." : "Supresión liberada.", result.lifecycle);
    }
    throw new Error("La decisión ya no corresponde al estado del recuerdo.");
  }

  async function previewRecord(action: Action): Promise<Result> {
    const { record, reference, input } = recordContext(action);
    const note = usableNote(action.note);
    const reading = revision;
    const group = action.type === "previewArchive" ? "archive" : "retention";
    if (plans.delete(group)) publish();
    const verify = (plan: { recordId: string; sourceSha256: string }, hash: string) => {
      if (plan.recordId !== record.id || plan.sourceSha256 !== input.expectedSourceSha256 || hash !== input.expectedRecordSha256) {
        throw new Error("El plan no coincide con la huella revisada.");
      }
    };
    const decision = action.decision;
    const reason = action.reason;
    let reviewed: RecordPlan;
    if (action.type === "previewArchive" && (reference.validity === "current" || reference.validity === "conflict")
      && ((decision === "archive" && !reference.archived) || (decision === "restore" && reference.archived))) {
      if (decision === "archive" && reason !== "ownerChoice" && reason !== "superseded" && reason !== "noLongerRelevant") throw new Error("Motivo de archivo inválido.");
      const plan = parseMemoryArchivePreview(await invoke("preview_memory_archive", { input: { ...input, action: decision, reason: decision === "restore" ? "relevantAgain" : reason, note } }));
      verify(plan, plan.recordSha256Before);
      if (plan.action !== decision) throw new Error("El plan corresponde a otra operación.");
      const label = decision === "archive" ? "archivar" : "restaurar";
      reviewed = {
        id: plan.planId, recordId: plan.recordId, label: decision === "archive" ? "PLAN DE ARCHIVO VERIFICADO" : "PLAN DE RESTAURACIÓN VERIFICADO",
        detail: plan.reason, note: "records.json intacto · acción automática: NO", final: false,
        async confirm() {
          if (!window.confirm(`¿Confirmás ${label} este recuerdo?\n\n${record.intention}\n\nAlice verificará plan y huellas y conservará un respaldo exacto con auditoría.`)) return {};
          const result = parseMemoryArchiveResult(await invoke("confirm_memory_archive", {
            input: { ...input, expectedPlanId: plan.planId, plannedAt: plan.plannedAt, action: plan.action, reason: plan.reason, note, confirmed: true },
          }));
          return reloaded(result.newArchived ? "Recuerdo archivado con respaldo y auditoría." : "Recuerdo restaurado con respaldo y auditoría.", result.lifecycle);
        },
      };
    } else if (action.type === "previewRetention" && reference.archived && reference.validity !== "archived"
      && ((decision === "schedule" && reference.retention !== "deletionScheduled") || (decision === "cancel" && reference.retention === "deletionScheduled"))) {
      const retentionReason = decision === "cancel" ? record.deletionReason : reason;
      if (retentionReason !== "ownerRequest" && retentionReason !== "duplicateAfterMerge" && retentionReason !== "privacyRemoval") throw new Error("Motivo de retención inválido.");
      const plan = parseMemoryDeletionSchedulePreview(await invoke("preview_memory_deletion_schedule", { input: { ...input, action: decision, reason: retentionReason, note } }));
      verify(plan, plan.recordSha256Before);
      if (plan.action !== decision) throw new Error("El plan corresponde a otra operación.");
      const schedule = decision === "schedule";
      reviewed = {
        id: plan.planId, recordId: plan.recordId, label: schedule ? "PLAN DE RETENCIÓN VERIFICADO" : "CANCELACIÓN VERIFICADA", detail: plan.reason,
        note: schedule ? `elegible ${memoryDateLabel(plan.eligibleAt)} · acción automática: NO` : "la espera será retirada · acción automática: NO", final: false,
        async confirm() {
          if (!window.confirm(`¿Confirmás ${schedule ? "programar la eliminación con siete días de espera" : "cancelar la eliminación"}?\n\nEl contenido permanecerá guardado con esta operación.`)) return {};
          const result = parseMemoryDeletionScheduleResult(await invoke("confirm_memory_deletion_schedule", {
            input: { ...input, expectedPlanId: plan.planId, plannedAt: plan.plannedAt, eligibleAt: plan.eligibleAt, action: plan.action, reason: plan.reason, note, confirmed: true },
          }));
          return reloaded(result.newScheduled ? `Eliminación programada para después de ${memoryDateLabel(result.eligibleAt ?? undefined)}.` : "Programación cancelada. El recuerdo sigue archivado.", result.lifecycle);
        },
      };
    } else if (action.type === "previewRetirement" && reference.archived && reference.validity !== "archived" && reference.retention === "deletionScheduled"
      && record.deletionEligibleAt && Date.parse(record.deletionEligibleAt) <= Date.now()) {
      const plan = parseMemoryDeletionPreview(await invoke("preview_memory_deletion", { input: { ...input, note } }));
      verify(plan, plan.recordSha256);
      reviewed = {
        id: plan.planId, recordId: plan.recordId, label: "RETIRO FINAL VERIFICADO", detail: "espera cumplida",
        note: "resguardo exacto obligatorio · lápida sin contenido · acción automática: NO", final: true,
        async confirm() {
          if (!window.confirm(`¿Confirmás retirar definitivamente de records.json este recuerdo?\n\n${record.intention}\n\nAlice volverá a verificar las huellas y la espera. Se conservará un resguardo privado exacto y una lápida sin contenido.`)) return {};
          const result = parseMemoryDeletionResult(await invoke("confirm_memory_deletion", {
            input: { ...input, expectedPlanId: plan.planId, plannedAt: plan.plannedAt, note, confirmed: true },
          }));
          return reloaded("Recuerdo retirado tras la espera con resguardo y lápida verificados.", result.lifecycle);
        },
      };
    } else throw new Error("El recuerdo ya no admite ese plan.");
    if (reading !== revision) throw new Error("La fuente cambió durante la preparación. Actualizá la lectura.");
    plans.set(group, reviewed);
    publish();
    return { message: "Vista previa verificada. records.json sigue intacto hasta la confirmación." };
  }

  return {
    refresh, invalidate,
    select(next: MaintenanceView | null) {
      if (view !== next) {
        view = next;
        invalidate();
      }
    },
    dropPlan(group: unknown) {
      if (group === "archive" || group === "retention") {
        plans.delete(group);
        if (view === "review") publish();
      }
    },
    async execute(action: Action): Promise<Result> {
      if (!view || !isTauri()) throw new Error("La operación requiere la vista local de mantenimiento.");
      if (action.type === "refreshMaintenance") {
        await refresh(view);
        return {};
      }
      if (loading) throw new Error("Esperá la lectura de la fuente vigente.");
      if (view === "review") {
        switch (action.type) {
          case "activateLifecycle":
          case "rollbackLifecycle": {
            const activate = action.type === "activateLifecycle";
            const source = lifecycle?.preview?.sourceSha256;
            const active = lifecycle?.activeRevisionId;
            if (activate ? !source || source !== action.source || !lifecycle?.lifecycleWritesAvailable || lifecycle.state === "active" : !active || active !== action.id) {
              throw new Error("La revisión cambió. Actualizá la lectura.");
            }
            if (!window.confirm(activate ? "¿Activar la revisión con la huella mostrada? Se respaldará el índice y se conservará records.json." : "¿Desactivar la revisión activa del ciclo? Se conservarán la revisión y sus respaldos.")) return {};
            lifecycle = parseMemoryLifecyclePreview(await invoke(activate ? "activate_memory_lifecycle" : "rollback_memory_lifecycle", {
              input: activate ? { expectedSourceSha256: source, confirmed: true } : { expectedRevisionId: active, confirmed: true },
            }));
            publish();
            return { message: activate ? "Índice del ciclo activado con huella y auditoría verificadas." : "Revisión desactivada de forma reversible." };
          }
          case "assessValidity":
          case "assessAccessibility":
          case "assessSuppression":
            return assess(action);
          case "previewArchive":
          case "previewRetention":
          case "previewRetirement":
            return previewRecord(action);
          case "confirmRecordPlan": {
            const group = action.group;
            if (group !== "archive" && group !== "retention") break;
            const plan = plans.get(group);
            if (!plan || plan.id !== action.planId) throw new Error("Prepará y revisá nuevamente el plan.");
            const result = await plan.confirm();
            return result.message ? { ...result, clearNotes: group } : result;
          }
          case "reviewTeaching": {
            const record = memorySessionSnapshot().sessions.find(item => item.id === action.id);
            const decision = action.decision;
            if (!record?.finishedAt || record.kind !== "Enseñanza" || !record.memoryStatus || record.archiveStatus === "archived"
              || (decision !== "confirmed" && decision !== "needs-correction")) break;
            await reviewMemory(record.id, decision);
            return decision === "confirmed" ? { message: `Repaso confirmado. “${record.intention}” sigue vigente.` }
              : { message: `“${record.intention}” quedó marcado para corrección. Abrí Registros para continuar.`, editRecord: record.id };
          }
        }
      } else {
        switch (action.type) {
          case "keepSeparate": {
            const { candidate, input } = candidateContext(action);
            const records = memorySessionSnapshot().sessions;
            const titles = candidate.recordIds.map(id => records.find(item => item.id === id)?.intention ?? id);
            if (!window.confirm(`¿Mantener separados estos recuerdos?\n\n1. ${titles[0]}\n2. ${titles[1]}\n\nLa decisión conservará la fuente y su respaldo exacto.`)) return {};
            const result = parseConsolidationResolutionResult(await invoke("resolve_consolidation_candidate", { input: { ...input, action: "keepSeparate", confirmed: true } }));
            consolidation = result.preview;
            merges.delete(candidate.candidateId);
            publish();
            return { message: `Decisión verificada. Ambos recuerdos permanecen separados. Respaldo: ${result.sourceBackupPath}` };
          }
          case "previewMerge": {
            const { candidate, input } = candidateContext(action);
            const survivor = action.survivor;
            if (candidate.kind !== "exactDuplicate" || typeof survivor !== "string" || !candidate.recordIds.includes(survivor)) break;
            const plan = parseConsolidationMergePreview(await invoke("preview_consolidation_merge", { input: { ...input, survivorRecordId: survivor } }));
            if (plan.candidateId !== candidate.candidateId || plan.sourceSha256 !== input.expectedSourceSha256 || plan.survivorRecordId !== survivor
              || !candidate.recordIds.every((id, index) => id === plan.recordIds[index])) throw new Error("La simulación corresponde a otro par.");
            merges.set(candidate.candidateId, plan);
            publish();
            return { message: "Plan R6.3-F verificado. El único comando de escritura disponible sobre una transacción existente es la restauración." };
          }
          case "restoreConsolidation": {
            const receipt = recovery?.receipt;
            if (!recovery?.restorationAvailable || !receipt || receipt.transactionId !== action.id || receipt.state === "restored") break;
            if (!window.confirm(`¿Restaurar el respaldo original verificado?\n\nRecibo: ${receipt.state}\nFuente actual: ${recovery.sourceRelation}`)) return {};
            const result = parseConsolidationRestorationResult(await invoke("restore_consolidation_transaction", {
              input: { transactionId: receipt.transactionId, expectedSourceSha256: receipt.sourceSha256, expectedProjectedSourceSha256: receipt.projectedSourceSha256, confirmed: true },
            }));
            recovery = result.status;
            publish();
            return reloaded(result.alreadyRestored ? "La restauración ya estaba cerrada." : "Fuente original restaurada y auditada.");
          }
        }
      }
      throw new Error("La operación de mantenimiento no está disponible para esta lectura.");
    },
  };
}
