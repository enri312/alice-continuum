import { invoke } from "@tauri-apps/api/core";
import { activityCount, activityEvents, clearActivity } from "../cognitive/activity-session";
import { affectPalette } from "../cognitive/affect";
import { memoryLayerLegend, memoryVisualStates } from "../cognitive/cognitive-volume";
import { illustrativeSignalRoutes } from "../cognitive/volume-signal-demo";
import { createVolumeTransport, type VolumeInputs } from "../cognitive/volume-transport";
import { behaviorKeyForControl, supportsConversationBehavior } from "../conversation/behavior-settings";
import { changeConversationBehavior, conversationSnapshot } from "../conversation/conversation-session";
import { createEmbodimentTransport, type EmbodimentView } from "../embodiment/embodiment-transport";
import { createPlannerTransport, localReminderMinimum } from "../governance/planner-transport";
import { createProcedureTransport } from "../governance/procedure-transport";
import { createRegistryTransport } from "../governance/registry-transport";
import { createSkillTransport } from "../governance/skill-transport";
import { createMemoryPageTransport } from "../memory/memory-page-transport";
import { startSerializedPolling } from "../shared/polling";
import { buildActivityPagePayload, parseActivityAction, type ActivityRecovery } from "../../components/cognitive/activity-page-bridge";
import { startFlowPageTransport } from "../../components/cognitive/flow-page-transport";
import { buildStateControlsPayload } from "../../components/cognitive/state-controls/bridge";
import { startStateControlsTransport } from "../../components/cognitive/state-controls/transport";
import { auditRoute } from "../../pages/cognitive/audit-route";
import { conversationRoute } from "../../pages/conversation/conversation-route";
import { settingsRoute } from "../../pages/governance/settings-route";
import { appSnapshot, navigate, openAudit } from "./app-session";
import { appData, brainSnapshot, desktopApp, refreshVolumeLearning } from "./app-sources";
import type { MountedView, RouteOptions } from "./view-mount";
import type { Screen } from "./workspaces";
import emblem from "../../../icons/app-alice.svg?url";
import conversation from "../../../icons/cognitive-conversation-channel.svg?url";
import planner from "../../../icons/cognitive-action-planner.svg?url";
import memory from "../../../icons/cognitive-memory-vault.svg?url";
import permissions from "../../../icons/governance-permissions-gateway.svg?url";
import orbit from "../../../icons/camera-orbit-control.svg?raw";
import pan from "../../../icons/camera-pan-control.svg?raw";
import zoomIn from "../../../icons/camera-zoom-in-control.svg?raw";
import zoomOut from "../../../icons/camera-zoom-out-control.svg?raw";
import reset from "../../../icons/camera-reset-control.svg?raw";
import "../../pages/dashboard/dashboard.css";
import "../../styles/task-registry.css";
import "../../styles/task-engine.css";
import "../../styles/memory-navigation.css";
import "../../styles/automatic-memory.css";

const runtime = () => import("../../components/cognitive/state-controls/runtime");
type Query = URLSearchParams;

function dashboard(): RouteOptions {
  const destinations = new Set<Screen>(["identificacion", "planificador", "memoria", "puentes", "actividad", "configuracion"]);
  let reading: { snapshot: unknown; failed: boolean } = { snapshot: null, failed: false };
  const configuration = () => {
    const { cloudStatus, cloudSelection } = conversationSnapshot();
    const { catalog } = appData();
    const provider = cloudStatus.providers.find(item => item.id === cloudSelection.provider)?.label ?? "Sin motor seleccionado";
    return {
      assistant: { provider, memoryCount: catalog.conversationalMemories.length, eventCount: activityCount() },
      desktopApp, assets: { emblem, conversation, planner, memory, permissions }, ...reading,
    };
  };
  return {
    renderer: "dashboard", name: "Dashboard", configuration, load: () => runtime().then(module => module.loadDashboardRuntime()),
    errorTitle: "Dashboard no disponible", retry: "Reintentar Dashboard",
    alternate: { label: "Abrir Conversación", open: () => navigate("identificacion") },
    createTransport(_element, reply) {
      let stop: (() => void) | undefined;
      function readVisible() {
        stop?.();
        stop = undefined;
        if (document.visibilityState === "hidden") return;
        stop = startSerializedPolling({
          intervalMs: 5_000, read: () => invoke("system_overview"),
          onValue(snapshot) { reading = { snapshot, failed: false }; reply(configuration()); },
          onError() { reading = { snapshot: null, failed: true }; reply(configuration()); },
        });
      }
      return {
        ready() {
          if (!desktopApp) return;
          document.addEventListener("visibilitychange", readVisible);
          readVisible();
        },
        dispose() { document.removeEventListener("visibilitychange", readVisible); stop?.(); },
        dispatch(raw) {
          try {
            const action = JSON.parse(raw);
            if (action?.type === "navigate" && destinations.has(action.value)) navigate(action.value);
          } catch { /* The dashboard accepts only known destinations. */ }
        },
      };
    },
  };
}

function activity(query: Query): RouteOptions {
  let recovery: ActivityRecovery | null = null;
  const view = query.get("activityView") ?? "";
  return {
    renderer: "activity", name: "Actividad", loading: "Preparando actividad cognitiva…",
    errorDetail: "Los eventos siguen en la sesión. Puedes reintentar esta vista.", retry: "Reintentar actividad",
    load: () => runtime().then(module => module.loadActivityPageRuntime()),
    configuration: () => buildActivityPagePayload(activityEvents(), view, recovery),
    createTransport: () => ({
      dispatch(raw) {
        const action = parseActivityAction(raw, activityEvents());
        if (action === "clear") clearActivity();
        else if (action) recovery = action;
      },
    }),
  };
}

function memoryRoute(query: Query): RouteOptions {
  const views = new Set(["learning", "records", "working", "profile", "review", "layers", "consolidate", "safety"]);
  const value = query.get("memoryView") ?? "";
  const view = views.has(value) ? value : "learning";
  return {
    renderer: "memory", name: "Memoria", load: () => runtime().then(module => module.loadMemoryPageRuntime()),
    configuration: () => ({ type: "configure", setup: { desktop: desktopApp, view } }),
    createTransport: createMemoryPageTransport,
  };
}

function governance(renderer: "registry" | "procedures" | "skills", name: string): RouteOptions {
  return {
    renderer, name, load: () => runtime().then(module => module.loadGovernanceRuntime()),
    configuration: () => ({ type: "configure", view: renderer, desktop: desktopApp }),
    createTransport() {
      if (renderer === "registry") return createRegistryTransport(openAudit);
      if (renderer === "procedures") return createProcedureTransport(desktopApp);
      return createSkillTransport(desktopApp);
    },
  };
}

function embodiment(view: EmbodimentView, name: string): RouteOptions {
  let sceneId = "";
  return {
    renderer: view, name, load: () => runtime().then(module => module.loadEmbodimentRuntime()),
    configuration: () => ({ type: "configure", view, desktop: desktopApp, sceneId }),
    createTransport(element) {
      sceneId = `${element.id}-scene`;
      return createEmbodimentTransport(view, sceneId);
    },
  };
}

function plannerRoute(): RouteOptions {
  const minimum = localReminderMinimum();
  return {
    renderer: "planner", name: "Planificador", load: () => runtime().then(module => module.loadPlannerPageRuntime()),
    configuration() {
      const { focus, persistentMemoryCount } = brainSnapshot();
      return { type: "configure", desktopApp, focus, persistentMemoryCount, minimum };
    },
    createTransport: createPlannerTransport,
  };
}

const legends = {
  layers: memoryLayerLegend.map(item => ({ id: item.id, label: item.label, color: `rgb(${item.color.join(",")})` })),
  affects: affectPalette.map(({ id, label, color }) => ({ id, label, color })),
  states: memoryVisualStates.map(item => ({ id: item.id, label: item.label, color: `rgb(${item.color.join(",")})`, dash: item.dash.join(" ") })),
};
const demos = illustrativeSignalRoutes.map(({ id, label }) => ({ id, label }));

function volumeInputs(): VolumeInputs {
  const { memory, learning } = appData();
  const { selfStudy, automaticMemory, selfStudySource, automaticSource, automaticPhase } = learning;
  const { memoryStatus, ownerProfile, ownerProfileError } = memory;
  return {
    snapshot: brainSnapshot(), desktopApp, selfStudy,
    learningReady: !desktopApp || (memoryStatus === "native" && ownerProfile !== null && automaticMemory !== null && selfStudy !== null),
    learningActivity: {
      native: desktopApp, selfStudyPhase: selfStudy?.phase ?? null, selfStudyLastError: selfStudy?.lastError ?? null,
      automaticPhase, automaticEnabled: automaticMemory?.enabled ?? null, selfStudySource, automaticSource,
      recordsStatus: memoryStatus === "error" || ownerProfileError ? "error" : memoryStatus === "native" && ownerProfile !== null ? "ready" : "loading",
      recordsError: ownerProfileError || (memoryStatus === "error" ? "No se pudieron leer los recuerdos guardados. Puedes reintentar la lectura." : ""),
    },
    onRefreshLearning: refreshVolumeLearning,
  };
}

function volume(): RouteOptions {
  let canvasId = "";
  return {
    renderer: "volume", name: "Volumen cognitivo", load: () => runtime().then(module => module.loadVolumePageRuntime()),
    configuration: () => ({ type: "configure", setup: { canvasId, legends, demos, icons: { orbit, pan, zoomIn, zoomOut, reset } } }),
    createTransport(element) {
      canvasId = `${element.id}-canvas`;
      const controller = createVolumeTransport(canvasId, volumeInputs);
      return { ...controller, refresh: () => controller.refreshSources() };
    },
  };
}

function flowInputs() {
  return { desktopApp, snapshot: brainSnapshot() };
}
function stateInputs() {
  const { behavior, cloudSelection, pending } = conversationSnapshot();
  return {
    ...flowInputs(),
    behavior: { settings: behavior, supported: desktopApp && supportsConversationBehavior(cloudSelection.provider), busy: pending, onChange: changeConversationBehavior },
  };
}

function recover(host: HTMLElement, view: "flow" | "state", selected: string, select: (id: string) => void): MountedView {
  let mounted: MountedView | undefined;
  let active = true;
  void import("./nucleus-recovery").then(module => {
    if (active) mounted = module.mountRecovery(host, view, view === "flow" ? flowInputs : stateInputs, selected, select);
  }).catch(() => {
    if (!active) return;
    host.textContent = "La vista de respaldo no pudo cargarse. Reintentá la navegación.";
    host.setAttribute("role", "alert");
  });
  return { refresh: () => mounted?.refresh(), dispose() { active = false; mounted?.dispose(); } };
}

function flow(): RouteOptions {
  let selected = "flow-input";
  const select = (id: string) => { selected = id; };
  return {
    renderer: "flow-page", name: "Flujo cognitivo", load: () => runtime().then(module => module.loadFlowPageRuntime()),
    configuration: () => ({ type: "configure", desktopApp, selectedId: selected,
      base: { nodes: brainSnapshot().flowNodes, persistentMemoryCount: brainSnapshot().persistentMemoryCount } }),
    createTransport(_element, reply) {
      const transport = startFlowPageTransport({
        invoke, complete: reply, nodeIds: () => brainSnapshot().flowNodes.map(node => node.id), onSelect: select,
      });
      return { dispatch: transport.accept, dispose: transport.dispose };
    },
    errorTitle: "", recover: host => recover(host, "flow", selected, select),
  };
}

function state(): RouteOptions {
  let selected = "state-curiosity";
  const select = (id: string) => { selected = id; };
  const payload = () => {
    const { snapshot, behavior } = stateInputs();
    return buildStateControlsPayload(snapshot, selected, behavior);
  };
  return {
    renderer: "state", name: "Estado y controles", hostClass: "state-controls-host", attribute: "data-renderer",
    load: () => runtime().then(module => module.loadRuntime()),
    configuration: () => ({ type: "configure", desktopApp, base: payload(), persistentMemoryCount: brainSnapshot().persistentMemoryCount }),
    createTransport(_element, reply) {
      const transport = startStateControlsTransport({
        invoke, complete: reply, payload,
        onAction(action) {
          select(action.id);
          if (action.type !== "changeBehavior") return;
          const key = behaviorKeyForControl(action.id);
          const { behavior } = stateInputs();
          if (key && behavior.supported && !behavior.busy) behavior.onChange(key, action.value);
        },
      });
      return { dispatch: transport.accept, dispose: transport.dispose };
    },
    errorTitle: "Vista de respaldo activa.", recover: host => recover(host, "state", selected, select),
  };
}

export function routeOptions(screen: Screen, query: Query): RouteOptions {
  switch (screen) {
    case "dashboard": return dashboard();
    case "identificacion": return conversationRoute;
    case "nucleo": return volume();
    case "flujo": return flow();
    case "estado": return state();
    case "planificador": return plannerRoute();
    case "memoria": return memoryRoute(query);
    case "actividad": return activity(query);
    case "auditoria": return auditRoute(query, () => appSnapshot().auditCapability);
    case "puentes": return governance("registry", "Capacidades y permisos");
    case "procedimientos": return governance("procedures", "Procedimientos");
    case "habilidades": return governance("skills", "Taller de habilidades");
    case "configuracion": return settingsRoute;
    case "rostro": return embodiment("face", "Rostro");
    case "cuerpo": return embodiment("body", "Cuerpo");
    case "avatar": return embodiment("avatar", "Avatar");
  }
}
