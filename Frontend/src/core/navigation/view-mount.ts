import { startStateControlsView, type StateControlsRuntime, type ViewStatus } from "../../components/cognitive/state-controls/lifecycle";

export type MountedView = { refresh: () => void; dispose: () => void };
export type Reply = (value: unknown) => void;
export type RouteTransport = {
  initial?: () => unknown;
  dispatch?: (raw: string, reply: Reply) => void;
  refresh?: () => void;
  ready?: () => void;
  dispose?: () => void;
};
export type RouteOptions = {
  renderer: string;
  name: string;
  load: () => Promise<StateControlsRuntime>;
  configuration?: () => unknown;
  createTransport?: (element: HTMLDivElement, reply: Reply) => RouteTransport;
  hostClass?: string;
  attribute?: string;
  loading?: string;
  errorTitle?: string;
  errorDetail?: string;
  retry?: string;
  recover?: (host: HTMLElement) => MountedView;
  alternate?: { label: string; open: () => void };
};

export function makeButton(label: string, onClick: () => void, className = "console-button") {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

let nextView = 0;

export function mountRoute(host: HTMLElement, options: RouteOptions): MountedView & { element: HTMLElement; isReady: () => boolean } {
  const wrapper = document.createElement("div");
  const notice = document.createElement("div");
  const target = document.createElement("div");
  const attribute = options.attribute ?? `data-${options.renderer}-renderer`;
  target.id = `alice-${options.renderer}-${++nextView}`;
  if (options.hostClass) wrapper.className = options.hostClass;
  wrapper.append(notice, target);
  // Nested Dioxus trees own their delegated events before they reach the frame.
  wrapper.addEventListener("click", event => event.stopPropagation());
  host.append(wrapper);
  let release: (() => void) | undefined;
  let refresh = () => {};
  let recovery: MountedView | undefined;
  let disposed = false;

  function show(status: ViewStatus) {
    wrapper.setAttribute(attribute, status === "ready" ? "dioxus" : status === "error" && options.recover ? "fallback" : status);
    notice.hidden = status === "ready";
    notice.replaceChildren();
    target.hidden = status !== "ready";
    if (status === "loading") {
      const message = document.createElement("p");
      message.className = "neuro-footnote";
      message.setAttribute("role", "status");
      message.textContent = options.loading ?? `Preparando ${options.name}…`;
      notice.append(message);
    } else if (status === "error") {
      const message = document.createElement("div");
      message.className = options.recover ? "state-view-recovery" : "native-audit-error";
      message.setAttribute("role", options.recover ? "status" : "alert");
      const title = document.createElement("strong");
      title.textContent = options.errorTitle ?? `${options.name.toUpperCase()} NO DISPONIBLE`;
      message.append(title);
      if (options.errorDetail) {
        const detail = document.createElement("span");
        detail.textContent = options.errorDetail;
        message.append(detail);
      }
      message.append(makeButton(options.retry ?? "Reintentar", start));
      if (options.alternate) message.append(makeButton(options.alternate.label, options.alternate.open));
      if (options.errorTitle !== "") notice.append(message);
      if (options.recover) {
        const recoveryHost = document.createElement("div");
        notice.append(recoveryHost);
        recovery = options.recover(recoveryHost);
      }
    }
  }

  function start() {
    if (disposed) return;
    release?.();
    recovery?.dispose();
    recovery = undefined;
    show("loading");
    let live = true;
    const reply: Reply = value => { if (live) controller.update(JSON.stringify(value)); };
    const transport = options.createTransport?.(target, reply);
    let payload = JSON.stringify(transport?.initial?.() ?? options.configuration?.());
    const controller = startStateControlsView({
      root: target.id, initial: payload, load: options.load,
      onStatus(status) {
        if (!live) return;
        if (status === "error") {
          live = false;
          transport?.dispose?.();
        }
        show(status);
        if (status === "ready") transport?.ready?.();
      },
      onAction(raw) {
        if (live) transport?.dispatch?.(raw, reply);
      },
    });
    release = () => {
      if (live) transport?.dispose?.();
      live = false;
      controller.dispose();
    };
    refresh = () => {
      if (!live) {
        recovery?.refresh();
        return;
      }
      if (options.configuration) {
        const next = JSON.stringify(options.configuration());
        if (next !== payload) {
          payload = next;
          controller.update(next);
        }
      }
      transport?.refresh?.();
    };
  }

  start();
  return {
    element: wrapper,
    isReady: () => wrapper.getAttribute(attribute) === "dioxus",
    refresh: () => refresh(),
    dispose() {
      disposed = true;
      release?.();
      recovery?.dispose();
      wrapper.remove();
    },
  };
}
