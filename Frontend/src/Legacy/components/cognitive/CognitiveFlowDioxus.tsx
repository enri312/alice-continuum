import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { BrainSnapshot } from "../../../core/cognitive/brain";
import type { CoreActivitySnapshot } from "../../../core/cognitive/core-activity";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import { buildActivityPayload } from "../../../components/cognitive/activity-payload";
import type { NucleusActivityStatus } from "../../pages/shared/nucleus-shared";

type Props = {
  snapshot: BrainSnapshot;
  activity: CoreActivitySnapshot | null;
  activityStatus: NucleusActivityStatus;
  selectedId: string;
  onSelect: (id: string) => void;
  fallback: ReactNode;
};

export function CognitiveFlowDioxus({ snapshot, activity, activityStatus, selectedId, onSelect, fallback }: Props) {
  const root = `alice-flow-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const payload = JSON.stringify({
    nodes: snapshot.flowNodes,
    links: activity?.links.map(({ id, signal }) => ({ id, signal })) ?? [],
    selectedId, hasActivity: snapshot.hasActivity,
    activity: buildActivityPayload(activity, activityStatus),
  });
  const current = useRef({ snapshot, onSelect });
  current.current = { snapshot, onSelect };
  const latest = useRef(payload); latest.current = payload;
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({
      root, initial: latest.current,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadFlowRuntime()),
      onAction: raw => {
        try {
          const action = JSON.parse(raw);
          if (action?.type === "select" && Object.keys(action).length === 2
            && current.current.snapshot.flowNodes.some(node => node.id === action.id)) {
            current.current.onSelect(action.id);
          }
        } catch { /* Reject malformed actions. */ }
      },
      onStatus: setStatus,
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(payload); }, [payload]);
  return <div data-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <div role="status">Vista de respaldo activa.
      <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
    </div>}
    {status !== "ready" && fallback}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
