import { useCallback, useEffect, useId, useRef } from "react";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { affectPalette } from "../../../core/cognitive/affect";
import { memoryLayerLegend, memoryVisualStates } from "../../../core/cognitive/cognitive-volume";
import { illustrativeSignalRoutes } from "../../../core/cognitive/volume-signal-demo";
import { createVolumeTransport, type VolumeInputs } from "../../../core/cognitive/volume-transport";
import orbit from "../../../../icons/camera-orbit-control.svg?raw";
import pan from "../../../../icons/camera-pan-control.svg?raw";
import zoomIn from "../../../../icons/camera-zoom-in-control.svg?raw";
import zoomOut from "../../../../icons/camera-zoom-out-control.svg?raw";
import reset from "../../../../icons/camera-reset-control.svg?raw";

const load = () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadVolumePageRuntime());
const legends = {
  layers: memoryLayerLegend.map(item => ({ id: item.id, label: item.label, color: `rgb(${item.color.join(",")})` })),
  affects: affectPalette.map(({ id, label, color }) => ({ id, label, color })),
  states: memoryVisualStates.map(item => ({ id: item.id, label: item.label, color: `rgb(${item.color.join(",")})`, dash: item.dash.join(" ") })),
};
const demos = illustrativeSignalRoutes.map(({ id, label }) => ({ id, label }));

export function Volumen(inputs: VolumeInputs) {
  const canvasId = `alice-volume-canvas-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const latest = useRef(inputs);
  latest.current = inputs;
  const transport = useRef<ReturnType<typeof createVolumeTransport> | null>(null);
  const createTransport = useCallback(() => {
    const controller = createVolumeTransport(canvasId, () => latest.current);
    transport.current = controller;
    return controller;
  }, [canvasId]);
  const learningActivityKey = JSON.stringify(inputs.learningActivity);
  useEffect(() => { transport.current?.refreshSources(); }, [inputs.snapshot, inputs.learningReady, inputs.selfStudy, learningActivityKey]);
  return <DioxusRouteHost renderer="volume" name="Volumen cognitivo" load={load} createTransport={createTransport}
    configuration={JSON.stringify({ type: "configure", setup: { canvasId, legends, demos, icons: { orbit, pan, zoomIn, zoomOut, reset } } })} />;
}
