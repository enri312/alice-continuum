import { useEffect, useId, useRef, useState } from "react";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import { parseRelationReview, type SavedRelationsPayload } from "../../../components/memory/saved-relations-bridge";

type Props = SavedRelationsPayload & { onReview: (id: string) => void };

// Recovery UI only. Backend decisions and confirmation remain in MemoryAssociations.
export function SavedRelationsFallback({ relations, busy, onReview }: Props) {
  return <>
    <h4>Relaciones guardadas</h4>
    {!relations.length && <p>No hay relaciones guardadas. No se crearon conexiones automáticas.</p>}
    {relations.map(relation => <article key={relation.id} style={{ borderTop: "1px solid #315366", padding: "14px 0" }}>
      <p>{relation.title}</p>
      <p>{relation.withdrawn ? "Retirada" : relation.sourcesCurrent ? "Vigente · confirmada por vos" : "No vigente · fuente cambiada o no recuperable"}</p>
      <button type="button" disabled={busy || (relation.withdrawn && !relation.sourcesCurrent)} onClick={() => onReview(relation.id)}>{relation.withdrawn ? "Restaurar relación" : "Retirar relación"}</button>
    </article>)}
  </>;
}

export function SavedRelationsDioxus(props: Props) {
  const root = `alice-relations-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const payload: SavedRelationsPayload = { busy: props.busy, relations: props.relations };
  const serialized = JSON.stringify(payload);
  const latest = useRef({ payload, onReview: props.onReview, serialized });
  latest.current = { payload, onReview: props.onReview, serialized };
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  useEffect(() => {
    setStatus("loading");
    const mounted = startStateControlsView({
      root, initial: latest.current.serialized,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadRelationsRuntime()),
      onAction: raw => {
        const id = parseRelationReview(raw, latest.current.payload);
        if (id !== null) latest.current.onReview(id);
      },
      onStatus: setStatus,
    });
    controller.current = mounted;
    return () => { controller.current = null; mounted.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-relations-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <p role="status">Lista de respaldo activa. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar lista</button></p>}
    {status !== "ready" && <SavedRelationsFallback {...props} />}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
