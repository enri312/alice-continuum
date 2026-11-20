import { invoke } from "@tauri-apps/api/core";
import type { BrainSnapshot } from "../cognitive/brain";
import { applyCoreActivitySnapshot, hasCoreActivitySignal, parseCoreActivitySnapshot, type CoreActivitySnapshot } from "../cognitive/core-activity";
import type { ConversationBehaviorKey, ConversationBehaviorSettings } from "../conversation/behavior-settings";
import { startSerializedPolling } from "../shared/polling";
import { mountFlowRecovery } from "../../pages/cognitive/flow-recovery";
import { mountStateRecovery } from "../../pages/cognitive/state-recovery";
import type { NucleusActivityStatus } from "../../components/cognitive/activity-payload";
import { attributes, element } from "./recovery-dom";
import type { MountedView } from "./view-mount";

export type RecoveryInputs = {
  snapshot: BrainSnapshot;
  desktopApp: boolean;
  behavior?: {
    settings: ConversationBehaviorSettings;
    supported: boolean;
    busy: boolean;
    onChange: (key: ConversationBehaviorKey, value: number) => void;
  };
};

export type RecoveryData = RecoveryInputs & {
  activity: CoreActivitySnapshot | null;
  activityStatus: NucleusActivityStatus;
};

const labels = {
  loading: "cargando señal R3", unavailable: "señal R3 no disponible", idle: "sin señal R3 reciente", ready: "señal R3 reciente",
};

export function updateNucleusHeader(section: HTMLElement, data: RecoveryData, code: string, title: string, description: string) {
  const { activity, activityStatus } = data;
  const view = activityStatus === "ready" && !hasCoreActivitySignal(activity) ? "idle" : activityStatus;
  const audit = activity ? activity.auditHealthy ? "healthy" : "degraded" : "unknown";
  const status = { "data-activity-state": view, role: "status", "aria-live": "polite", "aria-atomic": true, "aria-busy": view === "loading" };
  const titleId = `${code}-title`;
  const signal = activityStatus === "loading" ? "LEYENDO AUDITORÍA LOCAL…" : activityStatus === "unavailable" ? "SNAPSHOT NATIVO NO DISPONIBLE"
    : `${activity?.windowEventCount ?? 0} ${activity?.windowEventCount === 1 ? "EVENTO" : "EVENTOS"} / ${Math.round((activity?.windowMs ?? 0) / 60_000)} MIN · SEÑAL ${(activity?.overallSignal ?? 0).toFixed(3)} · ${activity?.auditHealthy ? "AUDITORÍA ÍNTEGRA" : "AUDITORÍA CON LÍNEAS INVÁLIDAS"}`;
  attributes(section, { "aria-labelledby": titleId, "data-activity-state": view });
  const heading = attributes(element("div", `neuro-heading nucleus-page-header is-${view}`,
    element("div", "", element("p", "eyebrow", `${code} · ESTADO VERIFICABLE`), attributes(element("h2", "", title), { id: titleId }),
      element("p", "nucleus-page-description", description)),
    attributes(element("span", `neuro-live ${view} is-${view}`, attributes(element("i"), { "aria-hidden": true }), labels[view]),
      { ...status, "data-signal-present": view === "ready" })),
    { "data-activity-state": view });
  const provenance = attributes(element("div", `core-activity-provenance ${activityStatus} is-${view} ${audit === "degraded" ? "degraded" : ""}`,
    element("strong", "", "R3 · ACTIVIDAD DERIVADA"), element("span", "", signal),
    element("small", "", `HEURÍSTICA ${activity?.method?.toUpperCase() ?? "R3-RECENCY-MOTOR-V2"} · NO ES EMOCIÓN NI CONCIENCIA`)),
    { ...status, "data-audit-state": audit });
  section.querySelector(".nucleus-page-header")?.remove();
  section.querySelector(".core-activity-provenance")?.remove();
  section.prepend(heading, provenance);
}

export function mountRecovery(
  host: HTMLElement, view: "flow" | "state", read: () => RecoveryInputs,
  selected: string, onSelect: (id: string) => void,
): MountedView {
  let activity: CoreActivitySnapshot | null = null;
  let activityStatus: RecoveryData["activityStatus"] = read().desktopApp ? "loading" : "unavailable";
  let source: BrainSnapshot | undefined;
  let projected: BrainSnapshot | undefined;
  const data = () => {
    const inputs = read();
    if (source !== inputs.snapshot || !projected) {
      source = inputs.snapshot;
      projected = applyCoreActivitySnapshot(source, activity);
    }
    return { ...inputs, snapshot: projected, activity, activityStatus };
  };
  const mount = view === "flow" ? mountFlowRecovery : mountStateRecovery;
  const mounted = mount(host, data, selected, onSelect);
  function update(next: CoreActivitySnapshot | null, status: RecoveryData["activityStatus"]) {
    activity = next;
    activityStatus = status;
    projected = undefined;
    mounted.refresh();
  }
  const stop = read().desktopApp ? startSerializedPolling({
    intervalMs: 5_000,
    read: async () => parseCoreActivitySnapshot(await invoke("core_activity_snapshot")),
    onValue: snapshot => update(snapshot, "ready"),
    onError: () => update(null, "unavailable"),
  }) : undefined;
  return { refresh: mounted.refresh, dispose() { stop?.(); mounted.dispose(); } };
}
