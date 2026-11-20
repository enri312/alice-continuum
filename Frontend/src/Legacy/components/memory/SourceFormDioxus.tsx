import { useEffect, useId, useRef, useState } from "react";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";
import { canPreviewSources, parseSourceFormAction, type SourceFormAction, type SourceFormPayload } from "../../../components/memory/source-form-bridge";

type Props = SourceFormPayload & { onAction: (action: SourceFormAction) => void };

function SourceFormFallback(props: Props) {
  if (props.sources.length < 2) return <p>Se necesitan dos episodios recuperables para proponer una relación.</p>;
  return <fieldset disabled={props.busy} style={{ border: "1px solid #315366", padding: 16 }}>
    <legend>Elegir fuentes y copiar una cita literal de cada entrada</legend>
    {([0, 1] as const).map(index => <div key={index} style={{ marginBottom: 16 }}>
      <label>Experiencia {index + 1}<select aria-label={`Experiencia ${index + 1}`} value={props.selected[index]}
        onChange={event => props.onAction({ type: "selectSource", index, id: event.target.value })}>
        <option value="">Seleccionar episodio</option>
        {props.sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}
      </select></label>
      {props.sources.find(source => source.id === props.selected[index]) && <details>
        <summary>Leer entrada original {index + 1}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{props.sources.find(source => source.id === props.selected[index])?.entry}</pre>
      </details>}
      <label>Cita {index + 1}<textarea aria-label={`Cita ${index + 1}`} value={props.quotes[index]} maxLength={2048} rows={2}
        onChange={event => props.onAction({ type: "editQuote", index, quote: event.target.value })} /></label>
    </div>)}
    <button type="button" disabled={!canPreviewSources(props)} onClick={() => props.onAction({ type: "previewSources" })}>Revisar relación</button>
  </fieldset>;
}

export function SourceFormDioxus(props: Props) {
  const root = `alice-sources-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const payload: SourceFormPayload = { busy: props.busy, sources: props.sources, selected: props.selected, quotes: props.quotes };
  const serialized = JSON.stringify(payload);
  const latest = useRef({ payload, onAction: props.onAction, serialized });
  latest.current = { payload, onAction: props.onAction, serialized };
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const handleAction = (raw: string) => {
    const action = parseSourceFormAction(raw, latest.current.payload);
    if (action) latest.current.onAction(action);
  };
  useEffect(() => {
    setStatus("loading");
    const view = startStateControlsView({
      root, initial: latest.current.serialized,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadSourceFormRuntime()),
      onAction: handleAction, onStatus: setStatus,
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(serialized); }, [serialized]);
  return <div data-source-form-renderer={status === "ready" ? "dioxus" : "react"}>
    {status === "error" && <p role="status">Formulario de respaldo activo. <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar formulario</button></p>}
    {status !== "ready" && <SourceFormFallback {...props} onAction={action => handleAction(JSON.stringify(action))} />}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
