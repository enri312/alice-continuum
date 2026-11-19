import { parseGovernanceAction } from "./view-action";
import { riskLabel } from "./display-labels";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseCapabilityRegistrySnapshot, type CapabilityRegistrySnapshot } from "./capabilities";
import { parseProcedureDetectionSnapshot, type ProcedureDetectionSnapshot } from "./procedure-learning";
import {
  parseProcedureCandidateStoreSnapshot,
  parseProcedureDraftConversionResult,
  parseProcedureDraftConversionSnapshot,
  parseProcedurePatternDecisionResult,
  type ProcedureCandidateStoreSnapshot,
  type ProcedureDraftConversionSnapshot,
  type ProcedurePatternDecision,
} from "./procedure-store";

function shortDigest(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function defaultSkillId(fingerprint: string) {
  return `local.alice.procedure-${fingerprint.slice(7, 19)}`;
}

const evidenceStateLabels = {
  current: "EVIDENCIA VIGENTE",
  stale: "EVIDENCIA OBSOLETA",
  dismissed: "DESCARTADO",
  converted: "BORRADOR R4 CREADO",
  blocked: "VERIFICACIÓN BLOQUEADA",
} as const;

const variationDimensionLabels = {
  durationMs: "duración",
  subjectDigest: "huella del recurso",
} as const;

export function createProcedureTransport(desktopApp: boolean) {
  let reply: ((value: unknown) => void) | undefined;
  let disposed = false;

  function update() { if (!disposed) reply?.(project()); }

  let registry: CapabilityRegistrySnapshot | null = null;
  let detection: ProcedureDetectionSnapshot | null = null;
  let store: ProcedureCandidateStoreSnapshot | null = null;
  let conversions: ProcedureDraftConversionSnapshot | null = null;
  let selectedFingerprint = "";
  let conversionFingerprint = "";
  let action: ProcedurePatternDecision = "retain";
  let title = "";
  let purpose = "";
  let suggestedSkillId = "";
  let reason = "";
  let confirmed = false;
  let conversionTitle = "";
  let conversionDescription = "";
  let conversionPurpose = "";
  let conversionSkillId = "";
  let conversionReason = "";
  let conversionConfirmed = false;
  let busy = "";
  let error = "";
  let notice = "";

  const refresh = async (knownRegistry?: CapabilityRegistrySnapshot) => {
    const activeRegistry = knownRegistry ?? parseCapabilityRegistrySnapshot(await invoke<unknown>("capability_registry_status"));
    const [rawDetection, rawStore, rawConversions] = await Promise.all([
      invoke<unknown>("procedure_detection_status"),
      invoke<unknown>("procedure_candidate_store_status"),
      invoke<unknown>("procedure_draft_conversion_status"),
    ]);
    const nextDetection = parseProcedureDetectionSnapshot(rawDetection, activeRegistry);
    const nextStore = parseProcedureCandidateStoreSnapshot(rawStore);
    const nextConversions = parseProcedureDraftConversionSnapshot(rawConversions);
    registry = activeRegistry;
    detection = nextDetection;
    store = nextStore;
    conversions = nextConversions;
  };

  function connect() {
    if (!desktopApp || !isTauri()) return;
    busy = "Leyendo evidencia R3 y decisiones R5";
    void refresh().catch(cause => { error = String(cause); }).finally(() => { busy = ""; update(); });
  }

  const pending = () => {
    const decided = new Set(store?.decisions.map(decision => decision.fingerprint));
    return detection?.patterns.filter(pattern => !decided.has(pattern.fingerprint)) ?? [];
  };
  const converted = (id: string) => conversions?.conversions.some(item => item.fingerprint === id) ?? false;
  const currentPattern = () => pending().find(pattern => pattern.fingerprint === selectedFingerprint);
  const currentConversion = () => store?.decisions.find(decision =>
    decision.fingerprint === conversionFingerprint && decision.action === "retain" && decision.evidenceState === "current" && !converted(decision.fingerprint));
  const canSubmit = () => Boolean(currentPattern() && confirmed && reason.trim().length >= 12 &&
    (action === "dismiss" || (title.trim() && purpose.trim() && suggestedSkillId.trim())) && !busy);
  const canConvert = () => Boolean(currentConversion()?.candidateSha256 && conversionConfirmed && conversionReason.trim().length >= 12 &&
    conversionTitle.trim() && conversionDescription.trim() && conversionPurpose.trim() && conversionSkillId.trim() && !busy);

  function selectPattern(fingerprint: string) {
    const pattern = pending().find((candidate) => candidate.fingerprint === fingerprint);
    if (!pattern) return;
    selectedFingerprint = fingerprint;
    conversionFingerprint = "";
    action = "retain";
    title = `Procedimiento observado de ${pattern.steps.length} pasos`;
    purpose = `Conservar como propuesta revisable el patrón repetido ${shortDigest(fingerprint)} sin habilitar su ejecución.`;
    suggestedSkillId = defaultSkillId(fingerprint);
    reason = "";
    confirmed = false;
    error = "";
    notice = "";
  }

  function selectConversion(fingerprint: string) {
    const decision = store?.decisions.find((candidate) => candidate.fingerprint === fingerprint && candidate.action === "retain");
    if (!decision || decision.evidenceState !== "current" || converted(fingerprint)) return;
    conversionFingerprint = fingerprint;
    selectedFingerprint = "";
    conversionTitle = decision.title ?? "Procedimiento observado";
    conversionDescription = "Borrador derivado de un procedimiento repetido y conservado por el propietario.";
    conversionPurpose = "Permitir revisión y simulación en el Taller antes de cualquier aprobación futura.";
    conversionSkillId = decision.suggestedSkillId ?? defaultSkillId(fingerprint);
    conversionReason = "";
    conversionConfirmed = false;
    error = "";
    notice = "";
  }

  async function submitDecision() {
    const selected = currentPattern();
    if (!selected || !canSubmit() || !registry) return;
    busy = "Registrando decisión inmutable";
    error = "";
    notice = "";
    try {
      const result = parseProcedurePatternDecisionResult(await invoke<unknown>("record_procedure_pattern_decision", {
        input: {
          fingerprint: selected.fingerprint,
          action,
          title: action === "retain" ? title.trim() : null,
          purpose: action === "retain" ? purpose.trim() : null,
          suggestedSkillId: action === "retain" ? suggestedSkillId.trim() : null,
          confirmation: {
            actor: "localOwner",
            confirmed: true,
            expectedFingerprint: selected.fingerprint,
            reason: reason.trim(),
          },
        },
      }));
      await refresh(registry);
      selectedFingerprint = "";
      reason = "";
      confirmed = false;
      notice = `${result.decision.action === "retain" ? "Candidato conservado" : "Patrón descartado"}. Ejecución y borrador R4 permanecen en cero.`;
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  async function convertToDraft() {
    const conversionDecision = currentConversion();
    if (!conversionDecision?.candidateSha256 || !registry || !canConvert()) return;
    busy = "Creando borrador R4 con procedencia R5";
    error = "";
    notice = "";
    try {
      const result = parseProcedureDraftConversionResult(await invoke<unknown>("convert_procedure_candidate_to_draft", {
        input: {
          fingerprint: conversionDecision.fingerprint,
          expectedCandidateSha256: conversionDecision.candidateSha256,
          skillId: conversionSkillId.trim(),
          title: conversionTitle.trim(),
          description: conversionDescription.trim(),
          purpose: conversionPurpose.trim(),
          confirmation: {
            actor: "localOwner",
            confirmed: true,
            expectedFingerprint: conversionDecision.fingerprint,
            expectedCandidateSha256: conversionDecision.candidateSha256,
            reason: conversionReason.trim(),
          },
        },
      }), registry);
      await refresh(registry);
      conversionFingerprint = "";
      conversionConfirmed = false;
      conversionReason = "";
      notice = `Borrador ${result.draft.manifest.skillId} creado. Sigue sin aprobar y sin ejecutar.`;
    } catch (reason) {
      error = String(reason);
    } finally {
      busy = "";
      update();
    }
  }

  function project() {
    const pendingPatterns = pending();
    const selected = currentPattern();
    const conversion = currentConversion();
    const conversionCount = conversions?.conversions.length ?? 0;
    const decisions = store?.decisions ?? [];
    return {
      type: "procedures", desktop: desktopApp, busy, error, notice, conversionCount,
      metrics: [
        ["EVENTOS R3", String(detection?.scannedEventCount ?? 0), "evidencia visible"],
        ["EJECUCIONES ÚTILES", String(detection?.qualifyingExecutionCount ?? 0), "productoras y exitosas"],
        ["PATRONES PENDIENTES", String(pendingPatterns.length), `${store?.staleDecisionCount ?? 0} evidencias obsoletas`],
        ["CONVERSIONES R4", String(conversionCount), store?.blocked ? "R3 bloqueado" : `${decisions.length} decisiones R5`],
      ],
      patterns: pendingPatterns.map(pattern => ({
        id: pattern.fingerprint, title: pattern.steps.map(step => step.operation).join(" → "),
        detail: `${pattern.occurrences.length} repeticiones · riesgo ${riskLabel[pattern.declaredRisk]} · ${shortDigest(pattern.fingerprint)}`,
        selected: pattern.fingerprint === selectedFingerprint,
      })),
      decisions: decisions.map(decision => ({
        id: decision.fingerprint, title: decision.action === "retain" ? decision.title ?? "" : "Patrón descartado",
        detail: `${decision.action === "retain" ? "CONSERVADO" : "DESCARTADO"} · ${shortDigest(decision.fingerprint)}`,
        sha: decision.candidateSha256 ? shortDigest(decision.candidateSha256) : "", state: decision.evidenceState,
        status: evidenceStateLabels[decision.evidenceState],
        convertible: decision.action === "retain" && decision.evidenceState === "current" && !converted(decision.fingerprint),
      })),
      pattern: selected && {
        id: shortDigest(selected.fingerprint),
        detail: `${selected.occurrences.length} OCURRENCIAS · ${selected.steps.length} PASOS · RIESGO ${riskLabel[selected.declaredRisk]}`,
        steps: selected.steps.map(step => [String(step.position).padStart(2, "0"), step.operation, step.capabilityId]),
        evidence: selected.occurrences.map((occurrence, index) => [
          `EJECUCIÓN ${String(index + 1).padStart(2, "0")}`, shortDigest(occurrence.operationId),
          `${occurrence.evidenceEventIds.length} evidencias · orden verificable`,
        ]),
        eventCount: selected.occurrences.length * selected.steps.length,
        variations: selected.variations.map(variation => [
          selected.steps.find(step => step.id === variation.stepId)?.operation ?? variation.stepId,
          variationDimensionLabels[variation.dimension], `${variation.distinctValues} valores distintos en ${selected.occurrences.length} ejecuciones`,
        ]),
        window: `Ventana ${detection?.evidenceWindow} · mínimo ${detection?.minimumOccurrences} repeticiones y ${detection?.minimumSteps} pasos · persistencia automática y ejecución desactivadas`,
        action, title, purpose, skill: suggestedSkillId, reason, confirmed, canSubmit: canSubmit(),
      },
      conversion: conversion && {
        id: conversion.suggestedSkillId ?? "", detail: `PUENTE R5→R4 · ${conversion.stepCount} PASOS · ${conversion.occurrenceCount} OCURRENCIAS`,
        fingerprint: shortDigest(conversion.fingerprint), sha: shortDigest(conversion.candidateSha256 ?? ""),
        title: conversionTitle, description: conversionDescription, purpose: conversionPurpose, skill: conversionSkillId,
        reason: conversionReason, confirmed: conversionConfirmed, canSubmit: canConvert(),
      },
      footer: `ALMACÉN: ${store?.storagePath ?? "consultando…"} · ${store?.existed ? "EXISTENTE" : "NO CREADO"} · AUDITORÍA ${store?.auditHealthy ? "SALUDABLE" : "NO DISPONIBLE"} · VIGENTES ${store?.currentPatternCount ?? 0} · OBSOLETAS ${store?.staleDecisionCount ?? 0}`,
    };
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
        case "select": if (id) selectPattern(id); break;
        case "conversion": if (id) selectConversion(id); break;
        case "decision": if (id === "retain" || id === "dismiss") { action = id; confirmed = false; } break;
        case "confirm":
          if (id === "candidate") confirmed = checked === true;
          if (id === "conversion") conversionConfirmed = checked === true;
          break;
        case "edit":
          if (typeof value !== "string") break;
          switch (id) {
            case "title": title = value.slice(0, 120); break;
            case "purpose": purpose = value.slice(0, 600); break;
            case "skill": suggestedSkillId = value.slice(0, 128); break;
            case "reason": reason = value.slice(0, 600); break;
            case "conversionTitle": conversionTitle = value.slice(0, 120); break;
            case "conversionDescription": conversionDescription = value.slice(0, 600); break;
            case "conversionPurpose": conversionPurpose = value.slice(0, 600); break;
            case "conversionSkillId": conversionSkillId = value.slice(0, 128); break;
            case "conversionReason": conversionReason = value.slice(0, 600); break;
          }
          break;
        case "submit": void submitDecision(); break;
        case "convert": void convertToDraft(); break;
      }
      update();
    },
    dispose() { disposed = true; reply = undefined; },
  };
}
