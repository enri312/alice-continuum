import { initialScreen, type Screen, type NavigationRequest } from "./workspaces";

type AppSnapshot = { screen: Screen; request: NavigationRequest | null; auditCapability: string | null; sequence: number };
type Action =
  | { type: "initialize" | "navigate"; screen: Screen }
  | { type: "route"; screen: Screen; clearAudit: boolean }
  | { type: "openAudit"; capability: string | null }
  | { type: "clearAudit" };

const entry = initialScreen(new URLSearchParams(window.location.search), import.meta.env.VITE_ALICE_AVATAR_DIAGNOSTIC === "1");
let snapshot: AppSnapshot = { screen: entry, request: null, auditCapability: null, sequence: 0 };
let runtime: ((raw: string) => string) | undefined;
const queued: Action[] = [];
const listeners = new Set<() => void>();

export const appSnapshot = () => snapshot;
export function subscribeToApp(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: AppSnapshot) {
  if (next.screen === snapshot.screen && next.auditCapability === snapshot.auditCapability &&
      next.request?.id === snapshot.request?.id && next.sequence === snapshot.sequence) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function dispatch(action: Action) {
  if (runtime) {
    publish(JSON.parse(runtime(JSON.stringify(action))) as AppSnapshot);
    return;
  }
  queued.push(action);
  // The browser can switch the recovery screen even before WASM is available.
  if (action.type === "navigate") {
    const sequence = (snapshot.sequence + 1) >>> 0;
    publish({ ...snapshot, request: { id: sequence, screen: action.screen }, sequence });
  } else if (action.type === "route") {
    publish({ ...snapshot, screen: action.screen, request: null,
      auditCapability: action.clearAudit ? null : snapshot.auditCapability });
  }
}

export function connectApp(update: (raw: string) => string) {
  if (runtime === update) return;
  runtime = update;
  dispatch({ type: "initialize", screen: entry });
  for (const action of queued.splice(0)) dispatch(action);
}

export const navigate = (screen: Screen) => dispatch({ type: "navigate", screen });
export const acceptRoute = (screen: Screen, clearAudit: boolean) => dispatch({ type: "route", screen, clearAudit });
export const openAudit = (capability?: string) => dispatch({ type: "openAudit", capability: capability ?? null });
export const clearAudit = () => dispatch({ type: "clearAudit" });
