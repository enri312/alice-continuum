import { useCallback, useId } from "react";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { createEmbodimentTransport, type EmbodimentView } from "../../../core/embodiment/embodiment-transport";

const load = () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadEmbodimentRuntime());
const names = { face: "Rostro", body: "Cuerpo", avatar: "Avatar" };

export function EmbodimentHost({ view, desktopApp }: { view: EmbodimentView; desktopApp: boolean }) {
  const sceneId = `alice-avatar-scene-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const createTransport = useCallback(() => createEmbodimentTransport(view, sceneId), [view, sceneId]);
  return <DioxusRouteHost renderer={view} name={names[view]} load={load} createTransport={createTransport}
    configuration={JSON.stringify({ type: "configure", view, desktop: desktopApp, sceneId })} />;
}
