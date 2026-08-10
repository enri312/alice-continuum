import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BrainGroup, BrainSnapshot } from "../core/brain";
import { InlineSvgIcon } from "./InlineSvgIcon";
import rotateIcon from "../../icons/view-rotate.svg?raw";
import panIcon from "../../icons/view-pan.svg?raw";
import zoomInIcon from "../../icons/view-zoom-in.svg?raw";
import zoomOutIcon from "../../icons/view-zoom-out.svg?raw";
import resetIcon from "../../icons/view-reset.svg?raw";
import { affectPalette } from "../core/affect";
import type { CoreActivitySnapshot } from "../core/core-activity";

type NeuralVolumeProps = {
  snapshot: BrainSnapshot;
  activity: CoreActivitySnapshot | null;
};

type Point = { x: number; y: number; z: number; group: BrainGroup; phase: number; reveal: number; affectIndex: number; layer: "cortex" | "association"; prominence: number };
type Edge = { from: number; to: number; kind: "local" | "association" | "bridge" };
type InteractionMode = "rotate" | "pan";
type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };

const initialCamera: Camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function createVolume() {
  const random = randomGenerator(0xa11ce);
  const points: Point[] = [];
  const hemisphereIndices: number[][] = [[], []];
  const associationIndices: number[] = [];
  const pointsPerHemisphere = 520;

  for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
    const side = sideIndex === 0 ? -1 : 1;
    for (let index = 0; index < pointsPerHemisphere; index += 1) {
      const radius = .2 + Math.pow(random(), .46) * .8;
      const theta = random() * Math.PI * 2;
      const vertical = random() * 2 - 1;
      const radial = Math.sqrt(1 - vertical * vertical);
      const horizontal = Math.abs(radial * Math.cos(theta));
      const depth = radial * Math.sin(theta);
      const upperRoundness = 1 - Math.max(0, Math.abs(vertical) - .56) * .34;
      const group: BrainGroup = sideIndex === 0
        ? (random() > .42 ? "input" : "memory")
        : (random() > .2 ? "output" : "memory");
      hemisphereIndices[sideIndex].push(points.length);
      points.push({
        x: side * (.075 + horizontal * 1.2 * radius * upperRoundness),
        y: vertical * .9 * radius - .035 * horizontal,
        z: depth * .76 * radius,
        group,
        phase: random() * Math.PI * 2,
        reveal: random(),
        affectIndex: Math.floor((((theta / (Math.PI * 2)) + vertical * .13 + sideIndex * .19 + 2) % 1) * affectPalette.length),
        layer: "cortex",
        prominence: random() > .965 ? 2.5 + random() * 1.6 : 1,
      });
    }
  }

  for (let index = 0; index < 280; index += 1) {
    const radius = .05 + Math.pow(random(), .58) * .54;
    const theta = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const radial = Math.sqrt(1 - vertical * vertical);
    associationIndices.push(points.length);
    points.push({
      x: Math.cos(theta) * radial * radius * 1.08,
      y: vertical * radius * 1.18,
      z: Math.sin(theta) * radial * radius * 1.08,
      group: "memory",
      phase: random() * Math.PI * 2,
      reveal: random() * .86,
      affectIndex: Math.floor(random() * affectPalette.length),
      layer: "association",
      prominence: random() > .91 ? 2.7 + random() * 1.9 : 1.18,
    });
  }

  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();
  const addEdge = (from: number, to: number, kind: Edge["kind"]) => {
    if (from === to) return;
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, kind });
  };

  for (const indices of hemisphereIndices) {
    for (let index = 0; index < indices.length; index += 1) {
      const from = indices[index];
      const origin = points[from];
      const nearest = indices
        .filter((candidate) => candidate !== from)
        .map((candidate) => {
          const target = points[candidate];
          const dx = origin.x - target.x;
          const dy = origin.y - target.y;
          const dz = origin.z - target.z;
          return { candidate, distance: dx * dx + dy * dy + dz * dz };
        })
        .sort((left, right) => left.distance - right.distance);
      nearest.slice(0, 6).forEach((neighbor) => addEdge(from, neighbor.candidate, "local"));
      if (index % 3 === 0) {
        const association = nearest[5 + Math.floor(random() * Math.min(18, nearest.length - 5))];
        if (association) addEdge(from, association.candidate, "association");
      }
    }
  }

  for (let index = 0; index < associationIndices.length; index += 1) {
    const from = associationIndices[index];
    const origin = points[from];
    const nearest = associationIndices
      .filter((candidate) => candidate !== from)
      .map((candidate) => {
        const target = points[candidate];
        const dx = origin.x - target.x;
        const dy = origin.y - target.y;
        const dz = origin.z - target.z;
        return { candidate, distance: dx * dx + dy * dy + dz * dz };
      })
      .sort((left, right) => left.distance - right.distance);
    nearest.slice(0, 4).forEach((neighbor) => addEdge(from, neighbor.candidate, "local"));
  }

  for (let index = 0; index < 180; index += 1) {
    const association = associationIndices[Math.floor(random() * associationIndices.length)];
    const side = index % 2;
    const cortex = hemisphereIndices[side][Math.floor(random() * hemisphereIndices[side].length)];
    addEdge(association, cortex, "bridge");
  }

  const leftBridge = hemisphereIndices[0].filter((index) => Math.abs(points[index].x) < .38);
  const rightBridge = hemisphereIndices[1].filter((index) => Math.abs(points[index].x) < .38);
  for (let index = 0; index < Math.min(210, leftBridge.length); index += 1) {
    const left = leftBridge[Math.floor(random() * leftBridge.length)];
    const origin = points[left];
    const right = rightBridge
      .map((candidate) => {
        const target = points[candidate];
        const dy = origin.y - target.y;
        const dz = origin.z - target.z;
        return { candidate, distance: dy * dy + dz * dz + Math.abs(target.x) * .08 };
      })
      .sort((a, b) => a.distance - b.distance)[Math.floor(random() * 4)]?.candidate;
    if (right !== undefined) addEdge(left, right, "bridge");
  }
  return { points, edges };
}

export function NeuralVolume({ snapshot, activity }: NeuralVolumeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ ...initialCamera });
  const modeRef = useRef<InteractionMode>("rotate");
  const redrawRef = useRef<() => void>(() => undefined);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("rotate");
  const [zoomPercent, setZoomPercent] = useState(100);
  const affectSignature = snapshot.affectChannels.map((channel) => channel.value.toFixed(4)).join(":");
  const dominantAffect = snapshot.affectChannels.reduce((dominant, channel) => channel.value > dominant.value ? channel : dominant, snapshot.affectChannels[0]);
  const hasAffectActivity = Boolean(dominantAffect && dominantAffect.value > 0);

  const updateCameraHud = () => {
    const container = containerRef.current;
    if (!container) return;
    const camera = cameraRef.current;
    container.style.setProperty("--camera-pan-x", `${camera.panX}px`);
    container.style.setProperty("--camera-pan-y", `${camera.panY}px`);
    setZoomPercent(Math.round(camera.zoom * 100));
    redrawRef.current();
  };

  const chooseMode = (mode: InteractionMode) => {
    modeRef.current = mode;
    setInteractionMode(mode);
    canvasRef.current?.focus({ preventScroll: true });
  };

  const changeZoom = (factor: number) => {
    cameraRef.current.zoom = clamp(cameraRef.current.zoom * factor, .55, 3);
    updateCameraHud();
  };

  const resetCamera = () => {
    cameraRef.current = { ...initialCamera };
    updateCameraHud();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const volume = createVolume();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drag = { active: false, pointerId: -1, x: 0, y: 0, mode: "rotate" as InteractionMode };
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
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const pointerDown = (event: PointerEvent) => {
      if (!snapshot.hasActivity || (event.button !== 0 && event.button !== 1)) return;
      drag.active = true;
      drag.pointerId = event.pointerId;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.mode = event.shiftKey || event.button === 1 ? "pan" : modeRef.current;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
      event.preventDefault();
    };

    const pointerMove = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      const camera = cameraRef.current;
      if (drag.mode === "rotate") {
        camera.yaw += deltaX * .0065;
        camera.pitch = clamp(camera.pitch + deltaY * .0055, -.82, .82);
      } else {
        camera.panX = clamp(camera.panX + deltaX, -width * .46, width * .46);
        camera.panY = clamp(camera.panY + deltaY, -height * .42, height * .42);
        updateCameraHud();
      }
      if (reduceMotion) redrawRef.current();
    };

    const pointerUp = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      drag.active = false;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    const wheel = (event: WheelEvent) => {
      if (!snapshot.hasActivity) return;
      cameraRef.current.zoom = clamp(cameraRef.current.zoom * Math.exp(-event.deltaY * .0012), .55, 3);
      updateCameraHud();
      event.preventDefault();
    };

    const doubleClick = () => resetCamera();
    const keyDown = (event: KeyboardEvent) => {
      if (!snapshot.hasActivity) return;
      const camera = cameraRef.current;
      const panStep = event.shiftKey ? 24 : 0;
      if (event.key === "+" || event.key === "=") changeZoom(1.15);
      else if (event.key === "-" || event.key === "_") changeZoom(1 / 1.15);
      else if (event.key === "0") resetCamera();
      else if (event.key === "ArrowLeft") panStep ? camera.panX -= panStep : camera.yaw -= .09;
      else if (event.key === "ArrowRight") panStep ? camera.panX += panStep : camera.yaw += .09;
      else if (event.key === "ArrowUp") panStep ? camera.panY -= panStep : camera.pitch = clamp(camera.pitch - .08, -.82, .82);
      else if (event.key === "ArrowDown") panStep ? camera.panY += panStep : camera.pitch = clamp(camera.pitch + .08, -.82, .82);
      else return;
      camera.panX = clamp(camera.panX, -width * .46, width * .46);
      camera.panY = clamp(camera.panY, -height * .42, height * .42);
      updateCameraHud();
      event.preventDefault();
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("dblclick", doubleClick);
    canvas.addEventListener("keydown", keyDown);

    const project = (point: Point, automaticYaw: number) => {
      const camera = cameraRef.current;
      const yaw = automaticYaw + camera.yaw;
      const yawCosine = Math.cos(yaw);
      const yawSine = Math.sin(yaw);
      const yawX = point.x * yawCosine - point.z * yawSine;
      const yawZ = point.x * yawSine + point.z * yawCosine;
      const pitchCosine = Math.cos(camera.pitch);
      const pitchSine = Math.sin(camera.pitch);
      const rotatedY = point.y * pitchCosine - yawZ * pitchSine;
      const rotatedZ = point.y * pitchSine + yawZ * pitchCosine;
      const perspective = 3.7 / (3.7 - rotatedZ);
      return {
        x: width / 2 + camera.panX + yawX * width * .33 * perspective * camera.zoom,
        y: height / 2 + camera.panY + rotatedY * height * .46 * perspective * camera.zoom,
        z: rotatedZ,
        perspective,
      };
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      if (!snapshot.hasActivity) return;
      const busy = snapshot.focusStatus.includes("nube");
      const automaticYaw = reduceMotion ? .12 : time * (busy ? .00011 : .000035);
      const projected = volume.points.map((point) => project(point, automaticYaw));
      const visualActivity = Math.min(.24, snapshot.currentNeuralActivity * .24);
      const visible = volume.points.map((point) => {
        const affectActivation = snapshot.affectChannels[point.affectIndex]?.value ?? 0;
        return point.reveal <= Math.min(1, snapshot.neuralDensity + affectActivation * .18);
      });
      const active = volume.points.map((point) => {
        const affectActivation = snapshot.affectChannels[point.affectIndex]?.value ?? 0;
        return point.reveal <= Math.min(1, visualActivity + affectActivation * .18);
      });

      const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * .34);
      const dominantColor = dominantAffect?.rgb ?? [125, 211, 252];
      glow.addColorStop(0, hasAffectActivity
        ? `rgba(${dominantColor[0]},${dominantColor[1]},${dominantColor[2]},.18)`
        : busy ? "rgba(244,114,182,.14)" : "rgba(125,211,252,.085)");
      glow.addColorStop(1, "rgba(2,6,23,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "lighter";
      for (const edge of volume.edges) {
        const fromPoint = volume.points[edge.from];
        const toPoint = volume.points[edge.to];
        const from = projected[edge.from];
        const to = projected[edge.to];
        if (!visible[edge.from] || !visible[edge.to]) continue;
        const edgeActive = active[edge.from] && active[edge.to];
        if (!edgeActive && edge.kind === "association" && (edge.from + edge.to) % 3 !== 0) continue;
        const depth = Math.max(.06, Math.min(.42, (from.z + to.z + 2) * .1));
        const fromColor = affectPalette[fromPoint.affectIndex].rgb;
        const toColor = affectPalette[toPoint.affectIndex].rgb;
        const red = Math.round((fromColor[0] + toColor[0]) * .5);
        const green = Math.round((fromColor[1] + toColor[1]) * .5);
        const blue = Math.round((fromColor[2] + toColor[2]) * .5);
        const activeAlpha = edge.kind === "bridge" ? depth * 1.2 : edge.kind === "association" ? depth * .76 : depth;
        const alpha = edgeActive ? activeAlpha : edge.kind === "bridge" ? .09 : .025;
        context.lineWidth = edgeActive ? edge.kind === "bridge" ? 1.15 : edge.kind === "association" ? .62 : .78 : .42;
        context.strokeStyle = edge.kind === "bridge"
          ? `rgba(${edgeActive ? "216,180,254" : "100,116,139"},${alpha})`
          : `rgba(${red},${green},${blue},${alpha})`;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }

      const ordered = volume.points.map((point, index) => ({ point, index })).sort((a, b) => projected[a.index].z - projected[b.index].z);
      for (const { point, index } of ordered) {
        if (!visible[index]) continue;
        const screen = projected[index];
        const [red, green, blue] = affectPalette[point.affectIndex].rgb;
        const isActive = active[index];
        const affectActivation = snapshot.affectChannels[point.affectIndex]?.value ?? 0;
        const pulse = !isActive || reduceMotion ? 1 : .72 + Math.sin(time * (busy ? .006 : .0022) + point.phase) * .28;
        const zoomScale = Math.sqrt(clamp(cameraRef.current.zoom, .7, 1.9));
        const layerScale = point.layer === "association" ? 1.12 : 1;
        const radius = (isActive ? 1.82 : .72) * layerScale * point.prominence * screen.perspective * (busy ? 1.08 : 1) * pulse * zoomScale * (1 + affectActivation * .38);
        const alpha = isActive ? Math.min(.98, .5 + (screen.z + 1) * .22) : point.layer === "association" ? .16 : .095;
        if (isActive && (point.prominence > 1 || index % 17 === 0)) {
          context.shadowColor = `rgba(${red},${green},${blue},.8)`;
          context.shadowBlur = point.prominence > 1 ? 13 : 8;
        }
        context.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
        context.beginPath();
        context.arc(screen.x, screen.y, Math.max(.55, radius), 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      }
      context.globalCompositeOperation = "source-over";

      if (!reduceMotion) animationFrame = window.requestAnimationFrame(draw);
    };
    redrawRef.current = () => { if (reduceMotion) draw(performance.now()); };
    draw(0);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      redrawRef.current = () => undefined;
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", doubleClick);
      canvas.removeEventListener("keydown", keyDown);
    };
  }, [affectSignature, dominantAffect?.rgb, hasAffectActivity, snapshot.affectChannels, snapshot.currentNeuralActivity, snapshot.focusStatus, snapshot.hasActivity, snapshot.neuralDensity]);

  return <div ref={containerRef} className={`neural-volume mode-${interactionMode} ${snapshot.hasActivity ? "has-activity" : "is-empty"}`} role="group" aria-label="Matriz cognitivo-afectiva tridimensional de Alice conectada a datos locales reales">
    <div className="nucleus-panel-label"><span>[01]</span><strong>ALICE COGNITIVE VOLUME</strong><small>AFFECTIVE ROUTING MAP</small></div>
    <canvas ref={canvasRef} tabIndex={snapshot.hasActivity ? 0 : -1} aria-label="Vista 3D del volumen neuronal. Arrastra para girar o mover, usa la rueda para acercar y alejar, y pulsa cero para restablecer." />
    {snapshot.hasActivity ? <>
      <span className="hemisphere-label left">PERCEPCIÓN · MEMORIA · EVALUACIÓN</span>
      <span className="hemisphere-label right">PLANIFICACIÓN · RESPUESTA · ACCIÓN</span>
      <span className="volume-growth">ESTRUCTURA {Math.round(snapshot.persistentNeuralDensity * 100)}% · SEÑAL R3 {Math.round(snapshot.currentNeuralActivity * 100)}% · {activity?.windowEventCount ?? 0} EVENTOS / 5 MIN · {snapshot.persistentMemoryCount} RECUERDOS</span>
      <div className={`volume-affect-status ${hasAffectActivity ? "active" : "standby"}`}><i /><span><strong>CAPA AFECTIVA</strong><small>{hasAffectActivity ? `${dominantAffect.label.toUpperCase()} · ${(dominantAffect.value * 100).toFixed(0)}%` : "EN ESPERA · SIN DOMINANTE"}</small></span></div>
      <div className="volume-affect-palette" aria-label="Paleta de canales afectivos planificados">
        <header><strong>PALETA AFECTIVA</strong><span>COLOR = CIRCUITO · BRILLO = ACTIVIDAD</span></header>
        <div>{snapshot.affectChannels.map((channel) => <span key={channel.id} title={`${channel.label}: ${channel.role}. Estado ${channel.availability === "ready" ? "disponible" : "planificado"}.`} style={{ "--affect-color": channel.color } as CSSProperties}><i />{channel.label}<small>{channel.value.toFixed(2)}</small></span>)}</div>
      </div>
      <div className="volume-signal-legend"><span className="structure">memoria persistente</span><span className="active">señal R3 heurística</span><span className="bridge">correlación R3</span></div>
      <div className="volume-camera-controls" aria-label="Controles de cámara del volumen neuronal">
        <div className="volume-camera-modes" role="group" aria-label="Modo de arrastre">
          <button className={interactionMode === "rotate" ? "selected" : ""} type="button" title="Girar al arrastrar" aria-pressed={interactionMode === "rotate"} onClick={() => chooseMode("rotate")}><InlineSvgIcon markup={rotateIcon} className="camera-control-icon" /><span>Girar</span></button>
          <button className={interactionMode === "pan" ? "selected" : ""} type="button" title="Mover al arrastrar" aria-pressed={interactionMode === "pan"} onClick={() => chooseMode("pan")}><InlineSvgIcon markup={panIcon} className="camera-control-icon" /><span>Mover</span></button>
        </div>
        <div className="volume-camera-actions" role="group" aria-label="Zoom y restablecimiento">
          <button type="button" title="Alejar" aria-label="Alejar volumen" onClick={() => changeZoom(1 / 1.18)}><InlineSvgIcon markup={zoomOutIcon} className="camera-control-icon" /></button>
          <output aria-label={`Zoom ${zoomPercent} por ciento`}>{zoomPercent}%</output>
          <button type="button" title="Acercar" aria-label="Acercar volumen" onClick={() => changeZoom(1.18)}><InlineSvgIcon markup={zoomInIcon} className="camera-control-icon" /></button>
          <button type="button" title="Restablecer vista (doble clic o tecla 0)" aria-label="Restablecer vista" onClick={resetCamera}><InlineSvgIcon markup={resetIcon} className="camera-control-icon" /></button>
        </div>
      </div>
      <p className="volume-camera-help">RUEDA · ZOOM&nbsp;&nbsp; ARRASTRAR · {interactionMode === "rotate" ? "GIRAR" : "MOVER"}&nbsp;&nbsp; SHIFT + ARRASTRAR · MOVER&nbsp;&nbsp; DOBLE CLIC · RESTABLECER</p>
    </> : <div className="volume-empty"><span>000</span><strong>SIN ACTIVIDAD REGISTRADA</strong><small>La matriz aparecerá después de una interacción real. Los diez canales afectivos permanecen en 0.00.</small></div>}
  </div>;
}
