import { parseGovernanceAction } from "./view-action";
import { riskLabel } from "./display-labels";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseCapabilityRegistrySnapshot } from "./capabilities";
import type { CapabilityRegistrySnapshot } from "./capabilities";
import {
  parseSkillDraftRecord,
  parseSkillDraftStoreSnapshot,
  parseSkillLifecycleSnapshot,
  parseSkillLifecycleRecord,
  parseSkillLifecycleTransitionResult,
  parseSkillManifest,
  parseSkillSimulationResult,
} from "./skills";
import type {
  SkillDraftRecord,
  SkillDraftStoreSnapshot,
  SkillLifecycleAction,
  SkillLifecycleSnapshot,
  SkillManifest,
  SkillSimulationResult,
} from "./skills";
import { lifecycleActionDescription, lifecycleActionsForStatus } from "./skill-workshop";

const statusLabels: Record<SkillManifest["status"], string> = {
  draft: "BORRADOR",
  inReview: "EN REVISIÓN",
  approved: "APROBADA",
  disabled: "DESACTIVADA",
  retired: "RETIRADA",
};

const readinessLabel: Record<SkillSimulationResult["steps"][number]["readiness"], string> = {
  available: "Disponible", manualReview: "Revisión manual", blocked: "Bloqueado",
};

function shortDigest(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function createSkillTransport(desktopApp: boolean) {
  let reply: ((value: unknown) => void) | undefined;
  let disposed = false;

  function update() { if (!disposed) reply?.(project()); }
  let registry: CapabilityRegistrySnapshot | null = null;
  let draftStore: SkillDraftStoreSnapshot | null = null;
  let lifecycle: SkillLifecycleSnapshot | null = null;
  let manifest: SkillManifest | null = null;
  let record: SkillDraftRecord | null = null;
  let currentSha = "";
  let simulation: SkillSimulationResult | null = null;
  let dirty = false;
  let busy = "";
  let error = "";
  let notice = "";
  let confirmationChecked = false;
  let confirmationReason = "";

  const refreshStores = async (activeRegistry: CapabilityRegistrySnapshot) => {
    const [rawDrafts, rawLifecycle] = await Promise.all([
      invoke<unknown>("skill_draft_store_status"),
      invoke<unknown>("skill_lifecycle_status"),
    ]);
    draftStore = parseSkillDraftStoreSnapshot(rawDrafts);
    lifecycle = parseSkillLifecycleSnapshot(rawLifecycle);
    registry = activeRegistry;
  };

  function connect() {
    if (!desktopApp || !isTauri()) return;
    busy = "Cargando registro nativo";
    void invoke("capability_registry_status").then(parseCapabilityRegistrySnapshot)
      .then(activeRegistry => { if (!disposed) return refreshStores(activeRegistry); })
      .catch(cause => { error = String(cause); }).finally(() => { busy = ""; update(); });
  }

  const canConfirm = () => confirmationChecked && confirmationReason.trim().length >= 12 && !dirty && Boolean(currentSha);

  async function prepareTemplate() {
    if (!registry) return;
    busy = "Preparando plantilla nativa";
    error = "";
    notice = "";
    try {
      const prepared = parseSkillManifest(await invoke<unknown>("prepare_read_only_skill_template"), registry);
      manifest = prepared;
      record = null;
      currentSha = "";
      simulation = null;
      dirty = true;
      notice = "Plantilla preparada en memoria. Todavía no se escribió ningún archivo.";
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  async function openDraft(skillId: string) {
    if (!registry) return;
    busy = "Abriendo borrador";
    error = "";
    try {
      const opened = parseSkillDraftRecord(await invoke<unknown>("read_skill_draft", { input: { skillId } }), registry);
      manifest = opened.manifest;
      record = opened;
      currentSha = opened.sha256;
      simulation = null;
      dirty = false;
      notice = "Borrador verificado por SHA-256 y abierto desde el almacén privado.";
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  async function openLifecycleSkill(skillId: string) {
    if (!registry) return;
    busy = "Abriendo revisión gobernada";
    error = "";
    try {
      const opened = parseSkillLifecycleRecord(await invoke<unknown>("read_skill_lifecycle", { input: { skillId } }), registry);
      manifest = opened.manifest;
      record = null;
      currentSha = opened.sha256;
      simulation = null;
      dirty = false;
      notice = `Revisión inmutable R${opened.revisionCount} verificada por SHA-256.`;
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  function edit(field: "title" | "description" | "purpose", value: string) {
    if (!manifest || manifest.status !== "draft") return;
    manifest = { ...manifest, [field]: value };
    dirty = true;
    simulation = null;
    notice = "";
  }

  async function saveDraft() {
    if (!manifest || !registry || manifest.status !== "draft") return;
    busy = "Guardando revisión";
    error = "";
    try {
      const now = new Date().toISOString();
      const candidate: SkillManifest = record ? {
        ...manifest,
        revisionId: crypto.randomUUID(),
        provenance: {
          ...manifest.provenance,
          updatedAt: now,
          parentRevisionId: record.manifest.revisionId,
        },
      } : {
        ...manifest,
        provenance: { ...manifest.provenance, updatedAt: now },
      };
      const validated = parseSkillManifest(candidate, registry);
      const saved = parseSkillDraftRecord(await invoke<unknown>("save_skill_draft", {
        input: { manifest: validated, expectedRevisionId: record?.manifest.revisionId ?? null },
      }), registry);
      manifest = saved.manifest;
      record = saved;
      currentSha = saved.sha256;
      dirty = false;
      simulation = null;
      notice = `Borrador guardado y verificado: ${shortDigest(saved.sha256)}.`;
      await refreshStores(registry);
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  async function simulate() {
    if (!manifest || !registry) return;
    busy = "Simulando plan";
    error = "";
    try {
      const validated = parseSkillManifest(manifest, registry);
      const result = parseSkillSimulationResult(await invoke<unknown>("simulate_skill_plan", { input: { manifest: validated } }));
      simulation = result;
      notice = "Plan calculado sin invocar adaptadores ni aplicar efectos.";
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  async function transition(action: SkillLifecycleAction) {
    if (!manifest || !registry || !canConfirm()) return;
    const lifecycleSummary = lifecycle?.skills.find(skill => skill.skillId === manifest?.skillId);
    const expectedRevisionId = lifecycleSummary?.revisionId ?? manifest.revisionId;
    const expectedSha256 = lifecycleSummary?.sha256 ?? currentSha;
    busy = "Registrando transición";
    error = "";
    try {
      const result = parseSkillLifecycleTransitionResult(await invoke<unknown>("transition_skill_lifecycle", {
        input: {
          skillId: manifest.skillId,
          expectedRevisionId,
          action,
          confirmation: {
            actor: "localOwner",
            confirmed: true,
            expectedSha256,
            reason: confirmationReason.trim(),
          },
        },
      }), registry);
      manifest = result.manifest;
      record = null;
      currentSha = result.sha256;
      dirty = false;
      simulation = null;
      confirmationChecked = false;
      confirmationReason = "";
      notice = `${statusLabels[result.manifest.status]} registrada. Ejecución continúa deshabilitada.`;
      await refreshStores(registry);
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }


  function project() {
    return {
      type: "skills", desktop: desktopApp, busy, error, notice, ready: registry !== null,
      metrics: [
        ["REGISTRO R1", String(registry?.capabilities.length ?? 0), "capacidades reales"],
        ["BORRADORES", String(draftStore?.drafts.length ?? 0), "editables"],
        ["GOBERNADAS", String(lifecycle?.skills.length ?? 0), "revisiones inmutables"],
        ["ADAPTADORES", "0", "invocados por simulación"],
      ],
      drafts: (draftStore?.drafts ?? []).map(draft => ({
        id: draft.skillId, title: draft.title, detail: `${draft.skillId} · ${shortDigest(draft.sha256)}`,
        selected: manifest?.revisionId === draft.revisionId,
      })),
      lifecycle: (lifecycle?.skills ?? []).map(skill => ({
        id: skill.skillId, title: skill.title, detail: `${statusLabels[skill.status]} · R${skill.revisionCount} · ${shortDigest(skill.sha256)}`,
        selected: manifest?.revisionId === skill.revisionId,
      })),
      manifest: manifest && {
        id: manifest.skillId, status: statusLabels[manifest.status], risk: riskLabel[manifest.declaredRisk],
        title: manifest.title, description: manifest.description, purpose: manifest.purpose, editable: manifest.status === "draft",
        capability: manifest.requiredCapabilities[0]?.capabilityId ?? "", operations: manifest.requiredCapabilities[0]?.operations.join(", ") ?? "",
        output: manifest.outputs[0]?.label ?? "", saved: Boolean(currentSha), dirty, sha: currentSha ? shortDigest(currentSha) : "",
        confirmed: confirmationChecked, reason: confirmationReason, canConfirm: canConfirm(),
        actions: lifecycleActionsForStatus(manifest.status).map(item => ({ ...item, detail: lifecycleActionDescription(item.action) })),
      },
      simulation: simulation && {
        steps: simulation.steps.map(step => ({
          position: String(step.position).padStart(2, "0"), title: step.title, detail: `${step.capabilityId} / ${step.operation}`,
          readiness: readinessLabel[step.readiness],
        })),
        blocks: simulation.blocks.map(block => [block.code, block.summary]),
        metrics: [
          ["HUELLA DEL MANIFIESTO", shortDigest(simulation.manifestSha256)], ["HUELLA DEL PLAN", shortDigest(simulation.planSha256)],
          ["ADAPTADORES", String(simulation.adapterInvocationCount)], ["EFECTOS", simulation.sideEffectsApplied ? "SÍ" : "NINGUNO"],
        ],
      },
    };
  }

  function clearConfirmation() {
    confirmationChecked = false;
    confirmationReason = "";
  }

  return {
    dispatch(raw: string, send: (value: unknown) => void) {
      const event = parseGovernanceAction(raw);
      if (!event || disposed) return;
      if (event.type === "connect" && !reply) {
        reply = send;
        connect();
        update();
        return;
      }
      if (!reply || !desktopApp || !isTauri() || busy) return;
      const { type, id, value, checked } = event;
      switch (type) {
        case "prepare": clearConfirmation(); void prepareTemplate(); break;
        case "draft":
          if (id && draftStore?.drafts.some(draft => draft.skillId === id)) { clearConfirmation(); void openDraft(id); }
          break;
        case "lifecycle":
          if (id && lifecycle?.skills.some(item => item.skillId === id)) { clearConfirmation(); void openLifecycleSkill(id); }
          break;
        case "edit":
          if (typeof value === "string" && (id === "title" || id === "description" || id === "purpose")) {
            clearConfirmation();
            edit(id, value.slice(0, id === "title" ? 120 : 600));
          }
          break;
        case "confirm": confirmationChecked = checked === true; break;
        case "reason": if (typeof value === "string") confirmationReason = value.slice(0, 600); break;
        case "save": if (dirty) void saveDraft(); break;
        case "simulate": void simulate(); break;
        case "transition": {
          const choice = manifest && lifecycleActionsForStatus(manifest.status).find(item => item.action === id);
          if (choice) void transition(choice.action);
          break;
        }
      }
      update();
    },
    dispose() { disposed = true; reply = undefined; },
  };
}
