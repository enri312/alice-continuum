import { useEffect, useId, useRef, useState } from "react";
import { startStateControlsView, type StateControlsRuntime, type ViewStatus } from "./lifecycle";

export type RouteTransport = {
  dispatch: (raw: string, reply: (value: unknown) => void) => void;
  dispose?: () => void;
};
type Props = {
  renderer: string;
  name: string;
  configuration: string;
  load: () => Promise<StateControlsRuntime>;
  createTransport: () => RouteTransport;
};

export function DioxusRouteHost({ renderer, name, configuration, load, createTransport }: Props) {
  const root = `alice-${renderer}-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(configuration);
  latest.current = configuration;
  const mounted = useRef<ReturnType<typeof startStateControlsView> | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const transport = createTransport();
    const controller = startStateControlsView({
      root, initial: latest.current, load,
      onStatus(next) {
        if (next === "error") {
          active = false;
          transport.dispose?.();
        }
        setStatus(next);
      },
      onAction(raw) {
        if (active) transport.dispatch(raw, value => {
          if (active) controller.update(JSON.stringify(value));
        });
      },
    });
    mounted.current = controller;
    return () => {
      active = false;
      mounted.current = null;
      transport.dispose?.();
      controller.dispose();
    };
  }, [root, load, createTransport, attempt]);

  useEffect(() => { mounted.current?.update(configuration); }, [configuration]);

  return <div {...{ [`data-${renderer}-renderer`]: status === "ready" ? "dioxus" : status }}>
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando {name}…</p>}
    {status === "error" && <div className="native-audit-error" role="alert">
      <strong>{name.toUpperCase()} NO DISPONIBLE</strong>
      <button className="console-button" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
    </div>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
