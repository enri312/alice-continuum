import { invoke, isTauri } from "@tauri-apps/api/core";
import registryIcon from "../../../icons/governance-capability-registry.svg?url";
import permissionsIcon from "../../../icons/governance-permissions-gateway.svg?url";
import { startSerializedPolling } from "../shared/polling";
import { effectLabel, grantStateLabel, permissionModeLabel, resourceKindLabel, riskLabel } from "./display-labels";
import { createWebDevelopmentCapabilityRegistry, parseCapabilityRegistrySnapshot, summarizeCapabilityRegistry, type CapabilityDescriptor, type CapabilityDomain } from "./capabilities";
import {
  createCancelPermissionInput, createExecutePermissionInput, createForegroundControlPreparation, createPermissionDecisionInput,
  createRevokePermissionInput, parseContextObservationExecutionResult, parsePermissionGrant, parsePreparedPermissionRequest,
  type PermissionGrant, type PermissionRequestState, type PreparedPermissionRequest,
} from "./permissions";
import { acceptObservationExecution, acceptObservationRevocation, readObservationGateway } from "./observation-session";
import { parseGovernanceAction } from "./view-action";

const domainOrder: CapabilityDomain[] = ["cloud", "context", "perception", "memory", "avatar", "output", "task"];
const domainLabels: Record<CapabilityDomain, string> = {
  cloud: "NUBE",
  context: "CONTEXTO",
  perception: "PERCEPCIÓN",
  memory: "MEMORIA",
  avatar: "AVATAR",
  output: "SALIDAS",
  task: "TAREAS",
};
const domainGlyphs: Record<CapabilityDomain, string> = {
  cloud: "CLD",
  context: "CTX",
  perception: "SNS",
  memory: "MEM",
  avatar: "AVR",
  output: "OUT",
  task: "TSK",
};
const stateLabels: Record<CapabilityDescriptor["state"], string> = {
  unavailable: "NO DISPONIBLE",
  disabled: "DESACTIVADA",
  idle: "LISTA",
  active: "ACTIVA",
  degraded: "DEGRADADA",
  error: "ERROR",
};
const maturityLabels: Record<CapabilityDescriptor["maturity"], string> = {
  implemented: "IMPLEMENTADA",
  partial: "PARCIAL",
  planned: "PLANIFICADA",
};

const healthLabel: Record<CapabilityDescriptor["health"]["status"], string> = {
  unchecked: "Sin comprobar", healthy: "Saludable", degraded: "Degradada", unavailable: "No disponible", error: "Error",
};
const enforcerLabel: Record<CapabilityDescriptor["permission"]["enforcedBy"], string> = {
  native: "aplicación nativa", currentUi: "interfaz", operatingSystem: "sistema operativo", none: "ninguno",
};

const requestLabels: Record<PermissionRequestState, string> = {
  awaitingDecision: "ESPERA DECISIÓN", approved: "APROBADA", denied: "RECHAZADA", cancelled: "CANCELADA", expired: "EXPIRADA",
};
const formatTimestamp = (value: string) => new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export function createRegistryTransport(openAudit: (capability?: string) => void) {
  let send: ((value: unknown) => void) | undefined;
  let registry = createWebDevelopmentCapabilityRegistry().snapshot;
  let registryReady = false;
  let registryError = "";
  let gateway: Awaited<ReturnType<typeof readObservationGateway>> | null = null;
  let pending: PreparedPermissionRequest | null = null;
  let visible = false;
  let busy = "";
  let message = "";
  let error = "";
  let readError = "";
  let fresh = false;
  let stop: (() => void) | undefined;
  let disposed = false;
  const canDecide = () => Boolean(fresh && gateway?.policy.r2DecisionCommandsExposed);

  function publishRegistry() {
    const summary = summarizeCapabilityRegistry(registry);
    const groups = domainOrder.map(domain => ({
      id: domain, label: domainLabels[domain],
      capabilities: registry.capabilities.filter(item => item.domain === domain).map(item => ({
        id: item.id, label: item.label, description: item.description, state: item.state, glyph: domainGlyphs[domain],
        stateLabel: stateLabels[item.state], maturity: maturityLabels[item.maturity],
        fields: [
          ["ID", item.id], ["Madurez", maturityLabels[item.maturity]], ["Adaptador", item.adapter],
          ["Operaciones", item.operations.join(", ")], ["Riesgo", riskLabel[item.risk]],
          ["Permiso", `${permissionModeLabel[item.permission.mode]} · ${enforcerLabel[item.permission.enforcedBy]}`],
          ["Efectos", item.effects.map(effect => effectLabel[effect]).join(", ")], ["Salud", healthLabel[item.health.status]],
        ],
        health: item.health.summary, permission: item.permission.summary,
      })),
    })).filter(group => group.capabilities.length > 0);
    return send?.({
      type: "registry", groups, registryIcon, permissionsIcon, error: registryError,
      loading: isTauri() && !registryReady && !registryError,
      source: registryReady ? `lectura del ${formatTimestamp(registry.generatedAt)}` : isTauri() ? "lectura local" : "vista web",
      metrics: [
        ["TOTAL", "registradas", summary.total], ["DISPONIBLES", "listas o activas", summary.available],
        ["PLANIFICADAS", "sin adaptador", summary.planned], ["ERROR / DEGRADADA", "requieren revisión", summary.unhealthy],
      ].map(([label, detail, count]) => [label, registryReady ? String(count).padStart(2, "0") : "—", detail]),
    });
  }

  function publishPermissions() {
    const policy = gateway?.policy;
    const requests = (gateway?.requests ?? []).map(item => ({
      id: item.requestId, capability: item.capabilityId, detail: `${requestLabels[item.state]} · ${formatTimestamp(item.createdAt)}`,
      review: item.state === "awaitingDecision", label: riskLabel[item.risk],
    }));
    const grants = (gateway?.grants ?? []).map(item => ({
      id: item.grantId, capability: item.capabilityId, detail: `${grantStateLabel[item.state]} · vence ${formatTimestamp(item.expiresAt)}`,
      revoke: item.state === "approved" || item.state === "active",
      execute: item.state === "approved" && item.capabilityId === "context.foreground.control" ? item.mode === "session" ? "ACTIVAR" : "DETENER" : "",
      label: item.state === "approved" && item.capabilityId.startsWith("perception.") ? "GESTIONAR EN APRENDIZAJE" : permissionModeLabel[item.mode],
    }));
    const yes = (value?: boolean) => value === undefined ? "—" : value ? "SÍ" : "NO";
    send?.({
      type: "permissions", requests, grants, busy, failed: Boolean(error || readError), commands: canDecide(),
      execution: canDecide() && Boolean(policy?.r2ExecutionCommandsExposed), hasSnapshot: gateway !== null,
      detail: gateway ? `${requests.length} solicitudes · ${grants.length} permisos · lectura del ${formatTimestamp(gateway.generatedAt)}` : "",
      status: error || (!isTauri() ? "Los permisos se consultan en la aplicación de escritorio."
        : readError ? `No se pudo actualizar el estado de los permisos. ${readError}`
        : !fresh ? "Consultando los permisos locales…" : message || "Permisos locales actualizados."),
      policy: [
        ["DENEGACIÓN POR DEFECTO", yes(policy?.denyByDefault)], ["PERMISOS PERSISTENTES", yes(policy?.persistentGrants)],
        ["DECISIÓN R2", !policy ? "—" : policy.r2DecisionCommandsExposed ? "EXPUESTA" : "BLOQUEADA"],
        ["EJECUCIÓN R2", !policy ? "—" : policy.r2ExecutionCommandsExposed ? "PROTEGIDA" : "BLOQUEADA"],
      ],
      pending: pending && {
        id: pending.requestId, summary: pending.summary, warnings: pending.warnings, digest: pending.previewDigest,
        fields: [
          ["Capacidad", `${pending.capabilityId} v${pending.capabilityVersion}`], ["Operación", pending.operation], ["Propósito", pending.purpose],
          ["Recurso exacto", `${pending.resource.label} · ${resourceKindLabel[pending.resource.kind]} · ${pending.resource.stableId}`],
          ["Datos", pending.dataScopes.join(", ")], ["Efectos", pending.effects.map(effect => effectLabel[effect]).join(", ")],
          ["Riesgo / modo", `${riskLabel[pending.risk]} · ${permissionModeLabel[pending.mode]}`],
          ["Vencimiento de decisión", formatTimestamp(pending.decisionExpiresAt)],
          ["Huella de verificación", `${pending.previewDigest.slice(0, 15)}…${pending.previewDigest.slice(-8)}`],
        ],
      },
    });
  }

  function pollPermissions() {
    stop?.();
    stop = undefined;
    if (!visible || disposed || !isTauri()) return;
    stop = startSerializedPolling({
      intervalMs: 5_000, read: readObservationGateway,
      onValue(snapshot) {
        gateway = snapshot;
        fresh = true;
        readError = "";
        if (pending) pending = snapshot.requests.find(item => item.requestId === pending?.requestId && item.state === "awaitingDecision") ?? null;
        publishPermissions();
      },
      onError(cause) { fresh = false; readError = String(cause); publishPermissions(); },
    });
  }

  async function run(action: string, operation: () => Promise<void>) {
    stop?.();
    busy = action;
    error = "";
    publishPermissions();
    try {
      await operation();
    } catch (cause) {
      error = String(cause);
      if (["approve", "deny", "cancel"].includes(action)) pending = null;
    } finally {
      busy = "";
      publishPermissions();
      pollPermissions();
    }
  }

  async function prepare(enabled: boolean) {
    const purpose = enabled
      ? "Observar temporalmente los metadatos de la aplicación activa para aportar contexto local a Alice."
      : "Detener la observación de los metadatos de la aplicación activa.";
    pending = parsePreparedPermissionRequest(await invoke("prepare_permission_request", {
      input: createForegroundControlPreparation(`permission-${crypto.randomUUID()}`, purpose, enabled),
    }));
    message = "Solicitud preparada; todavía no se ejecutó ninguna capacidad.";
  }

  async function decide(request: PreparedPermissionRequest, action: "approve" | "deny" | "cancel") {
    if (action === "cancel") {
      parsePreparedPermissionRequest(await invoke("cancel_permission_request", { input: createCancelPermissionInput(request.requestId) }));
      message = "Solicitud cancelada.";
    } else {
      const result = await invoke<unknown>("decide_permission_request", { input: createPermissionDecisionInput(request, action) });
      if (result !== null) parsePermissionGrant(result);
      message = action === "approve" ? "Permiso aprobado. Podés ejecutar la operación cuando estés listo." : "Solicitud rechazada. No se concedió el permiso.";
    }
    pending = null;
  }

  async function updateGrant(grant: PermissionGrant, action: "execute" | "revoke") {
    if (action === "revoke") {
      const result = parsePermissionGrant(await invoke("revoke_permission_grant", { input: createRevokePermissionInput(grant.grantId) }));
      acceptObservationRevocation(result);
      message = grant.state === "active" ? "Permiso revocado y su sesión detenida." : "Permiso revocado antes de su ejecución.";
    } else {
      const result = parseContextObservationExecutionResult(await invoke("execute_context_observation_grant", { input: createExecutePermissionInput(grant.grantId) }));
      acceptObservationExecution(result);
      message = result.enabled ? "Observación de ventana activa durante la sesión autorizada." : "Observación detenida y contexto descartado.";
    }
  }

  return {
    dispatch(raw: string, reply: (value: unknown) => void) {
      const action = parseGovernanceAction(raw);
      if (!action || disposed) return;
      const { type, id } = action;
      if (type === "connect" && !send) {
        send = reply;
        publishRegistry();
        publishPermissions();
        if (isTauri()) void invoke("capability_registry_status").then(parseCapabilityRegistrySnapshot).then(snapshot => {
          registry = snapshot; registryReady = true; publishRegistry();
        }).catch(cause => { registryError = String(cause); publishRegistry(); });
        return;
      }
      if (type === "audit" && (!id || registry.capabilities.some(item => item.id === id))) openAudit(id || undefined);
      if (type === "section") {
        visible = id === "permissions";
        fresh = false;
        publishPermissions();
        if (!busy) pollPermissions();
      }
      if (!visible || busy || !isTauri()) return;
      if ((type === "approve" || type === "deny" || type === "cancel") && pending && pending.requestId === id) {
        const request = pending;
        if (type === "cancel" || canDecide()) void run(type, () => decide(request, type));
      } else if (type === "revoke" || type === "execute") {
        const grant = gateway?.grants.find(item => item.grantId === id);
        if (grant && ((type === "revoke" && (grant.state === "approved" || grant.state === "active"))
          || (type === "execute" && grant.state === "approved" && grant.capabilityId === "context.foreground.control" &&
            canDecide() && gateway?.policy.r2ExecutionCommandsExposed))) {
          void run(type, () => updateGrant(grant, type));
        }
      } else if (canDecide() && (type === "prepare-start" || type === "prepare-stop")) {
        void run(type, () => prepare(type === "prepare-start"));
      } else if (canDecide() && type === "review") {
        pending = gateway?.requests.find(item => item.requestId === id && item.state === "awaitingDecision") ?? null;
        publishPermissions();
      }
    },
    dispose() { disposed = true; send = undefined; stop?.(); },
  };
}
