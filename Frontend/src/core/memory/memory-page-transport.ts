import { invoke, isTauri } from "@tauri-apps/api/core";
import { resetConversationRetrieval } from "../conversation/conversation-session";
import type { AutomaticMemoryReview } from "./automatic-memory";
import { learningSnapshot, reviewAutomaticLearning, subscribeToLearning, toggleAutomaticMemory, toggleSelfStudy } from "./learning-session";
import { parseLayeredMemorySnapshot, type LayeredMemorySnapshot } from "./layered-memory";
import { parseMemoryLifecyclePreview } from "./memory-lifecycle";
import { isLegacyMemoryDiscardable } from "./memory-discard";
import {
  parseMemoryReconsolidationPreview, parseMemoryReconsolidationResult,
  type MemoryReconsolidationPreview, type MemoryReconsolidationReason,
} from "./memory-reconsolidation";
import {
  clearWorkingMemory, discardMemory, exportMemory, memorySessionSnapshot, openMemoryDirectory, reloadMemoryFromDisk,
  restoreMemory, subscribeToMemory, updateMemory,
} from "./memory-session";
import { projectMemoryPage } from "./memory-page-projection";

export type MaintenanceView = "review" | "consolidate";

type Edit = {
  id: string;
  intention: string;
  summary: string;
  nextStep: string;
  source: string;
  importance: number;
  reason: MemoryReconsolidationReason;
  note: string;
};

function readEdit(value: Partial<Edit> | undefined): Edit {
  if (!value || typeof value.id !== "string" || typeof value.intention !== "string" || typeof value.summary !== "string"
    || typeof value.nextStep !== "string" || typeof value.source !== "string" || typeof value.note !== "string"
    || (value.reason !== "ownerCorrection" && value.reason !== "newContext" && value.reason !== "clarification")
    || typeof value.importance !== "number" || !Number.isInteger(value.importance) || value.importance < 1 || value.importance > 5) {
    throw new Error("Edición de recuerdo inválida.");
  }
  return { id: value.id, intention: value.intention, summary: value.summary, nextStep: value.nextStep, source: value.source,
    importance: value.importance, reason: value.reason, note: value.note };
}

export function createMemoryPageTransport(onMaintenance: (view: MaintenanceView | null) => void) {
  let reply: ((value: unknown) => void) | undefined;
  let stops: (() => void)[] = [];
  let disposed = false;
  let pending = false;
  let view = "";
  let lastSessions = memorySessionSnapshot().sessions;
  let layerRevision = 0;
  let layersDirty = false;
  let layers: LayeredMemorySnapshot | null = null;
  let version: { plan: MemoryReconsolidationPreview; input: object } | null = null;

  const publish = () => reply?.({ type: "page", page: projectMemoryPage() });
  const publishLayers = (loading: boolean, error = "") => reply?.({ type: "layers", layers, loading, error });
  const publishSession = () => {
    publish();
    const { sessions } = memorySessionSnapshot();
    if (lastSessions !== sessions) {
      lastSessions = sessions;
      ++layerRevision;
      layersDirty = true;
      layers = null;
      if (view === "layers") {
        if (pending) publishLayers(true);
        else void readLayers();
      }
    }
  };

  async function readLayers() {
    if (!isTauri()) return;
    layersDirty = false;
    const revision = ++layerRevision;
    publishLayers(true);
    try {
      const snapshot = parseLayeredMemorySnapshot(await invoke("layered_memory_status"));
      if (revision !== layerRevision || disposed) return;
      layers = snapshot;
      publishLayers(false);
    } catch (error) {
      if (revision === layerRevision && !disposed) { layers = null; publishLayers(false, String(error)); }
    }
  }

  async function saveOrPreview(value: Partial<Edit>) {
    const edit = readEdit(value);
    const record = memorySessionSnapshot().sessions.find(item => item.id === edit.id);
    if (!record?.finishedAt || record.archiveStatus === "archived") throw new Error("El recuerdo actual no admite edición.");
    version = null;
    if (record.memoryStatus !== "confirmed" && record.memoryStatus !== "conflict") {
      await updateMemory(edit.id, {
        intention: edit.intention.trim(), summary: edit.summary.trim(), nextStep: edit.nextStep.trim(),
        source: edit.source.trim() || undefined, importance: edit.importance,
      });
      return { closeEdit: true };
    }
    if (!isTauri()) throw new Error("La reconsolidación versionada requiere la aplicación de escritorio.");
    const lifecycle = parseMemoryLifecyclePreview(await invoke("memory_lifecycle_preview"));
    const reference = lifecycle.preview?.references.find(item => item.recordId === edit.id);
    if (!lifecycle.sourceSha256 || !reference) throw new Error("El recuerdo no aparece en la fuente vigente.");
    const input = {
      expectedSourceSha256: lifecycle.sourceSha256, recordId: edit.id, expectedRecordSha256: reference.recordSha256,
      reason: edit.reason, note: edit.note, proposedIntention: edit.intention, proposedSummary: edit.summary.trim() || null,
      proposedNextStep: edit.nextStep.trim() || null, proposedSource: edit.source.trim() || null,
    };
    const plan = parseMemoryReconsolidationPreview(await invoke("preview_memory_reconsolidation", { input }));
    if (plan.recordId !== edit.id || plan.sourceSha256 !== input.expectedSourceSha256 || plan.recordSha256Before !== input.expectedRecordSha256) {
      throw new Error("El plan no coincide con el recuerdo revisado.");
    }
    version = { plan, input };
    return { plan, message: "Vista previa verificada. Todavía no se modificó records.json ni se escribió una versión." };
  }

  async function execute(action: Record<string, unknown>) {
    switch (action.type) {
      case "save":
        return saveOrPreview(action.edit as Partial<Edit>);
      case "confirmVersion": {
        const saved = version;
        if (!saved || saved.plan.planId !== action.planId) throw new Error("Prepará y revisá la versión nuevamente.");
        const { plan, input } = saved;
        if (!window.confirm(`¿Crear la versión ${plan.projectedVersion} de este recuerdo?\n\nLa versión ${plan.previousVersion} quedará preservada de forma inmutable. Rust volverá a comprobar el plan, respaldará records.json y restaurará todo si falla la auditoría.`)) return {};
        const result = parseMemoryReconsolidationResult(await invoke("confirm_memory_reconsolidation", {
          input: { ...input, expectedPlanId: plan.planId, plannedAt: plan.plannedAt, confirmed: true },
        }));
        version = null;
        try {
          const count = await reloadMemoryFromDisk();
          return { closeEdit: true, message: `Reconsolidación confirmada: versión ${result.previousVersion} → ${result.newVersion}. ${count} recuerdos recargados.` };
        } catch (error) {
          return { closeEdit: true, message: `Versión ${result.newVersion} guardada y auditada. No se pudo recargar la vista: ${String(error)}` };
        }
      }
      case "discard": {
        const record = memorySessionSnapshot().sessions.find(item => item.id === action.id);
        if (!record || !isLegacyMemoryDiscardable(record)) throw new Error("Este recuerdo se gestiona desde Ciclo y archivo reversible.");
        if (!window.confirm(`¿Descartar el registro heredado todavía no evaluado de “${record.intention}”?\n\nRust conservará el respaldo local anterior y confirmará la escritura.`)) return {};
        const count = await discardMemory(record.id);
        return { message: `Fragmento heredado descartado con respaldo y persistencia verificada. Permanecen ${count} recuerdos.` };
      }
      case "clear": {
        const snapshot = memorySessionSnapshot().workingMemory;
        if (!snapshot?.messageCount || snapshot.generation !== action.generation) throw new Error("La memoria de trabajo cambió. Revisá la generación actual.");
        if (!window.confirm(`¿Vaciar los ${snapshot.messageCount} mensajes de la memoria de trabajo? Se conservarán los recuerdos, enseñanzas y revisiones R6.1.`)) return {};
        const result = await clearWorkingMemory(snapshot.generation);
        return { message: result.warning ?? "Memoria de trabajo vaciada. Los recuerdos duraderos permanecen intactos." };
      }
      case "toggleStudy":
        if (typeof action.enabled !== "boolean" || !learningSnapshot().selfStudy) break;
        await toggleSelfStudy(action.enabled);
        return {};
      case "toggleAutomatic":
        if (typeof action.enabled !== "boolean" || !learningSnapshot().automaticMemory) break;
        await toggleAutomaticMemory(action.enabled);
        return { closeAutomaticEdit: true };
      case "reviewAutomatic": {
        const item = learningSnapshot().automaticMemory?.records.find(record => record.id === action.id);
        if (!item) break;
        let review: AutomaticMemoryReview;
        if (action.decision === "correct" && typeof action.content === "string" && action.content.trim() && action.content.length <= 1000) {
          review = { id: item.id, action: "correct", content: action.content };
        } else if (action.decision === (item.active ? "withdraw" : "restore")) {
          review = { id: item.id, action: item.active ? "withdraw" : "restore" };
        } else break;
        await reviewAutomaticLearning(review);
        resetConversationRetrieval();
        return { closeAutomaticEdit: true };
      }
      case "refreshLayers":
        await readLayers();
        return {};
      case "activateLayers":
      case "rollbackLayers": {
        const activate = action.type === "activateLayers";
        const hash = layers?.preview?.sourceSha256;
        const revision = layers?.activeRevisionId;
        if (!layers || !isTauri() || (activate ? !hash || !["ready", "rolledBack", "sourceChanged"].includes(layers.state) : !revision)) {
          throw new Error("Revisá primero la proyección y la huella de la fuente.");
        }
        if (!window.confirm(activate ? "¿Activar esta proyección R6.1? records.json se preservará byte a byte y el índice podrá revertirse."
          : "¿Desactivar la proyección R6.1? El archivo y sus revisiones se conservarán.")) return {};
        ++layerRevision;
        layers = parseLayeredMemorySnapshot(await invoke(activate ? "activate_layered_memory" : "rollback_layered_memory", {
          input: activate ? { expectedSourceSha256: hash, confirmed: true } : { expectedRevisionId: revision, confirmed: true },
        }));
        publishLayers(false);
        return { message: activate ? "Proyección R6.1 activada y ligada a la huella revisada." : "Proyección R6.1 desactivada. La revisión y la memoria original permanecen intactas." };
      }
      case "openDirectory": return { message: `Carpeta de memoria abierta: ${await openMemoryDirectory()}` };
      case "export": return { message: `Exportación creada en: ${await exportMemory()}` };
      case "restore": {
        if (!window.confirm("¿Restaurar el respaldo anterior? Alice guardará primero la memoria actual en backups/records.pre-restore.json.")) return {};
        const count = await restoreMemory();
        version = null;
        return { closeEdit: true, message: `Respaldo restaurado correctamente: ${count} recuerdos cargados.` };
      }
    }
    throw new Error("Operación de Memoria inválida.");
  }

  return {
    dispatch(raw: string, respond: (value: unknown) => void) {
      if (disposed) return;
      let action;
      try { action = JSON.parse(raw); } catch { return; }
      if (action?.type === "connect") {
        if (reply) return;
        reply = respond;
        stops = [subscribeToMemory(publishSession), subscribeToLearning(publish)];
        publish();
        return;
      }
      if (action?.type === "view" && typeof action.view === "string") {
        if (view !== action.view) {
          view = action.view;
          reply?.({ type: "maintenance", count: null, busy: false });
          onMaintenance(view === "review" || view === "consolidate" ? view : null);
          if (view === "layers") void readLayers();
        }
        return;
      }
      if (pending || !Number.isInteger(action?.request) || action.request <= 0 || action.request > 0xffff_ffff) return;
      pending = true;
      const complete = (result: unknown) => {
        pending = false;
        reply?.({ type: "result", request: action.request, result });
        if (!disposed && view === "layers" && layersDirty) void readLayers();
      };
      void execute(action).then(complete, error => complete({ error: String(error) }));
    },
    openEditor(id: string) { reply?.({ type: "editRecord", id }); },
    reportMaintenance(section: MaintenanceView, count: number | null, busy: boolean) {
      if (section === view) reply?.({ type: "maintenance", count, busy });
    },
    dispose() {
      disposed = true;
      reply = undefined;
      for (const stop of stops) stop();
      stops = [];
    },
  };
}
