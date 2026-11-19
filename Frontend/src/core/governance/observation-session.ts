import { invoke, isTauri } from "@tauri-apps/api/core";
import { startSerializedPolling } from "../shared/polling";
import { parsePermissionGatewayStatus, type ContextObservationExecutionResult, type PermissionGatewayStatus, type PermissionGrant } from "./permissions";

type ForegroundContext = { windowTitle: string; processName: string };
type Grant = { id: string; expiresAt: number };
type Snapshot = {
  grant: Grant | null;
  revision: number;
  foregroundContext: ForegroundContext | null;
};
type Action =
  | { type: "grant"; revision?: number; grant: Grant | null; now: number }
  | { type: "sample"; revision: number; grant: Grant | null; context: ForegroundContext | null; now: number };

const listeners = new Set<() => void>();
let current: Snapshot = { grant: null, revision: 0, foregroundContext: null };
let update: ((raw: string) => string) | undefined;
let stopPolling: (() => void) | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function sameGrant(left: Grant | null, right: Grant | null) {
  return left?.id === right?.id && left?.expiresAt === right?.expiresAt;
}

function publish(next: Snapshot) {
  const newRevision = next.revision !== current.revision;
  if (!newRevision && next.foregroundContext?.processName === current.foregroundContext?.processName
    && next.foregroundContext?.windowTitle === current.foregroundContext?.windowTitle) return;

  current = next;
  if (newRevision) watchGrant();
  for (const listener of listeners) listener();
}

function dispatch(action: Action) {
  if (update) {
    publish(JSON.parse(update(JSON.stringify(action))) as Snapshot);
    return;
  }

  // Native permissions remain usable in the recovery view before WASM loads.
  if (action.revision !== undefined && action.revision !== current.revision) return;
  const grant = action.grant && action.now < action.grant.expiresAt ? action.grant : null;
  if (action.type === "sample" && grant && sameGrant(current.grant, grant)) {
    publish({ ...current, foregroundContext: action.context });
    return;
  }
  const replacement = action.type === "grant" ? grant : null;
  if (action.revision === undefined || !sameGrant(current.grant, replacement)) {
    publish({ grant: replacement, revision: current.revision + 1, foregroundContext: null });
  }
}

function setGrant(grant: Grant | null, revision?: number) {
  dispatch({ type: "grant", grant, revision, now: Date.now() });
}

function isForegroundGrant(grant: PermissionGrant) {
  return grant.capabilityId === "context.foreground.control" && grant.operation === "setContextObservationEnabled"
    && grant.mode === "session";
}

const fromGrant = (grant: PermissionGrant): Grant => ({ id: grant.grantId, expiresAt: Date.parse(grant.expiresAt) });

function activeGrant(snapshot: PermissionGatewayStatus) {
  const active = snapshot.grants.filter(grant => isForegroundGrant(grant) && grant.state === "active");
  return active.length === 1 ? fromGrant(active[0]!) : null;
}

async function readGateway() {
  return parsePermissionGatewayStatus(await invoke<unknown>("permission_gateway_status"));
}

// The permissions panel already queries this status. Reuse that read for discovery.
export async function readObservationGateway() {
  const revision = current.revision;
  try {
    const snapshot = await readGateway();
    setGrant(activeGrant(snapshot), revision);
    return snapshot;
  } catch (error) {
    setGrant(null, revision);
    throw error;
  }
}

export function acceptObservationExecution(result: ContextObservationExecutionResult) {
  if (isTauri()) setGrant(result.enabled ? fromGrant(result.grant) : null);
}

export function acceptObservationRevocation(grant: PermissionGrant) {
  if (isTauri() && isForegroundGrant(grant) && grant.state === "revoked"
    && (!current.grant || current.grant.id === grant.grantId)) setGrant(null);
}

function parseForegroundContext(value: unknown): ForegroundContext | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Object.keys(value).length !== 2
    || !("windowTitle" in value) || typeof value.windowTitle !== "string"
    || !("processName" in value) || typeof value.processName !== "string") {
    throw new Error("Metadatos de la ventana activa inválidos.");
  }
  return { windowTitle: value.windowTitle, processName: value.processName };
}

function watchGrant() {
  stopPolling?.();
  stopPolling = undefined;
  clearTimeout(expiryTimer);

  const { grant, revision } = current;
  if (!grant) return;
  const expiresAt = grant.expiresAt;

  function expireAtDeadline() {
    if (revision !== current.revision) return;
    const remaining = expiresAt - Date.now();
    if (remaining > 0) expiryTimer = setTimeout(expireAtDeadline, remaining);
    else setGrant(null, revision);
  }
  expiryTimer = setTimeout(expireAtDeadline, Math.max(0, expiresAt - Date.now()));
  stopPolling = startSerializedPolling({
    intervalMs: 2_000,
    read: async () => {
      if (Date.now() >= expiresAt) return { context: null, grant: null };
      const context = parseForegroundContext(await invoke<unknown>("get_foreground_context"));
      if (revision !== current.revision) return { context: null, grant: null };
      // Check the same grant after the native read before projecting its data.
      return { context, grant: activeGrant(await readGateway()) };
    },
    onValue: sample => dispatch({ type: "sample", revision, ...sample, now: Date.now() }),
    onError: () => setGrant(null, revision),
  });
}

export function connectObservationSession(apply: (raw: string) => string) {
  if (update) return;
  const initial = JSON.parse(apply(JSON.stringify({ type: "initialize", session: current, now: Date.now() }))) as Snapshot;
  update = apply;
  publish(initial);
}

export function subscribeToObservation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const observationSnapshot = () => current;
