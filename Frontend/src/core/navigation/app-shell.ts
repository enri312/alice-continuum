import { activityCount, subscribeToActivity } from "../cognitive/activity-session";
import { subscribeToConversation } from "../conversation/conversation-session";
import { subscribeToObservation } from "../governance/observation-session";
import { startLearningSession, subscribeToLearning } from "../memory/learning-session";
import { startMemorySession, subscribeToMemory } from "../memory/memory-session";
import { startStateControlsView, type ViewStatus } from "../../components/cognitive/state-controls/lifecycle";
import { acceptRoute, appSnapshot, subscribeToApp } from "./app-session";
import { appData } from "./app-sources";
import { routeOptions } from "./routes";
import { makeButton, mountRoute, type RouteOptions } from "./view-mount";
import { isScreen, type Screen } from "./workspaces";

export function startApp(root: HTMLElement) {
  const query = new URLSearchParams(window.location.search);
  const frame = document.createElement("div");
  frame.id = "alice-app-frame";
  const loading = document.createElement("p");
  loading.className = "neuro-footnote";
  loading.setAttribute("role", "status");
  loading.textContent = "Preparando la navegación…";
  const fallback = document.createElement("div");
  const warning = document.createElement("div");
  warning.className = "native-audit-error";
  warning.setAttribute("role", "alert");
  const heading = document.createElement("strong");
  heading.textContent = "Navegación no disponible";
  warning.append(heading, makeButton("Reintentar navegación", startFrame));
  fallback.append(warning);
  root.replaceChildren(frame, loading, fallback);

  let mounted: { screen: Screen; options: RouteOptions; view: ReturnType<typeof mountRoute> } | undefined;
  let frameView: ReturnType<typeof startStateControlsView> | undefined;
  let state: ViewStatus;
  let latest = "";
  let queued = false;
  let active = true;
  function payload() {
    const { screen, request } = appSnapshot();
    return JSON.stringify({ initialScreen: screen, request, memories: appData().catalog.conversationalMemories.length, events: activityCount() });
  }

  function mountScreen(screen: Screen, outlet: HTMLElement) {
    if (mounted?.screen !== screen) {
      mounted?.view.dispose();
      const options = routeOptions(screen, query);
      mounted = { screen, options, view: mountRoute(outlet, options) };
    } else if (mounted.view.element.parentElement !== outlet) {
      if (outlet !== fallback && !mounted.view.isReady()) {
        mounted.view.dispose();
        mounted.view = mountRoute(outlet, mounted.options);
      } else outlet.append(mounted.view.element);
    }
  }

  function showFallback() {
    const { request, screen } = appSnapshot();
    const destination = request?.screen ?? screen;
    if (request) acceptRoute(destination, false);
    fallback.className = destination === "identificacion" ? "shell is-conversation" : destination === "nucleo" ? "shell is-volume" : "shell";
    mountScreen(destination, fallback);
  }

  function showScreen(value: unknown, clearAudit: boolean) {
    if (!isScreen(value)) return;
    const outlet = frame.querySelector<HTMLElement>("#alice-page-outlet");
    if (outlet?.dataset.route !== value) return;
    acceptRoute(value, clearAudit);
    mountScreen(value, outlet);
  }

  function startFrame() {
    if (!active) return;
    frameView?.dispose();
    state = "loading";
    root.dataset.navigationRenderer = "loading";
    frame.hidden = true;
    fallback.hidden = true;
    loading.hidden = false;
    latest = payload();
    frameView = startStateControlsView({
      root: frame.id, initial: latest,
      load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadNavigationRuntime()),
      onStatus(status) {
        state = status;
        root.dataset.navigationRenderer = status === "ready" ? "dioxus" : status;
        frame.hidden = status !== "ready";
        fallback.hidden = status !== "error";
        loading.hidden = status !== "loading";
        if (status === "ready") showScreen(frame.querySelector<HTMLElement>("#alice-page-outlet")?.dataset.route, false);
        if (status === "error") showFallback();
      },
      onAction(raw) {
        try {
          const action = JSON.parse(raw);
          if (action?.type === "route") showScreen(action.screen, action.clearAudit === true);
        } catch { /* The root accepts only known routes. */ }
      },
    });
  }

  function refresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!active) return;
      if (state === "error") showFallback();
      else {
        const next = payload();
        if (next !== latest) {
          latest = next;
          frameView?.update(latest);
        }
      }
      mounted?.view.refresh();
    });
  }

  const stops = [subscribeToActivity, subscribeToApp, subscribeToConversation, subscribeToObservation, subscribeToLearning, subscribeToMemory]
    .map(subscribe => subscribe(refresh));
  startMemorySession();
  const stopLearning = startLearningSession();
  startFrame();
  return () => {
    active = false;
    stops.forEach(stop => stop());
    stopLearning?.();
    mounted?.view.dispose();
    frameView?.dispose();
  };
}
