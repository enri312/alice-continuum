import { useEffect, useId, useRef, useState } from "react";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import { parseConfirmationAction, type ConfirmationPayload, type ConfirmationAction } from "../../../components/memory/confirmation-bridge";

type Props = { pending: ConfirmationPayload; onConfirm: () => void; onCancel?: () => void };

function ConfirmationFallback({ pending, onAction }: { pending: ConfirmationPayload; onAction: (type: ConfirmationAction) => void }) {
  const create = pending.kind === "create";
  return <div role="region" aria-label={create ? "Confirmar relación revisada" : "Confirmar cambio de relación"}>
    {create ? <>
      <p>Las dos citas coinciden con las fuentes actuales. Revisá si realmente querés relacionar estas experiencias:</p>
      {pending.quotes.map((quote, index) => <blockquote key={index}>{quote}</blockquote>)}
    </> : <p>¿{pending.withdrawn ? "Restaurar" : "Retirar"} esta relación? No modifica recuerdos y conserva las revisiones anteriores.</p>}
    <button type="button" disabled={pending.busy} onClick={() => onAction("confirm")}>{create ? "Confirmar y guardar relación" : "Confirmar cambio"}</button>
    {!create && <button type="button" disabled={pending.busy} onClick={() => onAction("cancel")}>Cancelar</button>}
  </div>;
}

export function RelationConfirmationDioxus(props: Props) {
  const root = `alice-confirm-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const serialized = JSON.stringify(props.pending);
  const latest = useRef({ ...props, serialized }); latest.current = { ...props, serialized };
  const consumed = useRef<string | null>(null);
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const handleAction = (raw: string) => {
    const { pending, onConfirm, onCancel } = latest.current;
    const action = parseConfirmationAction(raw, pending);
    if (!action || consumed.current === pending.token) return;
    consumed.current = pending.token;
    if (action === "confirm") onConfirm(); else onCancel?.();
  };
  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({
      root, initial: latest.current.serialized,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadConfirmationRuntime()),
      onAction: handleAction, onStatus: setStatus,
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-confirmation-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <p role="status">Confirmación de respaldo activa. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar confirmación</button></p>}
    {status !== "ready" && <ConfirmationFallback pending={props.pending} onAction={type => handleAction(JSON.stringify({ type, token: props.pending.token }))} />}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
