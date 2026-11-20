import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Screen } from "../../../core/navigation/workspaces";
import { startSerializedPolling } from "../../../core/shared/polling";
import { activityCount, subscribeToActivity } from "../../../core/cognitive/activity-session";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import emblem from "../../../../icons/app-alice.svg?url";
import conversation from "../../../../icons/cognitive-conversation-channel.svg?url";
import planner from "../../../../icons/cognitive-action-planner.svg?url";
import memory from "../../../../icons/cognitive-memory-vault.svg?url";
import permissions from "../../../../icons/governance-permissions-gateway.svg?url";
import "../../../pages/dashboard/dashboard.css";

const assets = { emblem, conversation, planner, memory, permissions };
const destinations: readonly Screen[] = [
  "identificacion", "planificador", "memoria", "puentes", "actividad", "configuracion",
];

type Props = {
  desktopApp: boolean;
  assistant: { provider: string; memoryCount: number };
  onNavigate: (screen: Screen) => void;
};

// Root-shell adapter. Dashboard layout and actions are owned by Dioxus.
export function DashboardHost(props: Props) {
  const root = `alice-dashboard-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const callbacks = useRef(props);
  callbacks.current = props;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [reading, setReading] = useState<{ snapshot: unknown; failed: boolean }>({ snapshot: null, failed: false });
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const eventCount = useSyncExternalStore(subscribeToActivity, activityCount);
  const payload = JSON.stringify({ assistant: { ...props.assistant, eventCount }, desktopApp: props.desktopApp, assets, ...reading });
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({
      root, initial: latest.current,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadDashboardRuntime()),
      onStatus: setStatus,
      onAction: raw => {
        let action: { type?: unknown; value?: unknown } | null;
        try { action = JSON.parse(raw); } catch { return; }
        if (!action || typeof action.value !== "string") return;
        if (action.type === "navigate" && destinations.includes(action.value as Screen)) {
          callbacks.current.onNavigate(action.value as Screen);
        }
      },
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(payload); }, [payload]);

  useEffect(() => {
    if (!props.desktopApp || status !== "ready") return;
    let stop: (() => void) | undefined;
    const trackVisibility = () => {
      stop?.();
      stop = undefined;
      if (document.visibilityState === "hidden") return;
      stop = startSerializedPolling({
        intervalMs: 5000,
        read: () => invoke("system_overview"),
        onValue: snapshot => setReading({ snapshot, failed: false }),
        onError: () => setReading({ snapshot: null, failed: true }),
      });
    };
    document.addEventListener("visibilitychange", trackVisibility);
    trackVisibility();
    return () => {
      document.removeEventListener("visibilitychange", trackVisibility);
      stop?.();
    };
  }, [props.desktopApp, status]);

  return <div data-dashboard-renderer={status === "ready" ? "dioxus" : status}>
    <div id={root} hidden={status !== "ready"} />
    {status !== "ready" && <main className="alice-dashboard">
      {status === "loading" ? <p role="status">Preparando el Dashboard…</p> :
        <section role="alert">
          <h1>Dashboard no disponible</h1>
          <button className="dashboard-link" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar Dashboard</button>
          {" "}
          <button className="dashboard-link" type="button" onClick={() => props.onNavigate("identificacion")}>Abrir Conversación</button>
        </section>}
    </main>}
  </div>;
}
