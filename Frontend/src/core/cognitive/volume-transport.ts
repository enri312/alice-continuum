import { invoke } from "@tauri-apps/api/core";
import { startSerializedPolling } from "../shared/polling";
import { parseKnowledgeGraphVolumeProjection, type KnowledgeGraphVolumeState } from "../memory/knowledge-graph-volume";
import type { SelfStudySnapshot } from "../memory/self-study";
import type { BrainSnapshot } from "./brain";
import { parseCoreActivitySnapshot, type CoreActivitySnapshot } from "./core-activity";
import { buildCognitiveVolumeGraph, currentVolumeAssociations, type ConfirmedMemoryAssociation } from "./cognitive-volume";
import type { LearningArrival, mountVolumeScene } from "./volume-canvas";
import { buildVolumeLearningSnapshot, createVolumeLearningCheckpoint } from "./volume-learning";
import { projectLearningActivity, projectVolumeInspector, volumeActivityFrame, type VolumeLearningActivityState } from "./volume-projection";
import { buildVolumeSignalSnapshot } from "./volume-signals";

export type VolumeInputs = {
  snapshot: BrainSnapshot;
  desktopApp: boolean;
  learningReady: boolean;
  selfStudy?: SelfStudySnapshot | null;
  learningActivity?: VolumeLearningActivityState;
  onRefreshLearning: () => void;
};

export function createVolumeTransport(canvasId: string, readInput: () => VolumeInputs) {
  let reply: ((value: unknown) => void) | undefined;
  let disposed = false;
  let stopActivity: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let sourceKey: string | undefined;
  let sourceRevision = 0;
  let associationStatus: KnowledgeGraphVolumeState = "unavailable";
  let associations: readonly ConfirmedMemoryAssociation[] = [];
  let invalidatedCount = 0;
  let activity: CoreActivitySnapshot | null = null;
  let activityStatus: "loading" | "ready" | "unavailable" = "unavailable";
  let graph = buildCognitiveVolumeGraph([], null);
  let nodes = new Map(graph.nodes.map(node => [node.id, node]));
  let sourceNodes: BrainSnapshot["memoryNodes"] | undefined;
  let identity = "";
  let validAssociations: ConfirmedMemoryAssociation[] = [];
  let canvas: ReturnType<typeof mountVolumeScene>;
  let attaching = false;
  let arrivalBuffer: LearningArrival[] = [];
  let view: Parameters<NonNullable<typeof canvas>["setView"]>[0] = { demo: false, paused: false, reduced: false, orbit: false, mode: "rotate", selected: null };
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const formatClock = new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function sourceIdentity() {
    const memoryNodes = readInput().snapshot.memoryNodes;
    if (memoryNodes !== sourceNodes) {
      sourceNodes = memoryNodes;
      identity = JSON.stringify(memoryNodes.map(node => [node.id, node.version, node.label, node.content ?? null])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
    }
    return identity;
  }

  function publishSignals() {
    const nowMs = Date.now();
    const signals = buildVolumeSignalSnapshot(activity, activityStatus === "ready", nowMs);
    if (view.reduced !== preference.matches) {
      view = { ...view, reduced: preference.matches };
      canvas?.setView(view);
    }
    canvas?.setSignals(signals.animatable, new Set(signals.routes.filter(route => route.animatable).map(route => route.id)));
    canvas?.updateArrivals([]);
    reply?.({ type: "signals", nowMs, signals, reduced: preference.matches });
  }

  function projectSelected() {
    const selected = view.selected ? nodes.get(view.selected) : undefined;
    return selected ? projectVolumeInspector(selected, new Map(readInput().snapshot.memoryNodes.map(memory => [memory.id, memory])), validAssociations) : null;
  }

  function publishGraph() {
    const { snapshot, selfStudy, learningReady, learningActivity } = readInput();
    validAssociations = currentVolumeAssociations(snapshot.memoryNodes, associations);
    const locallyInvalidated = associations.length - validAssociations.length;
    const graphStatus = locallyInvalidated ? "sourceChanged" : associationStatus;
    graph = buildCognitiveVolumeGraph(snapshot.memoryNodes, activity, validAssociations, activityStatus === "ready");
    nodes = new Map(graph.nodes.map(node => [node.id, node]));
    if (view.selected && !nodes.has(view.selected)) {
      view = { ...view, selected: null };
      canvas?.setView(view);
    }
    canvas?.setGraph(graph);
    const dominant = snapshot.affectChannels.filter(channel => channel.availability === "ready" && channel.value > .001)
      .reduce<(typeof snapshot.affectChannels)[number] | undefined>((highest, channel) => !highest || channel.value > highest.value ? channel : highest, undefined);
    const study = selfStudy?.records;
    const checkpoint = learningReady ? createVolumeLearningCheckpoint(snapshot.memoryNodes) : null;
    const nowMs = Date.now();
    reply?.({
      type: "projection", projection: {
        frame: volumeActivityFrame(activity, activityStatus), nodes: graph.nodes.map(({ id, label }) => ({ id, label })),
        totals: {
          records: graph.persistentNodeCount, retrieved: snapshot.retrievedMemoryCount, processes: graph.processNodeCount,
          associations: graph.persistentAssociationCount, edges: graph.edges.length,
          sharedOrigin: graph.edges.some(edge => edge.kind === "coLearning"),
        },
        graphStatus, invalidatedCount: Math.max(invalidatedCount, locallyInvalidated),
        byOrigin: buildVolumeLearningSnapshot(snapshot.memoryNodes).byOrigin,
        study: study ? {
          available: study.filter(record => record.active && record.lastPassed && record.passes > 0).length,
          attempts: study.reduce((sum, record) => sum + record.attempts, 0),
        } : null,
        learningActivity: learningActivity ? projectLearningActivity(learningActivity) : null,
        selected: projectSelected(), learningReady,
        checkpoint: checkpoint ? Object.entries(checkpoint).map(([id, token]) => ({ id, token, label: nodes.get(`memory:${id}`)?.label ?? id })) : null,
        dominant: dominant ? { color: dominant.color, label: `${dominant.label.toUpperCase()} · ${(dominant.value * 100).toFixed(0)}%` } : null,
        timestamp: { nowMs, clockLabel: formatClock.format(nowMs), isoTime: new Date(nowMs).toISOString() },
      },
    });
    publishSignals();
  }

  function refreshSources(force = false) {
    if (disposed || !reply) return;
    const { desktopApp } = readInput();
    const key = sourceIdentity();
    if (desktopApp && (force || key !== sourceKey)) {
      sourceKey = key;
      const revision = ++sourceRevision;
      associations = [];
      invalidatedCount = 0;
      associationStatus = "loading";
      void Promise.all([invoke<unknown>("knowledge_graph_snapshot"), invoke<unknown>("knowledge_graph_associations")])
        .then(([snapshot, status]) => {
          if (disposed || revision !== sourceRevision || key !== sourceIdentity()) return;
          const data = parseKnowledgeGraphVolumeProjection(snapshot, status);
          associations = data.associations;
          invalidatedCount = data.invalidatedAssociationCount;
          associationStatus = data.state;
          publishGraph();
        }).catch(() => {
          if (disposed || revision !== sourceRevision || key !== sourceIdentity()) return;
          associationStatus = "error";
          publishGraph();
        });
    }
    publishGraph();
  }

  async function attachCanvas() {
    if (attaching || canvas || disposed) return;
    const element = document.getElementById(canvasId);
    if (!(element instanceof HTMLCanvasElement)) return;
    attaching = true;
    try {
      const { mountVolumeScene } = await import("./volume-canvas");
      if (disposed || !element.isConnected) return;
      canvas = mountVolumeScene(element, graph, id => reply?.({ type: "picked", id }), percent => reply?.({ type: "zoom", percent }));
      if (!canvas) throw new Error("Canvas 2D no disponible");
      canvas.setView(view);
      canvas.updateArrivals(arrivalBuffer);
      arrivalBuffer = [];
      publishSignals();
    } catch {
      if (!disposed) reply?.({ type: "canvasError" });
    } finally { attaching = false; }
  }

  return {
    refreshSources,
    dispatch(raw: string, respond: (value: unknown) => void) {
      if (disposed) return;
      let action;
      try { action = JSON.parse(raw); } catch { return; }
      switch (action?.type) {
        case "connect":
          if (reply) return;
          reply = respond;
          preference.addEventListener("change", publishSignals);
          timer = setInterval(publishSignals, 1_000);
          if (readInput().desktopApp) {
            activityStatus = "loading";
            stopActivity = startSerializedPolling({
              intervalMs: 5_000,
              read: () => invoke("core_activity_snapshot").then(parseCoreActivitySnapshot),
              onValue: parsed => { activity = parsed; activityStatus = "ready"; refreshSources(); },
              onError: () => { activity = null; activityStatus = "unavailable"; refreshSources(); },
            });
          }
          refreshSources();
          break;
        case "attachCanvas": void attachCanvas(); break;
        case "refresh":
          readInput().onRefreshLearning();
          if (associationStatus === "error") refreshSources(true);
          break;
        case "view":
          view = {
            demo: action.demo === true, paused: action.paused === true, reduced: preference.matches,
            orbit: action.orbit === true, mode: action.pan === true ? "pan" : "rotate",
            selected: typeof action.selected === "string" && nodes.has(action.selected) ? action.selected : null,
          };
          canvas?.setView(view);
          if (action.focus === true) canvas?.focus();
          if (action.inspect === true) respond({ type: "inspector", id: view.selected, detail: projectSelected() });
          break;
        case "arrivals":
          if (canvas) canvas.updateArrivals(action.changes);
          else arrivalBuffer = action.changes;
          break;
        case "zoomIn": canvas?.zoomIn(); break;
        case "zoomOut": canvas?.zoomOut(); break;
        case "reset": canvas?.resetCamera(); break;
      }
    },
    dispose() {
      disposed = true;
      reply = undefined;
      stopActivity?.();
      clearInterval(timer);
      preference.removeEventListener("change", publishSignals);
      canvas?.dispose();
    },
  };
}
