import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NucleusPageProps } from "../shared/nucleus-shared";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import { startFlowPageTransport } from "../../../components/cognitive/flow-page-transport";
import "../../../components/documents/DocumentPreview.css";

const Recovery = lazy(() => import("./EvidenceFlowFallback").then(module => ({ default: module.EvidenceFlowFallback })));
function Preparing() {
  return <section className="neuro-panel nucleus-page" aria-labelledby="[02]-title">
    <h2 id="[02]-title">Flujo cognitivo</h2><p role="status">Preparando Flujo cognitivo…</p>
  </section>;
}

// App boundary only. Page content, selection, R3 validation and polling live in Rust.
export function Flujo(props: NucleusPageProps) {
  const root = `alice-flow-page-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const selection = useRef("flow-input");
  const nodeIds = useRef(props.snapshot.flowNodes.map(node => node.id));
  nodeIds.current = props.snapshot.flowNodes.map(node => node.id);
  const serialized = JSON.stringify({ type: "configure", desktopApp: props.desktopApp, selectedId: selection.current,
    base: { nodes: props.snapshot.flowNodes, persistentMemoryCount: props.snapshot.persistentMemoryCount } });
  const latest = useRef(serialized); latest.current = serialized;
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  useEffect(() => {
    const transport = startFlowPageTransport({ invoke, complete: response => view.update(JSON.stringify(response)),
      nodeIds: () => nodeIds.current, onSelect: id => { selection.current = id; } });
    const view = startStateControlsView({ root, initial: latest.current,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadFlowPageRuntime()),
      onAction: transport.accept, onStatus: next => { if (next === "error") transport.dispose(); setStatus(next); },
    });
    controller.current = view;
    return () => { controller.current = null; transport.dispose(); view.dispose(); };
  }, [root]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-flow-page-renderer={status === "ready" ? "dioxus" : status === "error" ? "react" : "loading"}>
    {status === "loading" && <Preparing />}
    {status === "error" && <Suspense fallback={<Preparing />}><Recovery {...props} initialSelectedId={selection.current} /></Suspense>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
