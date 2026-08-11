import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseCapabilityRegistrySnapshot, type CapabilityRegistrySnapshot } from "../core/capabilities";
import { parseProcedureDetectionSnapshot, type ProcedureDetectionSnapshot } from "../core/procedure-learning";
import {
  parseProcedureCandidateStoreSnapshot,
  parseProcedurePatternDecisionResult,
  type ProcedureCandidateStoreSnapshot,
  type ProcedurePatternDecision,
} from "../core/procedure-store";

function shortDigest(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function defaultSkillId(fingerprint: string) {
  return `local.alice.procedure-${fingerprint.slice(7, 19)}`;
}

export function Procedimientos({ desktopApp }: { desktopApp: boolean }) {
  const [registry, setRegistry] = useState<CapabilityRegistrySnapshot | null>(null);
  const [detection, setDetection] = useState<ProcedureDetectionSnapshot | null>(null);
  const [store, setStore] = useState<ProcedureCandidateStoreSnapshot | null>(null);
  const [selectedFingerprint, setSelectedFingerprint] = useState("");
  const [action, setAction] = useState<ProcedurePatternDecision>("retain");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [suggestedSkillId, setSuggestedSkillId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (knownRegistry?: CapabilityRegistrySnapshot) => {
    const activeRegistry = knownRegistry ?? parseCapabilityRegistrySnapshot(await invoke<unknown>("capability_registry_status"));
    const [rawDetection, rawStore] = await Promise.all([
      invoke<unknown>("procedure_detection_status"),
      invoke<unknown>("procedure_candidate_store_status"),
    ]);
    const nextDetection = parseProcedureDetectionSnapshot(rawDetection, activeRegistry);
    const nextStore = parseProcedureCandidateStoreSnapshot(rawStore);
    setRegistry(activeRegistry);
    setDetection(nextDetection);
    setStore(nextStore);
    return { nextDetection, nextStore };
  }, []);

  useEffect(() => {
    if (!desktopApp || !isTauri()) return;
    let cancelled = false;
    setBusy("Leyendo evidencia R3 y decisiones R5");
    refresh()
      .catch((reason) => !cancelled && setError(String(reason)))
      .finally(() => !cancelled && setBusy(""));
    return () => { cancelled = true; };
  }, [desktopApp, refresh]);

  const decidedFingerprints = useMemo(() => new Set(store?.decisions.map((decision) => decision.fingerprint) ?? []), [store]);
  const pendingPatterns = useMemo(() => detection?.patterns.filter((pattern) => !decidedFingerprints.has(pattern.fingerprint)) ?? [], [detection, decidedFingerprints]);
  const selected = pendingPatterns.find((pattern) => pattern.fingerprint === selectedFingerprint) ?? null;
  const canSubmit = Boolean(selected && confirmed && reason.trim().length >= 12 && (action === "dismiss" || (title.trim() && purpose.trim() && suggestedSkillId.trim())) && !busy);

  function selectPattern(fingerprint: string) {
    const pattern = pendingPatterns.find((candidate) => candidate.fingerprint === fingerprint);
    if (!pattern) return;
    setSelectedFingerprint(fingerprint);
    setAction("retain");
    setTitle(`Procedimiento observado de ${pattern.steps.length} pasos`);
    setPurpose(`Conservar como propuesta revisable el patrón repetido ${shortDigest(fingerprint)} sin habilitar su ejecución.`);
    setSuggestedSkillId(defaultSkillId(fingerprint));
    setReason("");
    setConfirmed(false);
    setError("");
    setNotice("");
  }

  async function submitDecision() {
    if (!selected || !canSubmit || !registry) return;
    setBusy("Registrando decisión inmutable");
    setError("");
    setNotice("");
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
      setSelectedFingerprint("");
      setReason("");
      setConfirmed(false);
      setNotice(`${result.decision.action === "retain" ? "Candidato conservado" : "Patrón descartado"}. Ejecución y borrador R4 permanecen en cero.`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy("");
    }
  }

  if (!desktopApp) return <section className="skills-page skills-unavailable">
    <span>R5 · GOBIERNO PROCEDIMENTAL</span><h2>Procedimientos observados</h2>
    <p>Esta pantalla requiere la aplicación de escritorio: las decisiones se verifican contra evidencia R3 real y se guardan localmente con SHA-256.</p>
  </section>;

  return <section className="skills-page procedures-page" aria-labelledby="procedures-title">
    <header className="skills-heading procedures-heading">
      <div><p className="eyebrow">[R5.3] AUDITED REPETITION · OWNER DECISION ONLY</p><h2 id="procedures-title">Procedimientos observados</h2><p>Alice puede detectar repeticiones auditadas; sólo vos decidís si conservarlas como candidatos o descartarlas.</p></div>
      <span className="skills-safety"><i />EJECUCIÓN 0 · BORRADOR R4 0</span>
    </header>

    <div className="skills-metrics">
      <div><span>EVENTOS R3</span><strong>{detection?.scannedEventCount ?? 0}</strong><small>evidencia visible</small></div>
      <div><span>EJECUCIONES ÚTILES</span><strong>{detection?.qualifyingExecutionCount ?? 0}</strong><small>productoras y exitosas</small></div>
      <div><span>PATRONES PENDIENTES</span><strong>{pendingPatterns.length}</strong><small>mínimo 3 repeticiones</small></div>
      <div><span>DECISIONES</span><strong>{store?.decisions.length ?? 0}</strong><small>propietario local</small></div>
    </div>

    {(busy || notice || error) && <div className={`skills-message ${error ? "is-error" : notice ? "is-success" : ""}`} role="status"><span>{busy ? "…" : error ? "ERR" : "OK"}</span><strong>{busy || error || notice}</strong></div>}

    <div className="skills-layout procedures-layout">
      <aside className="skills-library">
        <header><span>[01] PATRONES VIGENTES</span><strong>{pendingPatterns.length} PENDIENTES</strong></header>
        <section>
          {pendingPatterns.length ? pendingPatterns.map((pattern) => <button type="button" key={pattern.fingerprint} className={selectedFingerprint === pattern.fingerprint ? "selected" : ""} onClick={() => selectPattern(pattern.fingerprint)}>
            <strong>{pattern.steps.map((step) => step.operation).join(" → ")}</strong>
            <small>{pattern.occurrences.length} repeticiones · riesgo {pattern.declaredRisk} · {shortDigest(pattern.fingerprint)}</small>
          </button>) : <p>Sin patrones nuevos en la evidencia R3 vigente. No se crea información ficticia para llenar esta lista.</p>}
        </section>
        <header><span>[02] DECISIONES INMUTABLES</span><strong>{store?.decisions.length ?? 0} REGISTROS</strong></header>
        <section>
          {store?.decisions.length ? store.decisions.map((decision) => <article className="procedure-decision" key={decision.decisionId}>
            <strong>{decision.action === "retain" ? decision.title : "Patrón descartado"}</strong>
            <small>{decision.action.toUpperCase()} · {shortDigest(decision.fingerprint)}</small>
            {decision.candidateSha256 && <small>CANDIDATO {shortDigest(decision.candidateSha256)}</small>}
          </article>) : <p>El almacén aún no contiene decisiones.</p>}
        </section>
      </aside>

      <div className="skills-workbench">
        {!selected ? <div className="skills-empty"><span>R5</span><strong>{pendingPatterns.length ? "Seleccioná un patrón verificable" : "Todavía no hay un procedimiento para decidir"}</strong><p>La detección es pasiva: no persiste candidatos, no crea habilidades y no ejecuta acciones.</p></div> : <>
          <header className="skills-editor-heading"><div><span>{shortDigest(selected.fingerprint)}</span><strong>{selected.occurrences.length} OCURRENCIAS · {selected.steps.length} PASOS · RIESGO {selected.declaredRisk.toUpperCase()}</strong></div><em>EVIDENCIA R3 VIGENTE</em></header>
          <div className="procedure-steps">{selected.steps.map((step) => <article key={step.id}><span>{String(step.position).padStart(2, "0")}</span><div><strong>{step.operation}</strong><small>{step.capabilityId}</small></div></article>)}</div>
          <div className="procedure-choice" role="group" aria-label="Decisión sobre el patrón">
            <button type="button" className={action === "retain" ? "selected" : ""} onClick={() => setAction("retain")}><strong>CONSERVAR CANDIDATO</strong><small>Guarda propuesta cerrada y su SHA-256; no la ejecuta.</small></button>
            <button type="button" className={action === "dismiss" ? "selected dismiss" : "dismiss"} onClick={() => setAction("dismiss")}><strong>DESCARTAR PATRÓN</strong><small>Guarda sólo la decisión y digest del motivo.</small></button>
          </div>
          {action === "retain" && <div className="skills-editor">
            <label>TÍTULO<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>PROPÓSITO<textarea value={purpose} maxLength={600} onChange={(event) => setPurpose(event.target.value)} /></label>
            <label>ID SUGERIDO PARA UNA HABILIDAD FUTURA<input value={suggestedSkillId} maxLength={128} onChange={(event) => setSuggestedSkillId(event.target.value)} /></label>
          </div>}
          <section className="skills-governance procedure-confirmation">
            <header><span>[GOV] CONFIRMACIÓN DEL PROPIETARIO</span><strong>DECISIÓN IRREVERSIBLE PARA ESTE FINGERPRINT</strong></header>
            <label className="skills-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo que revisé el patrón, su riesgo y la acción elegida. Esto no habilita ejecución.</span></label>
            <label>MOTIVO (SE CONSERVA SÓLO SU SHA-256)<textarea value={reason} maxLength={600} placeholder="Mínimo 12 caracteres; el texto no queda almacenado." onChange={(event) => setReason(event.target.value)} /></label>
            <div className="skills-lifecycle-actions"><button type="button" className={action === "dismiss" ? "is-danger" : "is-warning"} disabled={!canSubmit} onClick={submitDecision}>Registrar {action === "retain" ? "candidato" : "descarte"}<small>Se vuelve a validar contra la evidencia R3 antes de escribir.</small></button></div>
          </section>
        </>}
      </div>
    </div>
    <footer className="procedures-footnote">ALMACÉN: {store?.storagePath ?? "consultando…"} · {store?.existed ? "EXISTENTE" : "NO CREADO"} · AUDITORÍA {detection?.auditHealthy ? "SALUDABLE" : "NO DISPONIBLE"}</footer>
  </section>;
}
