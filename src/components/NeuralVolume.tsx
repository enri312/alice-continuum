import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BrainSnapshot } from "../core/brain";
import type { CoreActivitySnapshot } from "../core/core-activity";
import { buildCognitiveVolumeGraph, cognitiveVolumeNodeColor } from "../core/cognitive-volume";
import type { CognitiveVolumeNode } from "../core/cognitive-volume";
import { affectPalette } from "../core/affect";
import { InlineSvgIcon } from "./InlineSvgIcon";
import rotateIcon from "../../icons/camera-orbit-control.svg?raw";
import panIcon from "../../icons/camera-pan-control.svg?raw";
import zoomInIcon from "../../icons/camera-zoom-in-control.svg?raw";
import zoomOutIcon from "../../icons/camera-zoom-out-control.svg?raw";
import resetIcon from "../../icons/camera-reset-control.svg?raw";

type NeuralVolumeProps = { snapshot: BrainSnapshot; activity: CoreActivitySnapshot | null };
type InteractionMode = "rotate" | "pan";
type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
type ProjectedNode = { node: CognitiveVolumeNode; x: number; y: number; z: number; perspective: number; radius: number };

const initialCamera: Camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const layerLabels = { episodic: "episódica", semantic: "semántica", procedural: "procedimental", preference: "preferencias", self: "modelo del propietario", unclassified: "sin clasificar" } as const;
const statusLabels = { confirmed: "confirmado", conflict: "en conflicto", archived: "archivado", historical: "registro histórico" } as const;
const accessibilityLabels = { notAssessed: "accesibilidad no evaluada", accessible: "recuperable", dormant: "en reposo" } as const;

export function NeuralVolume({ snapshot, activity }: NeuralVolumeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ ...initialCamera });
  const modeRef = useRef<InteractionMode>("rotate");
  const redrawRef = useRef<() => void>(() => undefined);
  const projectedRef = useRef<ProjectedNode[]>([]);
  const selectedNodeRef = useRef<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const automaticYawRef = useRef(.08);
  const graph = useMemo(() => buildCognitiveVolumeGraph(snapshot.memoryNodes, activity), [activity, snapshot.memoryNodes]);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("rotate");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const hasGraph = graph.nodes.length > 0;
  const activeAffects = snapshot.affectChannels.filter((channel) => channel.availability === "ready" && channel.value > .001);
  const dominantAffect = activeAffects.reduce((dominant, channel) => channel.value > dominant.value ? channel : dominant, activeAffects[0]);
  const hasAffectActivity = Boolean(dominantAffect);

  const updateCamera = () => {
    setZoomPercent(Math.round(cameraRef.current.zoom * 100));
    redrawRef.current();
  };
  const chooseMode = (mode: InteractionMode) => {
    modeRef.current = mode;
    setInteractionMode(mode);
    canvasRef.current?.focus({ preventScroll: true });
  };
  const changeZoom = (factor: number) => {
    cameraRef.current.zoom = clamp(cameraRef.current.zoom * factor, .55, 3.5);
    updateCamera();
  };
  const resetCamera = () => {
    cameraRef.current = { ...initialCamera };
    automaticYawRef.current = .08;
    updateCamera();
  };

  useEffect(() => {
    if (selectedNodeId && !graph.nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(null);
  }, [graph.nodes, selectedNodeId]);

  useEffect(() => {
    selectedNodeRef.current = selectedNodeId;
    redrawRef.current();
  }, [selectedNodeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      redrawRef.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const hitTest = (clientX: number, clientY: number) => {
      const bounds = canvas.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      return [...projectedRef.current]
        .sort((left, right) => right.z - left.z)
        .find((projected) => Math.hypot(projected.x - x, projected.y - y) <= Math.max(9, projected.radius + 5))?.node ?? null;
    };

    const pointerDown = (event: PointerEvent) => {
      if (!hasGraph || (event.button !== 0 && event.button !== 1)) return;
      drag.active = true;
      drag.pointerId = event.pointerId;
      drag.x = drag.originX = event.clientX;
      drag.y = drag.originY = event.clientY;
      drag.mode = event.shiftKey || event.button === 1 ? "pan" : modeRef.current;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
      event.preventDefault();
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag.active) {
        const hit = hitTest(event.clientX, event.clientY);
        const nextId = hit?.id ?? null;
        if (hoveredNodeRef.current !== nextId) {
          hoveredNodeRef.current = nextId;
          canvas.classList.toggle("has-node-hover", Boolean(nextId));
          redrawRef.current();
        }
        return;
      }
      if (event.pointerId !== drag.pointerId) return;
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
      }
      if (reduceMotion) redrawRef.current();
    };
    const pointerUp = (event: PointerEvent) => {
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      const moved = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
      drag.active = false;
      canvas.classList.remove("is-dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (moved <= 5 && event.button === 0) {
        setSelectedNodeId(hitTest(event.clientX, event.clientY)?.id ?? null);
      }
    };
    const pointerLeave = () => {
      if (drag.active) return;
      hoveredNodeRef.current = null;
      canvas.classList.remove("has-node-hover");
      redrawRef.current();
    };
    const wheel = (event: WheelEvent) => {
      if (!hasGraph) return;
      cameraRef.current.zoom = clamp(cameraRef.current.zoom * Math.exp(-event.deltaY * .0012), .55, 3.5);
      updateCamera();
      event.preventDefault();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!hasGraph) return;
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
      updateCamera();
      event.preventDefault();
    };

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("dblclick", resetCamera);
    canvas.addEventListener("keydown", keyDown);

    const project = (node: CognitiveVolumeNode, automaticYaw: number) => {
      const camera = cameraRef.current;
      const yaw = automaticYaw + camera.yaw;
      const yawCosine = Math.cos(yaw);
      const yawSine = Math.sin(yaw);
      const yawX = node.x * yawCosine - node.z * yawSine;
      const yawZ = node.x * yawSine + node.z * yawCosine;
      const pitchCosine = Math.cos(camera.pitch);
      const pitchSine = Math.sin(camera.pitch);
      const rotatedY = node.y * pitchCosine - yawZ * pitchSine;
      const rotatedZ = node.y * pitchSine + yawZ * pitchCosine;
      const perspective = 3.4 / (3.4 - rotatedZ);
      return {
        x: width / 2 + camera.panX + yawX * width * .32 * perspective * camera.zoom,
        y: height / 2 + camera.panY + rotatedY * height * .4 * perspective * camera.zoom,
        z: rotatedZ,
        perspective,
      };
    };

    const neighbors = new Map<string, Set<string>>();
    for (const node of graph.nodes) neighbors.set(node.id, new Set());
    for (const edge of graph.edges) {
      neighbors.get(edge.from)?.add(edge.to);
      neighbors.get(edge.to)?.add(edge.from);
    }
    let previousTime = 0;

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      if (!hasGraph) return;
      const elapsed = previousTime ? Math.min(32, time - previousTime) : 0;
      previousTime = time;
      const focusId = selectedNodeRef.current ?? hoveredNodeRef.current;
      if (!reduceMotion && !focusId && !drag.active) automaticYawRef.current += elapsed * .000007;
      const projected = new Map(graph.nodes.map((node) => [node.id, project(node, automaticYawRef.current)]));

      const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * .28);
      glow.addColorStop(0, "rgba(14,116,144,.12)");
      glow.addColorStop(1, "rgba(2,6,23,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "lighter";
      for (const edge of graph.edges) {
        const from = projected.get(edge.from);
        const to = projected.get(edge.to);
        if (!from || !to) continue;
        const related = !focusId || edge.from === focusId || edge.to === focusId;
        const baseAlpha = edge.kind === "retrieval" ? .48 : .18 + edge.signal * .5;
        const alpha = baseAlpha * (related ? 1 : .13);
        context.lineWidth = (edge.kind === "retrieval" ? 1.2 : .7 + edge.signal) * (related ? 1 : .72);
        context.strokeStyle = edge.kind === "retrieval" ? `rgba(224,242,254,${alpha})` : `rgba(45,212,191,${alpha})`;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        if (!reduceMotion && edge.signal > 0 && related) {
          const phase = (time * (.00016 + edge.signal * .0002) + edge.evidenceCount * .07) % 1;
          context.fillStyle = edge.kind === "retrieval" ? "rgba(224,242,254,.9)" : "rgba(45,212,191,.82)";
          context.beginPath();
          context.arc(from.x + (to.x - from.x) * phase, from.y + (to.y - from.y) * phase, 1.2, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.globalCompositeOperation = "source-over";
      const ordered = graph.nodes
        .map((node) => ({ node, point: projected.get(node.id)! }))
        .sort((left, right) => left.point.z - right.point.z);
      const hits: ProjectedNode[] = [];
      for (const { node, point } of ordered) {
        const [red, green, blue] = cognitiveVolumeNodeColor(node);
        const memoryStrength = node.memory?.storageStrength ?? 0;
        const related = !focusId || node.id === focusId || neighbors.get(focusId)?.has(node.id) === true;
        const activityPulse = node.signal > 0 && related && !reduceMotion ? .9 + Math.sin(time * .004 + node.x * 5) * .1 : 1;
        const baseRadius = node.kind === "process" ? 4.6 + node.signal * 3.2 : 3.1 + memoryStrength * 3 + (node.memory?.successfulRecalls ?? 0) * .08;
        const radius = clamp(baseRadius * point.perspective * Math.sqrt(cameraRef.current.zoom) * activityPulse, 2.1, 13);
        const selected = node.id === selectedNodeRef.current;
        const hovered = node.id === hoveredNodeRef.current;
        const archived = node.memory?.archived === true;
        const dormant = node.memory?.accessibility === "dormant";
        const suppressed = node.memory?.suppressed === true;
        const stateAlpha = selected || hovered ? 1 : archived ? .3 : suppressed ? .28 : dormant ? .4 : node.kind === "process" || node.memory?.retrieved ? .95 : .72;
        const alpha = stateAlpha * (related ? 1 : .24);
        context.shadowColor = `rgba(${red},${green},${blue},.82)`;
        context.shadowBlur = node.signal > 0 || selected || hovered ? 14 : 4;
        const core = context.createRadialGradient(point.x - radius * .32, point.y - radius * .38, .4, point.x, point.y, Math.max(radius * 1.35, 3));
        core.addColorStop(0, `rgba(235,248,255,${Math.min(1, alpha + .15)})`);
        core.addColorStop(.28, `rgba(${red},${green},${blue},${alpha})`);
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
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
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
          context.arc(point.x, point.y, radius + 1.8, 0, Math.PI * 2);
        }
        context.stroke();

        if (node.memory?.retrieved || selected || hovered || node.memory?.status === "conflict") {
          context.strokeStyle = node.memory?.status === "conflict" ? "rgba(254,202,202,.9)" : "rgba(224,242,254,.88)";
          context.lineWidth = selected ? 1.4 : hovered ? 1.1 : .8;
          context.beginPath();
          context.arc(point.x, point.y, radius + (selected ? 5 : 3.5), 0, Math.PI * 2);
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
      projectedRef.current = hits;
      if (!reduceMotion) animationFrame = window.requestAnimationFrame(draw);
    };
    redrawRef.current = () => { if (reduceMotion) draw(performance.now()); };
    resize();
    draw(0);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      redrawRef.current = () => undefined;
      projectedRef.current = [];
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", resetCamera);
      canvas.removeEventListener("keydown", keyDown);
    };
  }, [graph, hasGraph]);

  return <div className={`volume-workbench ${selectedNode ? "has-selection" : ""}`}>
    <div className={`volume-workbench-grid ${hasGraph ? "has-graph" : "is-empty"}`}>
      <div ref={containerRef} className={`neural-volume traceable-volume mode-${interactionMode} ${hasGraph ? "has-activity" : "is-empty"}`} role="group" aria-label="Volumen cognitivo tridimensional trazable de Alice">
        <div className="nucleus-panel-label"><span>[01]</span><strong>ALICE COGNITIVE VOLUME</strong><small>TRACEABLE MEMORY GRAPH</small></div>
        <canvas ref={canvasRef} tabIndex={hasGraph ? 0 : -1} aria-label="Grafo 3D: cada círculo corresponde a un recuerdo real y cada rombo a un proceso reciente comprobado." />
        {hasGraph ? <>
          <span className="hemisphere-label left">MEMORIA PERSISTENTE · {graph.persistentNodeCount} NODOS REALES</span>
          <span className="hemisphere-label right">PROCESOS · {graph.processNodeCount} · ASOCIACIONES PERSISTENTES · 0</span>
          <div className="volume-layer-legend" aria-label="Capas de memoria"><span className="episodic"><i />episódica</span><span className="semantic"><i />semántica</span><span className="procedural"><i />procedimental</span><span className="preference"><i />preferencias</span><span className="self"><i />propietario</span><span className="unclassified"><i />sin clasificar</span></div>
        </> : <div className="volume-empty"><span>000</span><strong>SIN NODOS COGNITIVOS</strong><small>No existen recuerdos persistentes ni procesos R3 recientes. El volumen no genera estructura de relleno.</small></div>}
      </div>

      {hasGraph && <aside className="volume-inspector-rail" aria-label="Inspector del volumen cognitivo">
        <header className="volume-inspector-heading"><span>INSPECTOR TRAZABLE</span><strong>{selectedNode ? "SELECCIÓN ACTIVA" : "EN ESPERA"}</strong></header>
        <div className={`volume-node-inspector ${selectedNode ? "selected" : "idle"}`} aria-live="polite">
          {selectedNode ? selectedNode.memory ? <><span>NODO DE MEMORIA</span><strong>{selectedNode.memory.label}</strong><small>{layerLabels[selectedNode.memory.layer]} · {statusLabels[selectedNode.memory.status]} · {accessibilityLabels[selectedNode.memory.accessibility]}{selectedNode.memory.archived ? " · archivado" : ""}{selectedNode.memory.deletionScheduled ? " · eliminación programada" : ""}{selectedNode.memory.suppressed ? " · suprimido" : ""} · v{selectedNode.memory.version}</small><code>{selectedNode.memory.id}</code><dl><div><dt>Versión</dt><dd>{selectedNode.memory.version}{selectedNode.memory.version > 1 ? " · reconsolidada" : " · original"}</dd></div><div><dt>Retención</dt><dd>{selectedNode.memory.deletionScheduled ? "espera gobernada antes de retiro" : "sin eliminación programada"}</dd></div><div><dt>Recuperación</dt><dd>{selectedNode.memory.archived ? "bloqueada por archivo reversible" : selectedNode.memory.suppressed ? "suprimida por el propietario" : accessibilityLabels[selectedNode.memory.accessibility]}</dd></div><div><dt>Estabilidad</dt><dd>{selectedNode.memory.storageStrength === null ? "sin métrica" : `${Math.round(selectedNode.memory.storageStrength * 100)}%`}</dd></div><div><dt>Recuperaciones</dt><dd>{selectedNode.memory.successfulRecalls}</dd></div><div><dt>Fuente</dt><dd>{selectedNode.memory.source ?? "no declarada"}</dd></div></dl></> : <><span>NODO DE PROCESO</span><strong>{selectedNode.label}</strong><small>{selectedNode.detail}</small><code>{selectedNode.id}</code></> : <><span>INSPECTOR TRAZABLE</span><strong>Seleccioná un nodo</strong><small>Un círculo abre un recuerdo real; un rombo explica señal R3 o recuperación actual. La selección conserva el contexto y atenúa únicamente los elementos no relacionados.</small></>}
        </div>
        <div className={`volume-affect-status ${hasAffectActivity ? "active" : "standby"}`} style={hasAffectActivity ? { "--affect-color": dominantAffect.color } as CSSProperties : undefined}><i /><span><strong>CAPA AFECTIVA</strong><small>{hasAffectActivity ? `${dominantAffect.label.toUpperCase()} · ${(dominantAffect.value * 100).toFixed(0)}%` : "10 CANALES · EN ESPERA"}</small></span></div>
        <div className="volume-affect-palette standby" aria-label="Canales afectivos reservados"><header><strong>CANALES AFECTIVOS</strong><span>SIN SEÑAL · NO COLOREAN MEMORIA</span></header><div className="affect-standby-row">{affectPalette.map((channel) => <i key={channel.id} title={channel.label} />)}<small>0.00 EN TODOS LOS CANALES</small></div></div>
      </aside>}
    </div>

    {hasGraph && <>
      <div className="volume-control-dock">
        <div className="volume-camera-controls" aria-label="Controles de cámara del volumen cognitivo"><div className="volume-camera-modes" role="group" aria-label="Modo de arrastre"><button className={interactionMode === "rotate" ? "selected" : ""} type="button" title="Girar al arrastrar" aria-pressed={interactionMode === "rotate"} onClick={() => chooseMode("rotate")}><InlineSvgIcon markup={rotateIcon} className="camera-control-icon" /><span>Girar</span></button><button className={interactionMode === "pan" ? "selected" : ""} type="button" title="Mover al arrastrar" aria-pressed={interactionMode === "pan"} onClick={() => chooseMode("pan")}><InlineSvgIcon markup={panIcon} className="camera-control-icon" /><span>Mover</span></button></div><div className="volume-camera-actions" role="group" aria-label="Zoom y restablecimiento"><button type="button" title="Alejar" aria-label="Alejar volumen" onClick={() => changeZoom(1 / 1.18)}><InlineSvgIcon markup={zoomOutIcon} className="camera-control-icon" /></button><output aria-label={`Zoom ${zoomPercent} por ciento`}>{zoomPercent}%</output><button type="button" title="Acercar" aria-label="Acercar volumen" onClick={() => changeZoom(1.18)}><InlineSvgIcon markup={zoomInIcon} className="camera-control-icon" /></button><button type="button" title="Restablecer vista" aria-label="Restablecer vista" onClick={resetCamera}><InlineSvgIcon markup={resetIcon} className="camera-control-icon" /></button></div></div>
        <span className="volume-dock-state"><i />ESTRUCTURA ESTABLE · SEÑAL REACTIVA</span>
      </div>
      <div className="volume-stats-strip"><span className="volume-stats-growth">{graph.persistentNodeCount} RECUERDOS · {snapshot.retrievedMemoryCount} RECUPERADOS · {graph.processNodeCount} PROCESOS · 0 ASOCIACIONES PERSISTENTES</span><div className="volume-stats-routes" aria-label="Evidencia del grafo"><span className="input"><i />R3 <strong>{activity?.windowEventCount ?? 0}</strong></span><span className="memory"><i />NODOS <strong>{graph.persistentNodeCount}</strong></span><span className="output"><i />ARISTAS <strong>{graph.edges.length}</strong></span></div><span className="volume-stats-help">CLIC · INSPECCIONAR&nbsp;&nbsp; RUEDA · ZOOM&nbsp;&nbsp; ARRASTRAR · {interactionMode === "rotate" ? "GIRAR" : "MOVER"}&nbsp;&nbsp; DOBLE CLIC · RESTABLECER</span></div>
    </>}
  </div>;
}
