import { effectLabel, grantStateLabel, permissionModeLabel, resourceKindLabel, riskLabel } from "../../core/governance/display-labels";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  createCancelPermissionInput,
  createExecutePermissionInput,
  createForegroundControlPreparation,
  createPermissionDecisionInput,
  createRevokePermissionInput,
  createWebDevelopmentPermissionGateway,
  parsePermissionGrant,
  parseContextObservationExecutionResult,
  parsePermissionGatewayStatus,
  parsePreparedPermissionRequest,
} from "../../core/governance/permissions";
import type {
  PermissionGatewayResult,
  PermissionGrant,
  PermissionRequestState,
  PreparedPermissionRequest,
} from "../../core/governance/permissions";

type GatewayAction = "prepare-start" | "prepare-stop" | "approve" | "deny" | "cancel" | "revoke" | "execute";

const requestStateLabels: Record<PermissionRequestState, string> = {
  awaitingDecision: "ESPERA DECISIÓN",
  approved: "APROBADA",
  denied: "RECHAZADA",
  cancelled: "CANCELADA",
  expired: "EXPIRADA",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function shortDigest(value: string) {
  return `${value.slice(0, 15)}…${value.slice(-8)}`;
}

export function PermissionGatewayPanel({ onObservationStateChange }: { onObservationStateChange: (enabled: boolean) => void }) {
  const nativeRuntime = isTauri();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [gateway, setGateway] = useState<PermissionGatewayResult>(() => createWebDevelopmentPermissionGateway());
  const [pending, setPending] = useState<PreparedPermissionRequest | null>(null);
  const [busy, setBusy] = useState<GatewayAction | null>(null);
  const [message, setMessage] = useState(nativeRuntime ? "Consultando los permisos locales…" : "El navegador no expone comandos nativos de permisos.");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!nativeRuntime) return;
    const snapshot = parsePermissionGatewayStatus(await invoke<unknown>("permission_gateway_status"));
    setGateway({ source: "native", snapshot });
    onObservationStateChange(snapshot.grants.some((grant) => grant.capabilityId === "context.foreground.control" && grant.mode === "session" && grant.state === "active"));
  }, [nativeRuntime, onObservationStateChange]);

  useEffect(() => {
    let active = true;
    refresh()
      .then(() => { if (active && nativeRuntime) setMessage("Permisos locales actualizados."); })
      .catch((reason) => {
        if (!active) return;
        setError(String(reason));
        setMessage("No se pudo consultar el control de permisos.");
      });
    return () => { active = false; };
  }, [refresh, nativeRuntime]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const run = useCallback(async (action: GatewayAction, operation: () => Promise<void>) => {
    setBusy(action);
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(String(reason));
      if (action === "approve" || action === "deny" || action === "cancel") setPending(null);
      try { await refresh(); } catch { /* Se conserva el error original de la acción. */ }
    } finally {
      setBusy(null);
    }
  }, [refresh, nativeRuntime]);

  const prepare = (enabled: boolean) => run(enabled ? "prepare-start" : "prepare-stop", async () => {
    const purpose = enabled
      ? "Observar temporalmente los metadatos de la aplicación activa para aportar contexto local a Alice."
      : "Detener la observación de los metadatos de la aplicación activa.";
    const idempotencyKey = `permission-${crypto.randomUUID()}`;
    const result = await invoke<unknown>("prepare_permission_request", {
      input: createForegroundControlPreparation(idempotencyKey, purpose, enabled),
    });
    const request = parsePreparedPermissionRequest(result);
    setPending(request);
    setMessage("Solicitud preparada; todavía no se ejecutó ninguna capacidad.");
    await refresh();
  });

  const decide = (decision: "approve" | "deny") => {
    if (!pending) return Promise.resolve();
    return run(decision, async () => {
      const result = await invoke<unknown | null>("decide_permission_request", {
        input: createPermissionDecisionInput(pending, decision),
      });
      if (result !== null) parsePermissionGrant(result);
      setPending(null);
      setMessage(decision === "approve"
        ? "Permiso aprobado. Podés ejecutar la operación cuando estés listo."
        : "Solicitud rechazada. No se concedió el permiso.");
      await refresh();
    });
  };

  const cancel = () => {
    if (!pending) return Promise.resolve();
    return run("cancel", async () => {
      parsePreparedPermissionRequest(await invoke<unknown>("cancel_permission_request", {
        input: createCancelPermissionInput(pending.requestId),
      }));
      setPending(null);
      setMessage("Solicitud cancelada.");
      await refresh();
    });
  };

  const revoke = (grant: PermissionGrant) => run("revoke", async () => {
    parsePermissionGrant(await invoke<unknown>("revoke_permission_grant", {
      input: createRevokePermissionInput(grant.grantId),
    }));
    if (grant.capabilityId === "context.foreground.control" && grant.mode === "session" && grant.state === "active") onObservationStateChange(false);
    setMessage(grant.state === "active" ? "Permiso revocado y su sesión detenida." : "Permiso revocado antes de su ejecución.");
    await refresh();
  });

  const execute = (grant: PermissionGrant) => run("execute", async () => {
    const result = parseContextObservationExecutionResult(await invoke<unknown>("execute_context_observation_grant", {
      input: createExecutePermissionInput(grant.grantId),
    }));
    onObservationStateChange(result.enabled);
    setMessage(result.enabled
      ? "Observación de ventana activa durante la sesión autorizada."
      : "Observación detenida y contexto descartado.");
    await refresh();
  });

  const requests = gateway.snapshot.requests;
  const grants = gateway.snapshot.grants;
  const commandsAvailable = nativeRuntime && gateway.snapshot.policy.r2DecisionCommandsExposed;

  return <section className="permission-gateway" aria-labelledby="permission-gateway-title">
    <header>
      <div><p className="eyebrow">R2 · AUTORIZACIONES LOCALES</p><h3 id="permission-gateway-title">Control de permisos</h3><p>Revisá el recurso y el plazo antes de autorizar una operación. Podés revocar un permiso desde esta pantalla.</p></div>
      <span className={commandsAvailable ? "is-native" : ""}><i />{commandsAvailable ? "CONTROL LOCAL" : "SOLO LECTURA"}</span>
    </header>

    <div className="permission-policy" aria-label="Política de permisos">
      <div><span>DENEGACIÓN POR DEFECTO</span><strong>{gateway.snapshot.policy.denyByDefault ? "SÍ" : "NO"}</strong></div>
      <div><span>PERMISOS PERSISTENTES</span><strong>{gateway.snapshot.policy.persistentGrants ? "SÍ" : "NO"}</strong></div>
      <div><span>DECISIÓN R2</span><strong>{gateway.snapshot.policy.r2DecisionCommandsExposed ? "EXPUESTA" : "BLOQUEADA"}</strong></div>
      <div><span>EJECUCIÓN R2</span><strong>{gateway.snapshot.policy.r2ExecutionCommandsExposed ? "PROTEGIDA" : "BLOQUEADA"}</strong></div>
    </div>

    <div className="permission-actions">
      <div><strong>Observación de la ventana activa</strong><small>Único perfil autorizado para preparación en R2 · metadatos de ventana · máximo 300 s</small></div>
      <button type="button" disabled={!commandsAvailable || busy !== null} onClick={() => prepare(true)}>{busy === "prepare-start" ? "PREPARANDO…" : "PREPARAR OBSERVACIÓN"}</button>
      <button type="button" disabled={!commandsAvailable || busy !== null} onClick={() => prepare(false)}>{busy === "prepare-stop" ? "PREPARANDO…" : "PREPARAR DETENCIÓN"}</button>
    </div>

    <div className="permission-status" aria-live="polite">
      <span>{error ? "ERR" : "R2"}</span><div><strong>{error || message}</strong><small>{requests.length} solicitudes · {grants.length} permisos · lectura del {formatTimestamp(gateway.snapshot.generatedAt)}</small></div>
    </div>

    <div className="permission-ledger">
      <section aria-labelledby="permission-requests-title">
        <header><strong id="permission-requests-title">SOLICITUDES</strong><span>{requests.length}</span></header>
        {requests.length === 0 ? <p>SIN SOLICITUDES REALES</p> : requests.map((request) => <article key={request.requestId}>
          <div><strong>{request.capabilityId}</strong><small>{requestStateLabels[request.state]} · {formatTimestamp(request.createdAt)}</small></div>
          {request.state === "awaitingDecision" ? <button type="button" disabled={busy !== null} onClick={() => setPending(request)}>REVISAR</button> : <span>{riskLabel[request.risk]}</span>}
        </article>)}
      </section>
      <section aria-labelledby="permission-grants-title">
        <header><strong id="permission-grants-title">PERMISOS TEMPORALES</strong><span>{grants.length}</span></header>
        {grants.length === 0 ? <p>SIN PERMISOS TEMPORALES</p> : grants.map((grant) => <article key={grant.grantId}>
          <div><strong>{grant.capabilityId}</strong><small>{grantStateLabel[grant.state]} · vence {formatTimestamp(grant.expiresAt)}</small></div>
          <div className="permission-grant-actions">
            {grant.state === "approved" && grant.capabilityId === "context.foreground.control" ? <button type="button" disabled={busy !== null} onClick={() => execute(grant)}>{grant.mode === "session" ? "ACTIVAR" : "DETENER"}</button> : null}
            {grant.state === "approved" && grant.capabilityId.startsWith("perception.") ? <span>GESTIONAR EN APRENDIZAJE</span> : null}
            {grant.state === "approved" || grant.state === "active" ? <button type="button" disabled={busy !== null} onClick={() => revoke(grant)}>REVOCAR</button> : <span>{permissionModeLabel[grant.mode]}</span>}
          </div>
        </article>)}
      </section>
    </div>

    <dialog ref={dialogRef} className="permission-dialog" aria-labelledby="permission-dialog-title" aria-describedby="permission-dialog-description" onCancel={(event) => { event.preventDefault(); void cancel(); }}>
      {pending ? <div>
        <header><span>[R2] CONFIRMACIÓN EXPLÍCITA</span><strong>NO EJECUTADO</strong></header>
        <h3 id="permission-dialog-title">¿Autorizar esta solicitud?</h3>
        <p id="permission-dialog-description">{pending.summary}</p>
        <dl>
          <div><dt>Capacidad</dt><dd>{pending.capabilityId} v{pending.capabilityVersion}</dd></div>
          <div><dt>Operación</dt><dd>{pending.operation}</dd></div>
          <div><dt>Propósito</dt><dd>{pending.purpose}</dd></div>
          <div><dt>Recurso exacto</dt><dd>{pending.resource.label} · {resourceKindLabel[pending.resource.kind]} · {pending.resource.stableId}</dd></div>
          <div><dt>Datos</dt><dd>{pending.dataScopes.join(", ")}</dd></div>
          <div><dt>Efectos</dt><dd>{pending.effects.map(effect => effectLabel[effect]).join(", ")}</dd></div>
          <div><dt>Riesgo / modo</dt><dd>{riskLabel[pending.risk]} · {permissionModeLabel[pending.mode]}</dd></div>
          <div><dt>Vencimiento de decisión</dt><dd>{formatTimestamp(pending.decisionExpiresAt)}</dd></div>
          <div><dt>Huella de verificación</dt><dd title={pending.previewDigest}>{shortDigest(pending.previewDigest)}</dd></div>
        </dl>
        {pending.warnings.length > 0 ? <div className="permission-warnings"><strong>ADVERTENCIAS</strong>{pending.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
        <p className="permission-dialog-note">Aprobar concede un permiso temporal. La ejecución requiere una acción posterior y un permiso vigente.</p>
        <footer>
          <button type="button" disabled={busy !== null} onClick={() => void cancel()}>CANCELAR</button>
          <button type="button" className="is-deny" autoFocus disabled={busy !== null} onClick={() => void decide("deny")}>RECHAZAR</button>
          <button type="button" className="is-approve" disabled={busy !== null} onClick={() => void decide("approve")}>APROBAR PERMISO</button>
        </footer>
      </div> : null}
    </dialog>
  </section>;
}
