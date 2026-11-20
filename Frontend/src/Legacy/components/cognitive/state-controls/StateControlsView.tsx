import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type StateControlsAction, type StateControlsPayload } from "../../../../components/cognitive/state-controls/bridge";
import { startStateControlsView, type ViewStatus } from "../../../../components/cognitive/state-controls/lifecycle";
import { startStateControlsTransport } from "../../../../components/cognitive/state-controls/transport";

export function StateControlsView({ payload, desktopApp, persistentMemoryCount, getSelectedId, onAction, fallback }: {
  payload: StateControlsPayload; desktopApp: boolean; persistentMemoryCount: number;
  getSelectedId: () => string; onAction: (action: StateControlsAction) => void; fallback: () => ReactNode;
}) {
  const root = `alice-state-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const latest = useRef({ payload, onAction });
  latest.current = { payload, onAction };
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const serialized = JSON.stringify({ type: "configure", base: { ...payload, selectedId: getSelectedId() }, desktopApp, persistentMemoryCount });
  const latestConfiguration = useRef(serialized); latestConfiguration.current = serialized;

  useEffect(() => {
    setStatus("loading");
    const transport = startStateControlsTransport({ invoke, payload: () => latest.current.payload,
      onAction: action => latest.current.onAction(action), complete: response => mounted.update(JSON.stringify(response)) });
    const mounted = startStateControlsView({
      root, initial: latestConfiguration.current,
      load: () => import("../../../../components/cognitive/state-controls/runtime").then(module => module.loadRuntime()),
      onStatus: next => { if (next === "error") transport.dispose(); setStatus(next); },
      onAction: transport.accept,
    });
    controller.current = mounted;
    return () => { controller.current = null; transport.dispose(); mounted.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);

  return <div className="state-controls-host" data-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <div className="state-view-recovery" role="status">Vista de respaldo activa. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
    {status === "loading" && <p role="status">Preparando Estado y controles…</p>}
    {status === "error" && fallback()}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
