import {
  cognitiveMemoryRadius, cognitiveVolumeNodeColor, resolveCognitiveMemoryAppearance,
  type CognitiveVolumeGraph, type CognitiveVolumeNode,
} from "./cognitive-volume";
import { cortexPaths, neuralSeed } from "./neural-geometry";
import { volumeLearningScale } from "./volume-learning";
import { illustrativeSignalNodes, illustrativeSignalRoutes } from "./volume-signal-demo";

type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
type InteractionMode = "rotate" | "pan";
type ProjectedNode = { node: CognitiveVolumeNode; x: number; y: number; z: number; perspective: number; radius: number };
export type LearningArrival = { id: string; kind: "added" | "changed"; observedAt: number };

const initialCamera: Camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** Canvas drawing and native input handlers. The Dioxus view owns the DOM and its controls. */
export function mountVolumeScene(canvas: HTMLCanvasElement, initialGraph: CognitiveVolumeGraph, onPick: (id: string | null) => void, onZoom: (percent: number) => void) {
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  let camera = { ...initialCamera };
  let mode: InteractionMode = "rotate";
  let selectedId: string | null = null;
  let hoveredId: string | null = null;
  let automaticYaw = .08;
  let orbit = false;
  let animationClock = 0;
  let redraw = () => {};
  let hitsAtLastPaint: ProjectedNode[] = [];
  let demoActive = false;
  let motionPaused = false;
  let reduceMotion = false;
  let learningPulseActive = false;
  let animateSignals = false;
  let animatedRouteIds = new Set<string>();
  let graph = initialGraph;
  let growthScale = volumeLearningScale(graph.persistentNodeCount);
  let hasVisual = graph.nodes.length > 0;
  const arrivals = new Map<string, { at: number; kind: LearningArrival["kind"] }>();
  let neighbors = collectNeighbors(graph);
  function updateCamera() {
    onZoom(Math.round(camera.zoom * 100));
    redraw();
  }
  function changeZoom(factor: number) {
    camera.zoom = clamp(camera.zoom * factor, .55, 3.5);
    updateCamera();
  }
  function resetCamera() {
    camera = { ...initialCamera };
    automaticYaw = .08;
    updateCamera();
  }

  const drag = { active: false, pointerId: -1, x: 0, y: 0, originX: 0, originY: 0, mode: "rotate" as InteractionMode };
  let width = 1;
  let height = 1;
  let animationFrame = 0;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const hitTest = (clientX: number, clientY: number) => {
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    return [...hitsAtLastPaint]
      .sort((left, right) => right.z - left.z)
      .find((projected) => Math.hypot(projected.x - x, projected.y - y) <= Math.max(9, projected.radius + 5))?.node ?? null;
  };

  const pointerDown = (event: PointerEvent) => {
    if (!hasVisual || drag.active || (event.button !== 0 && event.button !== 1)) return;
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.x = drag.originX = event.clientX;
    drag.y = drag.originY = event.clientY;
    drag.mode = event.shiftKey || event.button === 1 ? "pan" : mode;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
    event.preventDefault();
  };
  const pointerMove = (event: PointerEvent) => {
    if (!drag.active) {
      const hit = hitTest(event.clientX, event.clientY);
      const nextId = hit?.id ?? null;
      if (hoveredId !== nextId) {
        hoveredId = nextId;
        canvas.classList.toggle("has-node-hover", Boolean(nextId));
        redraw();
      }
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.mode === "rotate") {
      camera.yaw += deltaX * .0065;
      camera.pitch = clamp(camera.pitch + deltaY * .0055, -.82, .82);
    } else {
      camera.panX = clamp(camera.panX + deltaX, -width * .46, width * .46);
      camera.panY = clamp(camera.panY + deltaY, -height * .42, height * .42);
    }
    redraw();
  };
  const pointerUp = (event: PointerEvent) => {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    const moved = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
    drag.active = false;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (moved <= 5 && event.button === 0) {
      onPick(hitTest(event.clientX, event.clientY)?.id ?? null);
    }
  };
  const pointerCancel = (event: PointerEvent) => {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.active = false;
    canvas.classList.remove("is-dragging");
    redraw();
  };
  const pointerLeave = () => {
    if (drag.active) return;
    hoveredId = null;
    canvas.classList.remove("has-node-hover");
    redraw();
  };
  const wheel = (event: WheelEvent) => {
    if (!hasVisual) return;
    camera.zoom = clamp(camera.zoom * Math.exp(-event.deltaY * .0012), .55, 3.5);
    updateCamera();
    event.preventDefault();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (!hasVisual) return;
    const panStep = event.shiftKey ? 24 : 0;
    if (event.key === "+" || event.key === "=") changeZoom(1.15);
    else if (event.key === "-" || event.key === "_") changeZoom(1 / 1.15);
    else if (event.key === "0") resetCamera();
    else if (event.key === "ArrowLeft") panStep ? camera.panX -= panStep : camera.yaw -= .09;
    else if (event.key === "ArrowRight") panStep ? camera.panX += panStep : camera.yaw += .09;
    else if (event.key === "ArrowUp") panStep ? camera.panY -= panStep : camera.pitch = clamp(camera.pitch - .08, -.82, .82);
    else if (event.key === "ArrowDown") panStep ? camera.panY += panStep : camera.pitch = clamp(camera.pitch + .08, -.82, .82);
    else return;
    updateCamera();
    event.preventDefault();
  };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerCancel);
  canvas.addEventListener("lostpointercapture", pointerCancel);
  canvas.addEventListener("pointerleave", pointerLeave);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", resetCamera);
  canvas.addEventListener("keydown", keyDown);
  const project = (node: {x:number;y:number;z:number}, automaticYaw: number) => {
    const yaw = automaticYaw + camera.yaw;
    const yawCosine = Math.cos(yaw);
    const yawSine = Math.sin(yaw);
    const x = node.x * growthScale;
    const y = node.y * growthScale;
    const z = node.z * growthScale;
    const yawX = x * yawCosine - z * yawSine;
    const yawZ = x * yawSine + z * yawCosine;
    const pitchCosine = Math.cos(camera.pitch);
    const pitchSine = Math.sin(camera.pitch);
    const rotatedY = y * pitchCosine - yawZ * pitchSine;
    const rotatedZ = y * pitchSine + yawZ * pitchCosine;
    const perspective = 3.4 / (3.4 - rotatedZ);
    return {
      x: width / 2 + camera.panX + yawX * Math.min(width * .39, height * .46) * perspective * camera.zoom,
      y: height / 2 + camera.panY + rotatedY * Math.min(width * .39, height * .46) * perspective * camera.zoom,
      z: rotatedZ,
      perspective,
    };
  };

  let previousTime = 0;
  let lastPaint = -Infinity;
  let envelopeKey = "";
  let envelopePaths: {path:Path2D;depth:number; points: {x:number;y:number;z:number}[]}[] = [];

  const draw = (time: number) => {
    const hasSignal = !motionPaused && !reduceMotion && (demoActive || learningPulseActive || animateSignals);
    const interval = !motionPaused && (hasSignal || orbit || drag.active) ? 32 : 250;
    if (!reduceMotion && time - lastPaint < interval) {
      animationFrame = window.requestAnimationFrame(draw); return;
    }
    lastPaint = time;
    context.clearRect(0, 0, width, height);
    if (!hasVisual) { hitsAtLastPaint = []; return; }
    const elapsed = previousTime ? Math.min(32, time - previousTime) : 0;
    previousTime = time;
    if (!motionPaused && !reduceMotion) animationClock += elapsed;
    const animationTime = animationClock;
    const focusId = selectedId ?? hoveredId;
    if (orbit && !reduceMotion && !motionPaused && !focusId && !drag.active) automaticYaw += elapsed * .000007;
    const projected = new Map(graph.nodes.map((node) => [node.id, project(node, automaticYaw)]));
    const spatial = new Map<string,{id:string;x:number;y:number}[]>();
    for (const [id, point] of projected) {
      const key = `${Math.floor(point.x / 96)}:${Math.floor(point.y / 96)}`;
      const bucket = spatial.get(key) ?? []; bucket.push({id,x:point.x,y:point.y}); spatial.set(key,bucket);
    }


    const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * .28);
    glow.addColorStop(0, "rgba(14,116,144,.12)");
    glow.addColorStop(1, "rgba(2,6,23,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    // The cortical envelope is a quiet visual scaffold, not extra neurons.
    context.save();
    context.lineWidth = .65;
    const nextEnvelopeKey = `${width}:${height}:${growthScale}:${automaticYaw}:${camera.yaw}:${camera.pitch}:${camera.zoom}:${camera.panX}:${camera.panY}`;
    if (envelopeKey !== nextEnvelopeKey) {
      envelopeKey = nextEnvelopeKey;
      envelopePaths = cortexPaths.map(points => {
        const projected = points.map(point => project(point, automaticYaw));
        const path = new Path2D();
        projected.forEach((point, step) => step ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
        return {path,depth:projected.reduce((sum,p)=>sum+p.z,0)/projected.length,points:projected};
      });
    }
    for (const {path,depth,points} of envelopePaths) {
      context.strokeStyle = `rgba(89,156,179,${.085 + (depth + .55) * .085})`;
      context.stroke(path);
      // A quiet dotted scaffold makes the bilateral volume legible. Its
      // points are geometry, not extra memories, measured neurons or signals.
      context.fillStyle = `rgba(121,188,207,${.13 + (depth + .55) * .12})`;
      context.beginPath();
      for (let index = 0; index < points.length; index += 4) {
        const point = points[index];
        context.moveTo(point.x + .85, point.y);
        context.arc(point.x, point.y, .85, 0, Math.PI * 2);
      }
      context.fill();
    }
    context.restore();

    context.globalCompositeOperation = "lighter";
    for (const edge of graph.edges) {
      const from = projected.get(edge.from);
      const to = projected.get(edge.to);
      if (!from || !to) continue;
      const related = !focusId || edge.from === focusId || edge.to === focusId;
      const baseAlpha = edge.kind === "coLearning" ? .36 : edge.kind === "retrieval" ? .48 : edge.kind === "association" ? .26 + edge.signal * .32 : .18 + edge.signal * .5;
      const alpha = baseAlpha * (related ? 1 : .13);
      context.lineWidth = (edge.kind === "retrieval" ? 1.2 : edge.kind === "association" ? 1 : .7 + edge.signal) * (related ? 1 : .72);
      context.strokeStyle = edge.kind === "coLearning" ? `rgba(100,225,191,${alpha})` : edge.kind === "retrieval" ? `rgba(224,242,254,${alpha})` : edge.kind === "association" ? `rgba(196,181,253,${alpha})` : `rgba(45,212,191,${alpha})`;
      const bend = (neuralSeed(edge.id, 18) - .5) * .18;
      const dx = to.x - from.x, dy = to.y - from.y;
      const controlX = (from.x + to.x) / 2 - dy * bend;
      const controlY = (from.y + to.y) / 2 + dx * bend;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(controlX, controlY, to.x, to.y);
      context.stroke();
      const recordedRouteIsCurrent = edge.kind !== "audit" || animatedRouteIds.has(edge.id.slice("audit:".length));
      if (animateSignals && !demoActive && !motionPaused && !reduceMotion && recordedRouteIsCurrent && edge.kind !== "association" && edge.kind !== "coLearning" && edge.signal > 0 && related) {
        const phase = (animationTime * (.0002 + edge.signal * .0002) + edge.evidenceCount * .07) % 1;
        context.fillStyle = edge.kind === "retrieval" ? "rgba(224,242,254,.9)" : "rgba(45,212,191,.82)";
        context.shadowColor = context.fillStyle;
        context.shadowBlur = 14;
        for (let packet = 0; packet < 2; packet++) {
          const position = (phase + packet / 2) % 1;
          context.beginPath();
          context.arc((1-position)**2*from.x+2*(1-position)*position*controlX+position**2*to.x, (1-position)**2*from.y+2*(1-position)*position*controlY+position**2*to.y, 3, 0, Math.PI * 2);
          context.fill();
        }
        context.shadowBlur = 0;
      }
    }

    context.globalCompositeOperation = "source-over";
    const ordered = graph.nodes
      .map((node) => ({ node, point: projected.get(node.id)! }))
      .sort((left, right) => left.point.z - right.point.z);
    const hits: ProjectedNode[] = [];
    for (const { node, point } of ordered) {
      const appearance = node.memory ? resolveCognitiveMemoryAppearance(node.memory) : null;
      const [red, green, blue] = appearance?.color ?? cognitiveVolumeNodeColor(node);
      const related = !focusId || node.id === focusId || neighbors.get(focusId)?.has(node.id) === true;
      const activityPulse = node.signal > 0 && node.processRegion !== "runtime" && related && animateSignals && !demoActive && !motionPaused && !reduceMotion ? .85 + Math.sin(animationTime * .004 + node.x * 5) * .15 : 1;
      const baseRadius = node.kind === "process" ? 4.6 + node.signal * 3.2 : cognitiveMemoryRadius(node.memory?.importance ?? null);
      const arrival = node.memory ? arrivals.get(node.memory.id) : undefined;
      const arrivalAge = arrival ? Date.now() - arrival.at : Infinity;
      const showArrival = arrivalAge < 6_000 && !reduceMotion && !motionPaused;
      const growth = arrival?.kind === "added" && showArrival ? .45 + .55 * clamp(arrivalAge / 1_400, 0, 1) : 1;
      const radius = clamp(baseRadius * point.perspective * Math.sqrt(camera.zoom) * growth, 2.1, 32);
      const selected = node.id === selectedId;
      const hovered = node.id === hoveredId;
      const stateAlpha = selected || hovered ? 1 : appearance?.opacity ?? .95;
      const alpha = stateAlpha * (related ? 1 : .24);
      context.shadowColor = `rgba(${red},${green},${blue},.82)`;
      context.shadowBlur = showArrival ? 24 : selected || hovered ? 18 : node.signal > 0 ? 14 * activityPulse : 4;
      // Dendritic glyphs belong to this record alone. Branch tips stop
      // before the next soma; only graph.edges can connect two memories.
      if (node.memory) {
        let clearance = radius * 4.8;
        const cellX=Math.floor(point.x/96), cellY=Math.floor(point.y/96), reach=Math.ceil(clearance/96);
        for(let dx=-reach;dx<=reach;dx++) for(let dy=-reach;dy<=reach;dy++) {
          for(const other of spatial.get(`${cellX+dx}:${cellY+dy}`) ?? []) {
            if(other.id!==node.id) clearance=Math.min(clearance,Math.hypot(other.x-point.x,other.y-point.y)*.4);
          }
        }
        context.shadowBlur = selected || hovered ? 10 : 4;
        for (let branch = 0; branch < 7; branch++) {
          const seed = neuralSeed(node.id, branch * 17);
          const angle = branch * Math.PI * 2 / 7 + seed * .8;
          const reach = Math.min(clearance, radius * (2.8 + seed * 1.7));
          if (reach < radius * 1.5) continue;
          const bend = (seed - .5) * .7;
          const fork = {x:point.x+Math.cos(angle+bend)*reach*.68, y:point.y+Math.sin(angle+bend)*reach*.68};
          const tip = {x:point.x+Math.cos(angle)*reach, y:point.y+Math.sin(angle)*reach};
          const gradient = context.createLinearGradient(point.x, point.y, tip.x, tip.y);
          gradient.addColorStop(0, `rgba(${red},${green},${blue},${alpha * .85})`);
          gradient.addColorStop(1, `rgba(${red},${green},${blue},${alpha * .08})`);
          context.strokeStyle = gradient;
          context.lineWidth = Math.max(.7, radius * .13);
          context.beginPath(); context.moveTo(point.x,point.y);
          context.quadraticCurveTo(fork.x, fork.y, tip.x, tip.y); context.stroke();
          context.lineWidth = .65;
          for (const side of [-1,1]) {
            const daughterAngle = angle + side * (.5 + seed * .45);
            context.beginPath(); context.moveTo(fork.x,fork.y);
            context.quadraticCurveTo(fork.x+Math.cos(daughterAngle)*reach*.16, fork.y+Math.sin(daughterAngle)*reach*.16,
              fork.x+Math.cos(daughterAngle)*reach*.36, fork.y+Math.sin(daughterAngle)*reach*.36);
            context.stroke();
          }
        }
      }
      const core = context.createRadialGradient(point.x - radius * .32, point.y - radius * .38, .4, point.x, point.y, Math.max(radius * 1.35, 3));
      core.addColorStop(0, `rgba(227,255,249,${Math.min(1, alpha + .15)})`);
      core.addColorStop(.4, `rgba(${red},${green},${blue},${alpha})`);
      core.addColorStop(1, `rgba(${Math.round(red * .22)},${Math.round(green * .22)},${Math.round(blue * .22)},${alpha})`);
      context.fillStyle = core;
      context.beginPath();
      if (node.kind === "process") {
        context.moveTo(point.x, point.y - radius * 1.25);
        context.lineTo(point.x + radius * 1.05, point.y);
        context.lineTo(point.x, point.y + radius * 1.25);
        context.lineTo(point.x - radius * 1.05, point.y);
        context.closePath();
      } else {
        const phase = neuralSeed(node.id, 9) * Math.PI * 2;
        for (let step = 0; step <= 36; step++) {
          const angle = step * Math.PI / 18;
          const membrane = radius * (.76 + .1 * Math.sin(angle * 3 + phase) + .05 * Math.cos(angle * 5 - phase));
          const x = point.x + Math.cos(angle) * membrane;
          const y = point.y + Math.sin(angle) * membrane;
          if (step) context.lineTo(x,y); else context.moveTo(x,y);
        }
        context.closePath();
      }
      context.fill();
      context.shadowBlur = 0;

      context.strokeStyle = `rgba(${red},${green},${blue},${Math.max(.16, alpha * .62)})`;
      context.lineWidth = selected || hovered ? 1.2 : .65;
      context.beginPath();
      if (node.kind === "process") {
        context.moveTo(point.x, point.y - radius * .7);
        context.lineTo(point.x + radius * .58, point.y);
        context.lineTo(point.x, point.y + radius * .7);
        context.lineTo(point.x - radius * .58, point.y);
        context.closePath();
      } else {
        const phase=neuralSeed(node.id,9)*Math.PI*2;
        for(let step=0;step<=36;step++) {
          const angle=step*Math.PI/18, membrane=radius*(.78+.1*Math.sin(angle*3+phase)+.05*Math.cos(angle*5-phase));
          const x=point.x+Math.cos(angle)*membrane,y=point.y+Math.sin(angle)*membrane;
          if(step)context.lineTo(x,y);else context.moveTo(x,y);
        }
        context.closePath();
      }
      context.stroke();

      const stateMarker = appearance?.states[0];
      if (stateMarker) {
        context.save();
        context.strokeStyle = `rgba(${stateMarker.color.join(",")},${related ? .88 : .24})`;
        context.lineWidth = 1.2;
        context.setLineDash([...stateMarker.dash]);
        context.beginPath();
        context.arc(point.x, point.y, radius + 3.5, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
      if (node.memory?.retrieved || selected || hovered) {
        context.strokeStyle = "rgba(224,242,254,.88)";
        context.lineWidth = selected ? 1.4 : hovered ? 1.1 : .8;
        context.beginPath();
        context.arc(point.x, point.y, radius + (selected ? 7.5 : 6), 0, Math.PI * 2);
        context.stroke();
      }

      if (selected || hovered) {
        const title = node.label.slice(0, 34).toUpperCase();
        context.font = "700 10px Consolas, monospace";
        const labelWidth = Math.min(220, context.measureText(title).width + 16);
        const placeLeft = point.x + radius + 16 + labelWidth > width - 10;
        const labelX = placeLeft ? point.x - radius - 16 - labelWidth : point.x + radius + 16;
        const labelY = point.y - (selected ? 18 : 9);
        context.strokeStyle = `rgba(${red},${green},${blue},.52)`;
        context.lineWidth = .8;
        context.beginPath();
        context.moveTo(point.x + (placeLeft ? -radius - 3 : radius + 3), point.y);
        context.lineTo(placeLeft ? labelX + labelWidth : labelX, point.y);
        context.stroke();
        context.fillStyle = "rgba(3,10,19,.9)";
        context.fillRect(labelX, labelY, labelWidth, selected ? 34 : 19);
        context.strokeStyle = `rgba(${red},${green},${blue},.36)`;
        context.strokeRect(labelX + .5, labelY + .5, labelWidth - 1, (selected ? 34 : 19) - 1);
        context.fillStyle = "rgba(224,242,254,.94)";
        context.fillText(title, labelX + 8, labelY + 12, labelWidth - 16);
        if (selected) {
          context.font = "500 8px Consolas, monospace";
          context.fillStyle = "rgba(100,116,139,.94)";
          context.fillText(node.detail.slice(0, 46), labelX + 8, labelY + 26, labelWidth - 16);
        }
      }
      hits.push({ node, ...point, radius });
    }
    if (demoActive) {
      // Explicitly illustrative stations. Never add them to graph.nodes/hits,
      // memory counters, associations, audit records or retrieval context.
      context.save();
      const stations = new Map(illustrativeSignalNodes.map(node => [node.id, { ...node, point: project(node, automaticYaw) }]));
      illustrativeSignalRoutes.forEach((route, index) => {
        const from = stations.get(route.from)!.point;
        const to = stations.get(route.to)!.point;
        const bendX = (from.x + to.x) / 2;
        const bendY = (from.y + to.y) / 2 - 24;
        context.lineWidth = 1.3;
        context.strokeStyle = "rgba(251,191,36,.65)";
        context.setLineDash([5, 6]);
        context.beginPath(); context.moveTo(from.x, from.y);
        context.quadraticCurveTo(bendX, bendY, to.x, to.y); context.stroke();
        context.setLineDash([]);
        const phase = (animationTime * .00024 + index * .17) % 1;
        const x = (1-phase)**2*from.x + 2*(1-phase)*phase*bendX + phase**2*to.x;
        const y = (1-phase)**2*from.y + 2*(1-phase)*phase*bendY + phase**2*to.y;
        context.shadowColor = "#fbbf24"; context.shadowBlur = 18;
        context.fillStyle = "#fde68a";
        context.beginPath(); context.arc(x, y, 3.5, 0, Math.PI * 2); context.fill();
      });
      context.shadowBlur = 0;
      for (const station of stations.values()) {
        const point = station.point;
        context.fillStyle = "#121b28"; context.strokeStyle = "#fbbf24"; context.lineWidth = 1.4;
        context.beginPath(); context.arc(point.x, point.y, 10, 0, Math.PI * 2); context.fill(); context.stroke();
        context.fillStyle = "#fbbf24";
        context.beginPath(); context.arc(point.x, point.y, 3.5, 0, Math.PI * 2); context.fill();
        context.font = "600 11px 'Segoe UI', sans-serif";
        const labelWidth = context.measureText(station.label).width + 14;
        const labelOffsets = {
          permission: [-labelWidth - 14, -25], perception: [-labelWidth - 14, 8],
          memory: [14, -33], language: [-labelWidth / 2, 18],
          workspace: [14, -7], output: [14, 18],
        };
        const [offsetX, offsetY] = labelOffsets[station.id];
        const labelX = clamp(point.x + offsetX, 4, Math.max(4, width - labelWidth - 4));
        const labelY = clamp(point.y + offsetY, 18, height - 26);
        context.strokeStyle = "rgba(251,191,36,.35)"; context.lineWidth = .7;
        context.beginPath(); context.moveTo(point.x, point.y);
        context.lineTo(clamp(point.x, labelX, labelX + labelWidth), clamp(point.y, labelY, labelY + 20)); context.stroke();
        context.fillStyle = "rgba(12,18,29,.96)"; context.fillRect(labelX, labelY, labelWidth, 20);
        context.fillStyle = "#fde68a"; context.fillText(station.label, labelX + 7, labelY + 14);
      }
      context.restore();
    }
    hitsAtLastPaint = hits;
    if (!reduceMotion && (hasSignal || (orbit && !motionPaused) || drag.active)) animationFrame = window.requestAnimationFrame(draw);
  };
  redraw = () => {
    window.cancelAnimationFrame(animationFrame);
    lastPaint = -Infinity;
    draw(performance.now());
  };
  resize();

  return {
    dispose() {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      redraw = () => undefined;
      hitsAtLastPaint = [];
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("lostpointercapture", pointerCancel);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", resetCamera);
      canvas.removeEventListener("keydown", keyDown);
    },
    setGraph(next: CognitiveVolumeGraph) {
      graph = next;
      growthScale = volumeLearningScale(graph.persistentNodeCount);
      hasVisual = graph.nodes.length > 0 || demoActive;
      neighbors = collectNeighbors(graph);
      if (hoveredId && !neighbors.has(hoveredId)) {
        hoveredId = null;
        canvas.classList.remove("has-node-hover");
      }
      redraw();
    },
    setSignals(active: boolean, routes: Set<string>) {
      if (animateSignals === active && routes.size === animatedRouteIds.size && [...routes].every(route => animatedRouteIds.has(route))) return;
      animateSignals = active;
      animatedRouteIds = routes;
      redraw();
    },
    setView(next: { demo: boolean; paused: boolean; reduced: boolean; orbit: boolean; mode: InteractionMode; selected: string | null }) {
      demoActive = next.demo;
      motionPaused = next.paused;
      reduceMotion = next.reduced;
      orbit = next.orbit;
      mode = next.mode;
      selectedId = next.selected;
      hasVisual = graph.nodes.length > 0 || demoActive;
      redraw();
    },
    updateArrivals(changes: LearningArrival[]) {
      for (const { id, kind, observedAt } of changes) arrivals.set(id, { at: observedAt, kind });
      for (const [id, arrival] of arrivals) if (Date.now() - arrival.at > 6_000) arrivals.delete(id);
      const next = arrivals.size > 0;
      if (next || learningPulseActive) {
        learningPulseActive = next;
        redraw();
      }
    },
    focus() { canvas.focus({ preventScroll: true }); },
    zoomIn() { changeZoom(1.18); },
    zoomOut() { changeZoom(1 / 1.18); },
    resetCamera,
  };
}

function collectNeighbors(graph: CognitiveVolumeGraph) {
  const neighbors = new Map(graph.nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    neighbors.get(edge.from)?.add(edge.to);
    neighbors.get(edge.to)?.add(edge.from);
  }
  return neighbors;
}
