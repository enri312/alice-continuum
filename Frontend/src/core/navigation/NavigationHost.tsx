import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { startStateControlsView, type ViewStatus } from "../../components/cognitive/state-controls/lifecycle";
import { workspaceScreens, type Screen } from "./workspaces";
import { activityCount, subscribeToActivity } from "../cognitive/activity-session";

export type NavigationRequest = { id: number; screen: Screen };

const routes = new Set<string>(["dashboard", ...Object.values(workspaceScreens).flat()]);

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && routes.has(value);
}

export function initialScreen(params: URLSearchParams, avatarDiagnostic: boolean): Screen {
  const screen = params.get("screen");
  if (screen === "puentes") {
    const bridge = params.get("bridgeView");
    if (bridge === "face") return "rostro";
    if (bridge === "body") return "cuerpo";
  }
  return isScreen(screen) ? screen : avatarDiagnostic ? "avatar" : "dashboard";
}

type Props = {
  screen: Screen;
  request: NavigationRequest | null;
  memories: number;
  onRoute: (screen: Screen, clearAudit: boolean) => void;
  children: ReactNode;
};

// Dioxus owns the selected route and the DOM of the frame. The root app renders
// its pages into the outlet while their remaining state is migrated separately.
export function NavigationHost({ screen, request, memories, onRoute, children }: Props) {
  const id = `alice-navigation-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef(onRoute);
  callbacks.current = onRoute;
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [outlet, setOutlet] = useState<HTMLElement | null>(null);
  const events = useSyncExternalStore(subscribeToActivity, activityCount);
  const payload = JSON.stringify({ initialScreen: screen, request, memories, events });
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    setStatus("loading");
    const select = (active: unknown, clearAudit: boolean) => {
      const target = container.current?.querySelector<HTMLElement>("#alice-page-outlet");
      if (!target || !isScreen(active) || target.dataset.route !== active) return;
      setOutlet(target);
      callbacks.current(active, clearAudit);
    };
    const view = startStateControlsView({
      root: id,
      initial: latest.current,
      load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadNavigationRuntime()),
      onStatus: value => {
        setStatus(value);
        if (value === "ready") {
          select(container.current?.querySelector<HTMLElement>("#alice-page-outlet")?.dataset.route, false);
        } else if (value === "error") {
          setOutlet(null);
        }
      },
      onAction: raw => {
        try {
          const event = JSON.parse(raw) as { type?: unknown; screen?: unknown; clearAudit?: unknown } | null;
          if (event?.type === "route") select(event.screen, event.clearAudit === true);
        } catch { /* The route bridge accepts only the closed screen catalog. */ }
      },
    });
    controller.current = view;
    return () => { controller.current = null; view.dispose(); };
  }, [id, attempt]);

  useEffect(() => { controller.current?.update(payload); }, [payload]);

  useLayoutEffect(() => {
    if (!outlet) return;
    // The pages may mount a separate Dioxus tree. Its delegated click IDs
    // belong to that tree and must not reach the outer navigation listeners.
    const isolate = (event: MouseEvent) => event.stopPropagation();
    outlet.addEventListener("click", isolate);
    return () => outlet.removeEventListener("click", isolate);
  }, [outlet]);

  // A failed shared WASM download leaves the requested page's own recovery
  // accessible and keeps its shell classes. The navigation retries separately.
  useEffect(() => {
    if (status === "error" && request) onRoute(request.screen, false);
  }, [status, request, onRoute]);

  const ready = status === "ready" && outlet?.dataset.route === screen;
  return <div data-navigation-renderer={status === "ready" ? "dioxus" : status}>
    <div id={id} ref={container} hidden={status !== "ready"} />
    {ready && createPortal(children, outlet)}
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando la navegación…</p>}
    {status === "error" && <div className={screen === "identificacion" ? "shell is-conversation" : screen === "nucleo" ? "shell is-volume" : "shell"}>
      <div className="native-audit-error" role="alert">
        <strong>Navegación no disponible</strong>
        <button type="button" className="console-button" onClick={() => setAttempt(value => value + 1)}>Reintentar navegación</button>
      </div>
      {children}
    </div>}
  </div>;
}
