import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseCapabilityRegistrySnapshot } from "../../core/governance/capabilities";
import type { CapabilityRegistrySnapshot } from "../../core/governance/capabilities";
import {
  parseSkillDraftRecord,
  parseSkillDraftStoreSnapshot,
  parseSkillLifecycleSnapshot,
  parseSkillLifecycleRecord,
  parseSkillLifecycleTransitionResult,
  parseSkillManifest,
  parseSkillSimulationResult,
} from "../../core/governance/skills";
import type {
  SkillDraftRecord,
  SkillDraftStoreSnapshot,
  SkillLifecycleAction,
  SkillLifecycleSnapshot,
  SkillManifest,
  SkillSimulationResult,
} from "../../core/governance/skills";
import { lifecycleActionDescription, lifecycleActionsForStatus } from "../../core/governance/skill-workshop";

const statusLabels: Record<SkillManifest["status"], string> = {
  draft: "BORRADOR",
  inReview: "EN REVISIÓN",
  approved: "APROBADA",
  disabled: "DESACTIVADA",
  retired: "RETIRADA",
};

function shortDigest(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function Habilidades({ desktopApp }: { desktopApp: boolean }) {
  const [registry, setRegistry] = useState<CapabilityRegistrySnapshot | null>(null);
  const [draftStore, setDraftStore] = useState<SkillDraftStoreSnapshot | null>(null);
  const [lifecycle, setLifecycle] = useState<SkillLifecycleSnapshot | null>(null);
  const [manifest, setManifest] = useState<SkillManifest | null>(null);
  const [record, setRecord] = useState<SkillDraftRecord | null>(null);
  const [currentSha, setCurrentSha] = useState("");
  const [simulation, setSimulation] = useState<SkillSimulationResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [confirmationReason, setConfirmationReason] = useState("");

  const refreshStores = useCallback(async (activeRegistry: CapabilityRegistrySnapshot) => {
    const [rawDrafts, rawLifecycle] = await Promise.all([
      invoke<unknown>("skill_draft_store_status"),
      invoke<unknown>("skill_lifecycle_status"),
    ]);
    setDraftStore(parseSkillDraftStoreSnapshot(rawDrafts));
    setLifecycle(parseSkillLifecycleSnapshot(rawLifecycle));
    setRegistry(activeRegistry);
  }, []);

  useEffect(() => {
    if (!desktopApp || !isTauri()) return;
    let cancelled = false;
    setBusy("Cargando registro nativo");
    invoke<unknown>("capability_registry_status")
      .then(parseCapabilityRegistrySnapshot)
      .then(async (activeRegistry) => {
        if (cancelled) return;
        await refreshStores(activeRegistry);
      })
      .catch((reason) => !cancelled && setError(String(reason)))
      .finally(() => !cancelled && setBusy(""));
    return () => { cancelled = true; };
  }, [desktopApp, refreshStores]);

  const lifecycleSummary = useMemo(
    () => lifecycle?.skills.find((skill) => skill.skillId === manifest?.skillId) ?? null,
    [lifecycle, manifest?.skillId],
  );
  const actions = manifest ? lifecycleActionsForStatus(manifest.status) : [];
  const canConfirm = confirmationChecked && confirmationReason.trim().length >= 12 && !dirty && Boolean(currentSha);

  async function prepareTemplate() {
    if (!registry) return;
    setBusy("Preparando plantilla nativa");
    setError("");
    setNotice("");
    try {
      const prepared = parseSkillManifest(await invoke<unknown>("prepare_read_only_skill_template"), registry);
      setManifest(prepared);
      setRecord(null);
      setCurrentSha("");
      setSimulation(null);
      setDirty(true);
      setNotice("Plantilla preparada en memoria. Todavía no se escribió ningún archivo.");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function openDraft(skillId: string) {
    if (!registry) return;
    setBusy("Abriendo borrador");
    setError("");
    try {
      const opened = parseSkillDraftRecord(await invoke<unknown>("read_skill_draft", { input: { skillId } }), registry);
      setManifest(opened.manifest);
      setRecord(opened);
      setCurrentSha(opened.sha256);
      setSimulation(null);
      setDirty(false);
      setNotice("Borrador verificado por SHA-256 y abierto desde el almacén privado.");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function openLifecycleSkill(skillId: string) {
    if (!registry) return;
    setBusy("Abriendo revisión gobernada");
    setError("");
    try {
      const opened = parseSkillLifecycleRecord(await invoke<unknown>("read_skill_lifecycle", { input: { skillId } }), registry);
      setManifest(opened.manifest);
      setRecord(null);
      setCurrentSha(opened.sha256);
      setSimulation(null);
      setDirty(false);
      setNotice(`Revisión inmutable R${opened.revisionCount} verificada por SHA-256.`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  function edit(field: "title" | "description" | "purpose", value: string) {
    setManifest((current) => current ? { ...current, [field]: value } : current);
    setDirty(true);
    setSimulation(null);
    setNotice("");
  }

  async function saveDraft() {
    if (!manifest || !registry || manifest.status !== "draft") return;
    setBusy("Guardando revisión");
    setError("");
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
      setManifest(saved.manifest);
      setRecord(saved);
      setCurrentSha(saved.sha256);
      setDirty(false);
      setSimulation(null);
      setNotice(`Borrador guardado y verificado: ${shortDigest(saved.sha256)}.`);
      await refreshStores(registry);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function simulate() {
    if (!manifest || !registry) return;
    setBusy("Simulando plan");
    setError("");
    try {
      const validated = parseSkillManifest(manifest, registry);
      const result = parseSkillSimulationResult(await invoke<unknown>("simulate_skill_plan", { input: { manifest: validated } }));
      setSimulation(result);
      setNotice("Plan calculado sin invocar adaptadores ni aplicar efectos.");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  async function transition(action: SkillLifecycleAction) {
    if (!manifest || !registry || !canConfirm) return;
    const expectedRevisionId = lifecycleSummary?.revisionId ?? manifest.revisionId;
    const expectedSha256 = lifecycleSummary?.sha256 ?? currentSha;
    setBusy("Registrando transición");
    setError("");
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
      setManifest(result.manifest);
      setRecord(null);
      setCurrentSha(result.sha256);
      setDirty(false);
      setSimulation(null);
      setConfirmationChecked(false);
      setConfirmationReason("");
      setNotice(`${statusLabels[result.manifest.status]} registrada. Ejecución continúa deshabilitada.`);
      await refreshStores(registry);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  if (!desktopApp) return <section className="skills-page skills-unavailable">
    <span>R4 · TALLER NATIVO</span><h2>Taller de habilidades</h2>
    <p>Esta pantalla necesita la aplicación de escritorio porque los manifiestos, SHA-256 y auditorías viven en Rust. La vista web no fabrica un registro alternativo.</p>
  </section>;

  return <section className="skills-page" aria-labelledby="skills-title">
    <header className="skills-heading">
      <div><p className="eyebrow">[R4.5] LOCAL SKILL WORKSHOP · EXECUTION SAFE OFF</p><h2 id="skills-title">Taller de habilidades</h2><p>Diseñá, verificá y goberná capacidades compuestas sin entregar control oculto a Alice.</p></div>
      <span className="skills-safety"><i />EJECUCIÓN BLOQUEADA</span>
    </header>

    <div className="skills-metrics">
      <div><span>REGISTRO R1</span><strong>{registry?.capabilities.length ?? 0}</strong><small>capacidades reales</small></div>
      <div><span>BORRADORES</span><strong>{draftStore?.drafts.length ?? 0}</strong><small>editables</small></div>
      <div><span>GOBERNADAS</span><strong>{lifecycle?.skills.length ?? 0}</strong><small>revisiones inmutables</small></div>
      <div><span>ADAPTADORES</span><strong>0</strong><small>invocados por simulación</small></div>
    </div>

    {(busy || notice || error) && <div className={`skills-message ${error ? "is-error" : notice ? "is-success" : ""}`} role="status"><span>{busy ? "…" : error ? "ERR" : "OK"}</span><strong>{busy || error || notice}</strong></div>}

    <div className="skills-layout">
      <aside className="skills-library">
        <header><span>[01] BIBLIOTECA LOCAL</span><strong>{(draftStore?.drafts.length ?? 0) + (lifecycle?.skills.length ?? 0)} REGISTROS</strong></header>
        <button type="button" className="skills-template" onClick={prepareTemplate} disabled={Boolean(busy) || !registry}>
          <span>PLANTILLA NATIVA · SOLO LECTURA</span>
          <strong>Revisar proveedores de IA</strong>
          <small>Presencia de configuración y modelos públicos · sin claves · sin red</small>
        </button>
        <section><h3>BORRADORES</h3>{draftStore?.drafts.length ? draftStore.drafts.map((draft) => <button type="button" key={draft.revisionId} className={manifest?.revisionId === draft.revisionId ? "selected" : ""} onClick={() => openDraft(draft.skillId)}><strong>{draft.title}</strong><small>{draft.skillId} · {shortDigest(draft.sha256)}</small></button>) : <p>Sin borradores canónicos.</p>}</section>
        <section><h3>CICLO DE VIDA</h3>{lifecycle?.skills.length ? lifecycle.skills.map((skill) => <button type="button" key={skill.revisionId} className={manifest?.revisionId === skill.revisionId ? "selected" : ""} onClick={() => openLifecycleSkill(skill.skillId)}><strong>{skill.title}</strong><small>{statusLabels[skill.status]} · R{skill.revisionCount} · {shortDigest(skill.sha256)}</small></button>) : <p>Sin habilidades gobernadas.</p>}</section>
      </aside>

      <div className="skills-workbench">
        {!manifest ? <div className="skills-empty"><span>R4</span><strong>Prepará la primera habilidad real</strong><p>La plantilla se mantiene en memoria hasta que pulses “Guardar borrador”.</p></div> : <>
          <header className="skills-editor-heading"><div><span>{manifest.skillId}</span><strong>{statusLabels[manifest.status]} · RIESGO {manifest.declaredRisk.toUpperCase()}</strong></div><em>{dirty ? "CAMBIOS SIN GUARDAR" : currentSha ? shortDigest(currentSha) : "NO GUARDADA"}</em></header>
          <div className="skills-editor">
            <label>TÍTULO<input value={manifest.title} maxLength={120} disabled={manifest.status !== "draft"} onChange={(event) => edit("title", event.target.value)} /></label>
            <label>DESCRIPCIÓN<textarea value={manifest.description} maxLength={600} disabled={manifest.status !== "draft"} onChange={(event) => edit("description", event.target.value)} /></label>
            <label>PROPÓSITO<textarea value={manifest.purpose} maxLength={600} disabled={manifest.status !== "draft"} onChange={(event) => edit("purpose", event.target.value)} /></label>
          </div>
          <div className="skills-contract">
            <section><span>CAPACIDAD</span><strong>{manifest.requiredCapabilities[0]?.capabilityId}</strong><small>{manifest.requiredCapabilities[0]?.operations.join(", ")}</small></section>
            <section><span>EFECTOS PERMITIDOS</span><strong>LECTURA SANITIZADA</strong><small>sin escritura · sin red · sin procesos</small></section>
            <section><span>RESULTADO</span><strong>{manifest.outputs[0]?.label}</strong><small>no sensible</small></section>
          </div>
          <div className="skills-primary-actions">
            <button type="button" onClick={saveDraft} disabled={Boolean(busy) || manifest.status !== "draft" || !dirty}>Guardar borrador</button>
            <button type="button" onClick={simulate} disabled={Boolean(busy)}>Simular plan</button>
          </div>

          {simulation && <section className="skills-simulation">
            <header><span>[SIM] PLAN ESTÁTICO VERIFICADO</span><strong>{simulation.steps.length} PASO · {simulation.blocks.length} BLOQUEOS</strong></header>
            <div className="skills-simulation-grid"><div><span>MANIFEST SHA</span><strong>{shortDigest(simulation.manifestSha256)}</strong></div><div><span>PLAN SHA</span><strong>{shortDigest(simulation.planSha256)}</strong></div><div><span>ADAPTADORES</span><strong>{simulation.adapterInvocationCount}</strong></div><div><span>EFECTOS</span><strong>{simulation.sideEffectsApplied ? "SÍ" : "NINGUNO"}</strong></div></div>
            {simulation.steps.map((step) => <article key={step.stepId}><span>{String(step.position).padStart(2, "0")}</span><div><strong>{step.title}</strong><small>{step.capabilityId} / {step.operation}</small></div><em>{step.readiness.toUpperCase()}</em></article>)}
            <ul>{simulation.blocks.map((block, index) => <li key={`${block.code}-${index}`}><strong>{block.code}</strong> · {block.summary}</li>)}</ul>
          </section>}

          {currentSha && <section className="skills-governance">
            <header><span>[GOV] CONFIRMACIÓN DEL PROPIETARIO</span><strong>{actions.length ? "DECISIÓN REQUERIDA" : "CICLO CERRADO"}</strong></header>
            {actions.length ? <>
              <label className="skills-confirm"><input type="checkbox" checked={confirmationChecked} onChange={(event) => setConfirmationChecked(event.target.checked)} /><span>Confirmo que revisé la identidad, el SHA-256 y el efecto de esta transición.</span></label>
              <label>MOTIVO VISIBLE<textarea value={confirmationReason} maxLength={600} placeholder="Explicá por qué corresponde este cambio (mínimo 12 caracteres)." onChange={(event) => setConfirmationReason(event.target.value)} /></label>
              <div className="skills-lifecycle-actions">{actions.map(({ action, label, tone }) => <button type="button" key={action} className={`is-${tone}`} disabled={Boolean(busy) || !canConfirm} onClick={() => transition(action)} title={lifecycleActionDescription(action)}>{label}<small>{lifecycleActionDescription(action)}</small></button>)}</div>
            </> : <p>Esta habilidad está retirada. Su historial permanece verificable, pero no admite nuevas transiciones.</p>}
          </section>}
        </>}
      </div>
    </div>
  </section>;
}
