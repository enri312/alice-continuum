import { useEffect, useId, useRef, useState } from "react";
import type { CognitiveEvent } from "../../core/cognitive/cognitive-events";
import { startStateControlsView, type ViewStatus } from "./state-controls/lifecycle";
import { buildTimelinePayload, parseTimelineSelection } from "./timeline-bridge";

// Temporary app boundary. The timeline has one renderer and all its UI lives in Rust.
export function CognitiveTimeline({ events }: { events: CognitiveEvent[] }) {
  const root = `alice-timeline-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const selection = useRef("");
  const currentEvents = useRef(events); currentEvents.current = events;
  const serialized = JSON.stringify(buildTimelinePayload(events, selection.current));
  const latest = useRef(serialized); latest.current = serialized;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({ root, initial: latest.current,
      load: () => import("./state-controls/runtime").then(module => module.loadTimelineRuntime()),
      onStatus: setStatus,
      onAction: raw => { const id = parseTimelineSelection(raw, currentEvents.current); if (id !== null) selection.current = id; },
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-timeline-renderer={status === "ready" ? "dioxus" : status}>
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando línea temporal…</p>}
    {status === "error" && <div className="native-audit-error" role="alert">
      <strong>LÍNEA TEMPORAL NO DISPONIBLE</strong><span>Los eventos siguen en la sesión. Puedes reintentar esta vista.</span>
      <button className="console-button" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar línea temporal</button>
    </div>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
