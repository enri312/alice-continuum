import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BrainSnapshot } from "../../core/cognitive/brain";
import type { CoreActivitySnapshot } from "../../core/cognitive/core-activity";
import { buildCognitiveVolumeGraph, cognitiveVolumeNodeColor, cognitiveMemoryRadius, currentVolumeAssociations } from "../../core/cognitive/cognitive-volume";
import type { CognitiveVolumeNode, ConfirmedMemoryAssociation } from "../../core/cognitive/cognitive-volume";
import { resolveKnowledgeGraphEvidenceQuote } from "../../core/memory/knowledge-graph-volume";
import type { KnowledgeGraphVolumeState } from "../../core/memory/knowledge-graph-volume";
import { affectPalette } from "../../core/cognitive/affect";
import { cortexPaths, neuralSeed } from "../../core/cognitive/neural-geometry";
import { buildVolumeSignalSnapshot } from "../../core/cognitive/volume-signals";
import { illustrativeSignalNodes, illustrativeSignalRoutes } from "../../core/cognitive/volume-signal-demo";
import { VolumeSignalConsole, type VolumeSignalMode } from "./VolumeSignalConsole";
import { VolumeLearningActivity, type VolumeLearningActivityState } from "./VolumeLearningActivity";
import { VolumeLearningSummary, type VolumeLearningChange, type VolumeObservedLearning, type VolumeStudyProgress } from "./VolumeLearningSummary";
import { createVolumeLearningCheckpoint, diffVolumeLearningCheckpoints, volumeLearningScale } from "../../core/cognitive/volume-learning";
import { InlineSvgIcon } from "../icons/InlineSvgIcon";
import rotateIcon from "../../../icons/camera-orbit-control.svg?raw";
import panIcon from "../../../icons/camera-pan-control.svg?raw";
import zoomInIcon from "../../../icons/camera-zoom-in-control.svg?raw";
import zoomOutIcon from "../../../icons/camera-zoom-out-control.svg?raw";
import resetIcon from "../../../icons/camera-reset-control.svg?raw";

type NeuralVolumeProps = {
  runtimeActive?: boolean;
  snapshot: BrainSnapshot;
  activity: CoreActivitySnapshot | null;
  associations?: readonly ConfirmedMemoryAssociation[];
  associationStatus?: KnowledgeGraphVolumeState;
  invalidatedAssociationCount?: number;
  learningReady?: boolean;
  studyProgress?: VolumeStudyProgress | null;
  learningActivity?: VolumeLearningActivityState;
  onRefreshLearning?: () => void;
};
type InteractionMode = "rotate" | "pan";
type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
type ProjectedNode = { node: CognitiveVolumeNode; x: number; y: number; z: number; perspective: number; radius: number };

const initialCamera: Camera = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const layerLabels = { episodic: "episódica", semantic: "semántica", procedural: "procedimental", preference: "preferencias", self: "modelo del propietario", unclassified: "sin clasificar" } as const;
const statusLabels = { confirmed: "confirmado", learned: "aprendido automáticamente", conflict: "en conflicto", archived: "archivado", historical: "registro histórico" } as const;
const accessibilityLabels = { notAssessed: "accesibilidad no evaluada", accessible: "recuperable", dormant: "en reposo" } as const;
const originLabels = { study: "Autoestudio con fuente", automatic: "Aprendizaje al conversar", profile: "Perfil del propietario", record: "Registro de memoria" } as const;
const dateLabels = { study: "Último estudio", created: "Creación del registro", session: "Fecha de la sesión" } as const;
const studyStateLabels = { available: "Disponible para conversación", review: "En estudio · requiere ejercicio aprobado", withdrawn: "Retirado del contexto · registro conservado" } as const;

export function NeuralVolume({ snapshot, activity, runtimeActive = false, associations = [], associationStatus = "unavailable", invalidatedAssociationCount = 0, learningReady = true, studyProgress = null, learningActivity, onRefreshLearning }: NeuralVolumeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ ...initialCamera });
  const modeRef = useRef<InteractionMode>("rotate");
  const redrawRef = useRef<() => void>(() => undefined);
  const projectedRef = useRef<ProjectedNode[]>([]);
  const selectedNodeRef = useRef<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const automaticYawRef = useRef(.08);
  const orbitRef = useRef(false);
  const animationClockRef = useRef(0);
  const learningCheckpointRef = useRef<ReturnType<typeof createVolumeLearningCheckpoint> | null>(null);
  const learningLabelsRef = useRef(new Map<string, string>());
  const seenLearningIdsRef = useRef(new Set<string>());
  const learningArrivalRef = useRef(new Map<string, { at: number; kind: "added" | "changed" }>());
  const [observedLearning, setObservedLearning] = useState<VolumeObservedLearning>({ baseline: null, added: 0, changed: 0, removed: 0 });
  const [learningChanges, setLearningChanges] = useState<VolumeLearningChange[]>([]);
  const [orbit, setOrbit] = useState(false);
  const [signalMode, setSignalMode] = useState<VolumeSignalMode>("recorded");
  const [motionPaused, setMotionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const displayNowMs = Math.max(nowMs, Date.now());
  const latestLearningChange = learningChanges[0];
  const learningPulseActive = Boolean(latestLearningChange && latestLearningChange.kind !== "removed" && displayNowMs - latestLearningChange.observedAt < 6_000);
  const signals = buildVolumeSignalSnapshot(activity, runtimeActive, displayNowMs);
  const routeAnimationKey = signals.routes.filter(route => route.animatable).map(route => route.id).join("|");
  const animatedRouteIds = useMemo(() => new Set(routeAnimationKey.split("|")), [routeAnimationKey]);
  const demoActive = signalMode === "demo";
  const animateSignals = signals.animatable && !demoActive && !motionPaused && !reducedMotion;
  const graph = useMemo(() => buildCognitiveVolumeGraph(snapshot.memoryNodes, activity, associations, runtimeActive), [activity, associations, snapshot.memoryNodes, runtimeActive]);
  const growthScale = volumeLearningScale(graph.persistentNodeCount);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("rotate");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const currentAssociations = useMemo(() => currentVolumeAssociations(snapshot.memoryNodes, associations), [snapshot.memoryNodes, associations]);
  const locallyInvalidatedAssociations = associations.length - currentAssociations.length;
  const effectiveAssociationStatus = locallyInvalidatedAssociations > 0 ? "sourceChanged" : associationStatus;
  const displayedInvalidatedAssociationCount = Math.max(invalidatedAssociationCount, locallyInvalidatedAssociations);
  const selectedAssociations = selectedNode?.memory ? currentAssociations.filter((association) => association.evidence.some((item) => item.recordId === selectedNode.memory?.id)) : [];
  const hasGraph = graph.nodes.length > 0;
  const hasVisual = hasGraph || demoActive;
  const activeAffects = snapshot.affectChannels.filter((channel) => channel.availability === "ready" && channel.value > .001);
  const dominantAffect = activeAffects.reduce((dominant, channel) => channel.value > dominant.value ? channel : dominant, activeAffects[0]);
  const hasAffectActivity = Boolean(dominantAffect);
  const graphStateLabel = effectiveAssociationStatus === "loading" ? "ASOCIACIONES · VERIFICANDO FUENTES"
    : effectiveAssociationStatus === "normal" ? "ASOCIACIONES · FUENTES VIGENTES"
      : effectiveAssociationStatus === "empty" ? "ASOCIACIONES · SIN RELACIONES CONFIRMADAS"
        : effectiveAssociationStatus === "sourceChanged" ? `ASOCIACIONES · FUENTE CAMBIADA · ${displayedInvalidatedAssociationCount} RELACIÓN${displayedInvalidatedAssociationCount === 1 ? "" : "ES"} REQUIERE${displayedInvalidatedAssociationCount === 1 ? "" : "N"} REVISIÓN`
          : effectiveAssociationStatus === "error" ? "ASOCIACIONES · ERROR DE LECTURA · RECUERDOS SIN ALTERAR"
            : "ASOCIACIONES · DISPONIBLES EN LA APLICACIÓN LOCAL";

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
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", updatePreference);
    return () => { window.clearInterval(timer); preference.removeEventListener("change", updatePreference); };
  }, []);

  useEffect(() => {
    if (!learningReady) return;
    const next = createVolumeLearningCheckpoint(snapshot.memoryNodes);
    const labels = new Map(snapshot.memoryNodes.map(node => [node.id, node.label]));
    if (learningCheckpointRef.current === null) {
      learningCheckpointRef.current = next;
      learningLabelsRef.current = labels;
      seenLearningIdsRef.current = new Set(Object.keys(next));
      setObservedLearning({ baseline: snapshot.memoryNodes.length, added: 0, changed: 0, removed: 0 });
      return;
    }
    const difference = diffVolumeLearningCheckpoints(learningCheckpointRef.current, next);
    const addedIds = difference.addedIds.filter(id => !seenLearningIdsRef.current.has(id));
    const returnedIds = difference.addedIds.filter(id => seenLearningIdsRef.current.has(id));
    const changedIds = [...difference.changedIds, ...returnedIds];
    const observedAt = Date.now();
    const additions: VolumeLearningChange[] = [
      ...addedIds.map(id => ({ id, kind: "added" as const, label: labels.get(id) ?? id, observedAt })),
      ...changedIds.map(id => ({ id, kind: "changed" as const, label: labels.get(id) ?? id, observedAt })),
      ...difference.removedIds.map(id => ({ id, kind: "removed" as const, label: learningLabelsRef.current.get(id) ?? id, observedAt })),
    ];
    for (const id of addedIds) learningArrivalRef.current.set(id, { at: observedAt, kind: "added" });
    for (const id of changedIds) learningArrivalRef.current.set(id, { at: observedAt, kind: "changed" });
    for (const id of difference.addedIds) seenLearningIdsRef.current.add(id);
    for (const [id, event] of learningArrivalRef.current) if (observedAt - event.at > 10_000) learningArrivalRef.current.delete(id);
    if (additions.length) {
      setLearningChanges(current => [...additions, ...current].slice(0, 24));
      setObservedLearning(current => ({ ...current, added: current.added + addedIds.length, changed: current.changed + changedIds.length, removed: current.removed + difference.removedIds.length }));
    }
    learningCheckpointRef.current = next;
    learningLabelsRef.current = labels;
  }, [snapshot.memoryNodes, learningReady]);

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
    const reduceMotion = reducedMotion;
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
      if (!hasVisual || (event.button !== 0 && event.button !== 1)) return;
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
      redrawRef.current();
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
      if (!hasVisual) return;
      cameraRef.current.zoom = clamp(cameraRef.current.zoom * Math.exp(-event.deltaY * .0012), .55, 3.5);
      updateCamera();
      event.preventDefault();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!hasVisual) return;
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

    const center = {x:0, y:0, z:0};
    const extent = 1;
    const project = (node: {x:number;y:number;z:number}, automaticYaw: number) => {
      const camera = cameraRef.current;
      const yaw = automaticYaw + camera.yaw;
      const yawCosine = Math.cos(yaw);
      const yawSine = Math.sin(yaw);
      const x = (node.x - center.x) / extent * growthScale;
      const y = (node.y - center.y) / extent * growthScale;
      const z = (node.z - center.z) / extent * growthScale;
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

    const neighbors = new Map<string, Set<string>>();
    for (const node of graph.nodes) neighbors.set(node.id, new Set());
    for (const edge of graph.edges) {
      neighbors.get(edge.from)?.add(edge.to);
      neighbors.get(edge.to)?.add(edge.from);
    }
    let previousTime = 0;
    let lastPaint = -Infinity;
    const hasSignal = animateSignals || ((demoActive || learningPulseActive) && !motionPaused && !reduceMotion);
    let envelopeKey = "";
    let envelopePaths: {path:Path2D;depth:number; points: {x:number;y:number;z:number}[]}[] = [];

    const draw = (time: number) => {
      const interval = hasSignal || orbitRef.current || drag.active ? 32 : 250;
      if (!reduceMotion && time - lastPaint < interval) {
        animationFrame = window.requestAnimationFrame(draw); return;
      }
      lastPaint = time;
      context.clearRect(0, 0, width, height);
      if (!hasVisual) { projectedRef.current = []; return; }
      const elapsed = previousTime ? Math.min(32, time - previousTime) : 0;
      previousTime = time;
      if (!motionPaused && !reduceMotion) animationClockRef.current += elapsed;
      const animationTime = animationClockRef.current;
      const focusId = selectedNodeRef.current ?? hoveredNodeRef.current;
      if (orbitRef.current && !reduceMotion && !motionPaused && !focusId && !drag.active) automaticYawRef.current += elapsed * .000007;
      const projected = new Map(graph.nodes.map((node) => [node.id, project(node, automaticYawRef.current)]));
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
      const camera = cameraRef.current;
      const nextEnvelopeKey = `${width}:${height}:${automaticYawRef.current}:${camera.yaw}:${camera.pitch}:${camera.zoom}:${camera.panX}:${camera.panY}`;
      if (envelopeKey !== nextEnvelopeKey) {
        envelopeKey = nextEnvelopeKey;
        envelopePaths = cortexPaths.map(points => {
          const projected = points.map(point => project(point, automaticYawRef.current));
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
        if (animateSignals && recordedRouteIsCurrent && edge.kind !== "association" && edge.kind !== "coLearning" && edge.signal > 0 && related) {
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
        const [red, green, blue] = cognitiveVolumeNodeColor(node);
        const related = !focusId || node.id === focusId || neighbors.get(focusId)?.has(node.id) === true;
        const activityPulse = node.signal > 0 && node.processRegion !== "runtime" && related && animateSignals ? .85 + Math.sin(animationTime * .004 + node.x * 5) * .15 : 1;
        const baseRadius = node.kind === "process" ? 4.6 + node.signal * 3.2 : cognitiveMemoryRadius(node.memory?.importance ?? null);
        const arrival = node.memory ? learningArrivalRef.current.get(node.memory.id) : undefined;
        const arrivalAge = arrival ? Date.now() - arrival.at : Infinity;
        const showArrival = arrivalAge < 6_000 && !reduceMotion && !motionPaused;
        const growth = arrival?.kind === "added" && showArrival ? .45 + .55 * clamp(arrivalAge / 1_400, 0, 1) : 1;
        const radius = clamp(baseRadius * point.perspective * Math.sqrt(cameraRef.current.zoom) * growth, 2.1, 32);
        const selected = node.id === selectedNodeRef.current;
        const hovered = node.id === hoveredNodeRef.current;
        const archived = node.memory?.archived === true;
        const dormant = node.memory?.accessibility === "dormant";
        const suppressed = node.memory?.suppressed === true;
        const studyWithdrawn = node.memory?.studyState === "withdrawn";
        const stateAlpha = selected || hovered ? 1 : archived || studyWithdrawn ? .3 : suppressed ? .28 : dormant ? .4 : node.kind === "process" || node.memory?.retrieved ? .95 : .72;
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
      if (demoActive) {
        // Explicitly illustrative stations. Never add them to graph.nodes/hits,
        // memory counters, associations, audit records or retrieval context.
        context.save();
        const stations = new Map(illustrativeSignalNodes.map(node => [node.id, { ...node, point: project(node, automaticYawRef.current) }]));
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
      projectedRef.current = hits;
      if (!reduceMotion && (hasSignal || (orbitRef.current && !motionPaused) || drag.active)) animationFrame = window.requestAnimationFrame(draw);
    };
    redrawRef.current = () => {
      window.cancelAnimationFrame(animationFrame);
      lastPaint = -Infinity;
      draw(performance.now());
    };
    resize();

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
  }, [graph, growthScale, hasVisual, demoActive, animateSignals, animatedRouteIds, motionPaused, reducedMotion, orbit, learningPulseActive]);

  return <div className={`volume-workbench volume-observatory ${selectedNode ? "has-selection" : ""}`}>
    <header className="observatory-header"><div><span>ALICE / SU CEREBRO LÓGICO</span><h3>Una memoria que crece al aprender</h3><p>{runtimeActive ? "Núcleo disponible · " : ""}Explora cómo se organiza su conocimiento y qué cambia con cada aprendizaje</p></div><div className="observatory-counts"><span><b>{graph.persistentNodeCount}</b> registros</span><span><b>{graph.processNodeCount}</b> procesos / núcleo</span><span><b>{graph.persistentAssociationCount}</b> asociaciones</span></div></header>
    <VolumeLearningSummary nodes={snapshot.memoryNodes} observed={observedLearning} changes={learningChanges} ready={learningReady} studyProgress={studyProgress} />
    {learningActivity && <VolumeLearningActivity state={learningActivity} onRefresh={onRefreshLearning} />}
    <div className={`observatory-graph-state ${effectiveAssociationStatus}`} role="status"><i />{graphStateLabel}</div>
    {hasGraph && <details className="observatory-search"><summary>Buscar un recuerdo o proceso</summary><label className="observatory-select">Explorar un nodo<select value={selectedNodeId ?? ""} onChange={event => setSelectedNodeId(event.target.value || null)}><option value="">Seleccioná en la vista o aquí</option>{graph.nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label></details>}
    <div className={`volume-workbench-grid ${selectedNode ? "has-side-rail" : ""} ${hasVisual ? "has-graph" : "is-empty"}`}>
      <div ref={containerRef} className={`neural-volume traceable-volume mode-${interactionMode} ${hasVisual ? "has-activity" : "is-empty"}`} data-signal-mode={signalMode} role="group" aria-label="Volumen cognitivo tridimensional trazable de Alice">
        <div className="nucleus-panel-label"><span>3D</span><strong>RED DE RECUERDOS</strong><small>ARRASTRA PARA EXPLORAR</small></div>
        <canvas ref={canvasRef} tabIndex={hasVisual ? 0 : -1} aria-label={demoActive ? "Demostración ilustrativa del flujo entre entrada, memoria, modelo, contexto y salida. No representa actividad cerebral medida." : "Red 3D inspirada en formas neuronales. Los nodos muestran recuerdos y procesos registrados; el contorno cerebral es ilustrativo."} />
        {demoActive && <div className="volume-demo-badge" role="status">DEMOSTRACIÓN · rutas ilustrativas, sin eventos nuevos</div>}
        {learningPulseActive && latestLearningChange && <div className="volume-learning-burst" role="status"><strong>{latestLearningChange.kind === "added" ? "Nuevo registro incorporado" : "Registro actualizado"}</strong><span>{latestLearningChange.label}</span></div>}
        {hasVisual ? <>
          <div className="neural-visual-caption">{demoActive ? "ESQUEMA FUNCIONAL · CONTADORES REALES CONSERVADOS" : "MALLA ILUSTRATIVA · NODOS DE DATOS REALES"}</div>
        </> : <div className="volume-empty"><span>000</span><strong>SIN NODOS COGNITIVOS</strong><small>No existen recuerdos persistentes ni procesos R3 recientes. El volumen no genera estructura de relleno.</small></div>}
      </div>

      {selectedNode && <div className="volume-side-rail">
      {selectedNode && <aside className="volume-inspector-rail" aria-label="Inspector del volumen cognitivo">
        <header className="volume-inspector-heading"><span>RECUERDO / PROCESO</span><button type="button" className="observatory-orbit" onClick={() => { setSelectedNodeId(null); canvasRef.current?.focus({ preventScroll: true }); }}>Cerrar ficha</button></header>
        {selectedNode.memory && <div className="volume-learning-meta"><strong>{originLabels[selectedNode.memory.origin]}</strong><span>{selectedNode.memory.recordedAt && selectedNode.memory.recordedAtKind ? `${dateLabels[selectedNode.memory.recordedAtKind]} · ${new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedNode.memory.recordedAt))}` : "Fecha no declarada en la fuente"}</span>{selectedNode.memory.recordedAtKind === "study" && <small>La fecha de repaso no indica cuándo nació este conocimiento.</small>}</div>}
        {selectedNode.memory?.studyState && <p className="review-note"><strong>{studyStateLabels[selectedNode.memory.studyState]}</strong><br />{selectedNode.memory.studyPasses ?? 0} ejercicios aprobados registrados. Su presencia en el volumen no habilita su uso en conversación.</p>}
        {selectedNode?.memory && <><p className="review-note">Importancia: {selectedNode.memory.importance === null ? "sin evaluar" : `${selectedNode.memory.importance}/5`}. {selectedNode.memory.affects.length ? "Asociación emocional revisada" : "Sin evaluación emocional vigente"}.</p>{selectedNode.memory.affects.map(item => <p className="review-note" key={item.emotion}><strong>{affectPalette.find(c => c.id === item.emotion)?.label} · {Math.round(item.intensity * 100)}%</strong><br />“{item.evidence}”</p>)}</>}
        <div className={`volume-node-inspector ${selectedNode ? "selected" : "idle"}`} aria-live="polite">
          {selectedNode ? selectedNode.memory ? <><span>NODO DE MEMORIA</span><strong>{selectedNode.memory.label}</strong>{selectedNode.memory.content && <p className="neural-memory-content">{selectedNode.memory.content}</p>}<small>{layerLabels[selectedNode.memory.layer]} · {statusLabels[selectedNode.memory.status]} · {accessibilityLabels[selectedNode.memory.accessibility]}{selectedNode.memory.archived ? " · archivado" : ""}{selectedNode.memory.deletionScheduled ? " · eliminación programada" : ""}{selectedNode.memory.suppressed ? " · suprimido" : ""} · v{selectedNode.memory.version}</small><details className="observatory-provenance"><summary>Fuente y detalles técnicos</summary><code>{selectedNode.memory.id}</code><dl><div><dt>Versión</dt><dd>{selectedNode.memory.version}{selectedNode.memory.version > 1 ? " · reconsolidada" : " · original"}</dd></div><div><dt>Retención</dt><dd>{selectedNode.memory.deletionScheduled ? "espera gobernada antes de retiro" : "sin eliminación programada"}</dd></div><div><dt>Recuperación</dt><dd>{selectedNode.memory.archived ? "bloqueada por archivo reversible" : selectedNode.memory.suppressed ? "suprimida por el propietario" : accessibilityLabels[selectedNode.memory.accessibility]}</dd></div><div><dt>Estabilidad</dt><dd>{selectedNode.memory.storageStrength === null ? "sin métrica" : `${Math.round(selectedNode.memory.storageStrength * 100)}%`}</dd></div><div><dt>Recuperaciones</dt><dd>{selectedNode.memory.successfulRecalls}</dd></div><div><dt>Fuente</dt><dd>{selectedNode.memory.source ?? "no declarada"}</dd></div></dl></details></> : <><span>NODO DE PROCESO</span><strong>{selectedNode.label}</strong><small>{selectedNode.detail}</small><code>{selectedNode.id}</code></> : <><span>INSPECTOR TRAZABLE</span><strong>Seleccioná un nodo</strong><small>Un círculo abre un recuerdo real; un rombo explica el latido del núcleo, una señal R3 o la recuperación actual. La selección conserva el contexto y atenúa únicamente los elementos no relacionados.</small></>}
        </div>
        {selectedAssociations.length > 0 && <section className="observatory-associations" aria-label="Evidencia de asociaciones confirmadas">
          <header><strong>ASOCIACIONES CONFIRMADAS</strong><span>{selectedAssociations.length} relacionada{selectedAssociations.length === 1 ? "" : "s"}</span></header>
          {selectedAssociations.map((association) => <details key={association.id}>
            <summary>Abrir evidencia de la relación</summary>
            <p>Decisión confirmada por vos. Las citas pertenecen al campo original de cada recuerdo y siguen vigentes.</p>
            {association.evidence.map((item) => {
              const memory = graph.nodes.find((node) => node.memory?.id === item.recordId)?.memory;
              const quote = memory ? resolveKnowledgeGraphEvidenceQuote(memory.label, item.startByte, item.endByte) : null;
              return <blockquote key={item.recordId}><strong>{memory?.label ?? item.recordId}</strong><span>{quote ? `“${quote}”` : "La fuente ya no coincide con la posición validada."}</span><small>intención · v{item.recordVersion} · bytes {item.startByte}–{item.endByte}</small></blockquote>;
            })}
            <code>{association.id}</code>
          </details>)}
        </section>}
        <div className={`volume-affect-status ${hasAffectActivity ? "active" : "standby"}`} style={hasAffectActivity ? { "--affect-color": dominantAffect.color } as CSSProperties : undefined}><i /><span><strong>CAPA AFECTIVA</strong><small>{hasAffectActivity ? `${dominantAffect.label.toUpperCase()} · ${(dominantAffect.value * 100).toFixed(0)}%` : "10 CANALES · EN ESPERA"}</small></span></div>
        <div className="observatory-emotions"><header><strong>Paleta emocional</strong><span>Referencia · evaluación pendiente</span></header><div>{affectPalette.map(channel => <span key={channel.id}><i style={{ backgroundColor: channel.color }} />{channel.label}</span>)}</div></div>
      </aside>}
      </div>}
    </div>

    {hasVisual && <>
      <div className="volume-control-dock">
        <div className="volume-camera-controls" aria-label="Controles de cámara del volumen cognitivo"><div className="volume-camera-modes" role="group" aria-label="Modo de arrastre"><button className={interactionMode === "rotate" ? "selected" : ""} type="button" title="Girar al arrastrar" aria-pressed={interactionMode === "rotate"} onClick={() => chooseMode("rotate")}><InlineSvgIcon markup={rotateIcon} className="camera-control-icon" /><span>Girar</span></button><button className={interactionMode === "pan" ? "selected" : ""} type="button" title="Mover al arrastrar" aria-pressed={interactionMode === "pan"} onClick={() => chooseMode("pan")}><InlineSvgIcon markup={panIcon} className="camera-control-icon" /><span>Mover</span></button></div><div className="volume-camera-actions" role="group" aria-label="Zoom y restablecimiento"><button type="button" title="Alejar" aria-label="Alejar volumen" onClick={() => changeZoom(1 / 1.18)}><InlineSvgIcon markup={zoomOutIcon} className="camera-control-icon" /></button><output aria-label={`Zoom ${zoomPercent} por ciento`}>{zoomPercent}%</output><button type="button" title="Acercar" aria-label="Acercar volumen" onClick={() => changeZoom(1.18)}><InlineSvgIcon markup={zoomInIcon} className="camera-control-icon" /></button><button type="button" title="Restablecer vista" aria-label="Restablecer vista" onClick={resetCamera}><InlineSvgIcon markup={resetIcon} className="camera-control-icon" /></button></div></div>
        <button className="observatory-orbit" type="button" aria-pressed={orbit} disabled={reducedMotion} onClick={() => { orbitRef.current = !orbit; setOrbit(!orbit); }}>Órbita automática: {reducedMotion ? "movimiento reducido" : orbit ? motionPaused ? "activada · animación pausada" : "activada" : "pausada"}</button>
      </div>
      <div className="volume-stats-strip"><span className="volume-stats-growth">{graph.persistentNodeCount} REGISTROS · {snapshot.retrievedMemoryCount} RECUPERADOS · {graph.processNodeCount} PROCESOS · {graph.persistentAssociationCount} ASOCIACIONES CONFIRMADAS</span><div className="volume-stats-routes" aria-label="Evidencia del grafo"><span className="input"><i />R3 <strong>{activity?.windowEventCount ?? 0}</strong></span><span className="memory"><i />NODOS <strong>{graph.persistentNodeCount}</strong></span><span className="output"><i />ARISTAS <strong>{graph.edges.length}</strong></span></div><span className="volume-stats-help">{effectiveAssociationStatus === "loading" ? "LEYENDO RELACIONES LOCALES…" : effectiveAssociationStatus === "error" ? "RELACIONES NO DISPONIBLES · NODOS SIN ALTERAR" : effectiveAssociationStatus === "sourceChanged" ? "RELACIÓN OCULTA HASTA REVISAR SU FUENTE" : effectiveAssociationStatus === "normal" ? "VIOLETA · RELACIÓN CONFIRMADA" : graph.edges.some(edge=>edge.kind === "coLearning") ? "VERDE · ORIGEN COMPARTIDO" : "SIN RELACIONES CARGADAS"}&nbsp;&nbsp; · &nbsp;&nbsp;CLIC · INSPECCIONAR&nbsp;&nbsp; RUEDA · ZOOM&nbsp;&nbsp; ARRASTRAR · {interactionMode === "rotate" ? "GIRAR" : "MOVER"}&nbsp;&nbsp; DOBLE CLIC · RESTABLECER</span></div>
    </>}
    {hasVisual && <details className="volume-color-guide"><summary>Colores de los recuerdos</summary>
<div className="volume-layer-legend" aria-label="Capas de memoria"><span className="episodic"><i />episódica</span><span className="semantic"><i />semántica</span><span className="procedural"><i />procedimental</span><span className="preference"><i />preferencias</span><span className="self"><i />propietario</span><span className="unclassified"><i />sin clasificar</span></div>
      <p>Los colores distinguen tipos de memoria. Un recuerdo con una asociación emocional revisada puede usar ese color; al seleccionarlo puedes consultar su evidencia.</p>
    </details>}
    <VolumeSignalConsole signals={signals} mode={signalMode} paused={motionPaused} reducedMotion={reducedMotion} nowMs={displayNowMs} onModeChange={setSignalMode} onPauseChange={() => setMotionPaused(value => !value)} />
  </div>;
}
