import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { activityEvents, clearActivity, subscribeToActivity } from "../../core/cognitive/activity-session";
import { buildActivityPagePayload, parseActivityAction, type ActivityRecovery } from "../../components/cognitive/activity-page-bridge";
import { startStateControlsView, type ViewStatus } from "../../components/cognitive/state-controls/lifecycle";

// Temporary root-app boundary. Rust owns the Activity page and its UI state.
export function Actividad() {
  const root = `alice-activity-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const recovery = useRef<ActivityRecovery | null>(null);
  const events = useSyncExternalStore(subscribeToActivity, activityEvents);
  const requestedView = useRef(new URLSearchParams(window.location.search).get("activityView") ?? "");
  const serialized = JSON.stringify(buildActivityPagePayload(events, requestedView.current, recovery.current));
  const latest = useRef(serialized); latest.current = serialized;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({ root, initial: latest.current,
      load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadActivityPageRuntime()),
      onStatus: setStatus,
      onAction: raw => {
        const events = activityEvents();
        const action = parseActivityAction(raw, events);
        if (action === "clear") clearActivity();
        else if (action) {
          recovery.current = action;
          // Keep retry state current even when no app event causes a React render.
          latest.current = JSON.stringify(buildActivityPagePayload(events, requestedView.current, action));
        }
      },
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-activity-renderer={status === "ready" ? "dioxus" : status}>
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando actividad cognitiva…</p>}
    {status === "error" && <div className="native-audit-error" role="alert">
      <strong>ACTIVIDAD NO DISPONIBLE</strong><span>Los eventos siguen en la sesión. Puedes reintentar esta vista.</span>
      <button className="console-button" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar actividad</button>
    </div>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
