import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { parseStateControlsAction, type StateControlsAction, type StateControlsPayload } from "./bridge";
import { startStateControlsView, type ViewStatus } from "./lifecycle";

export function StateControlsView({ payload, onAction, fallback }: {
  payload: StateControlsPayload; onAction: (action: StateControlsAction) => void; fallback: ReactNode;
}) {
  const root = `alice-state-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const latest = useRef({ payload, onAction });
  latest.current = { payload, onAction };
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const serialized = JSON.stringify(payload);

  useEffect(() => {
    setStatus("loading");
    const mounted = startStateControlsView({
      root, initial: JSON.stringify(latest.current.payload),
      load: () => import("./runtime").then(module => module.loadRuntime()),
      onStatus: setStatus,
      onAction: raw => {
        const action = parseStateControlsAction(raw, latest.current.payload);
        if (action) latest.current.onAction(action);
      },
    });
    controller.current = mounted;
    return () => { controller.current = null; mounted.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);

  return <div className="state-controls-host" data-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <div className="state-view-recovery" role="status">Vista de respaldo activa. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
    {status !== "ready" && fallback}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
