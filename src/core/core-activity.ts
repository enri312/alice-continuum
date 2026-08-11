import type { BrainSnapshot } from "./brain";

export type CoreActivityRegionId = "perception" | "permission" | "memory" | "language" | "workspace" | "output" | "motor";
export type CoreActivityLinkId = "permission-perception" | "perception-workspace" | "memory-workspace" | "language-workspace" | "workspace-output";

export type CoreActivityRegion = {
  id: CoreActivityRegionId;
  label: string;
  eventCount: number;
  signal: number;
  lastEventAtMs: number | null;
};

export type CoreActivityLink = {
  id: CoreActivityLinkId;
  from: CoreActivityRegionId;
  to: CoreActivityRegionId;
  evidenceCount: number;
  signal: number;
};

export type CoreActivitySnapshot = {
  schemaVersion: 2;
  generatedAtMs: number;
  method: "r3-recency-motor-v2";
  heuristic: true;
  windowMs: number;
  auditHealthy: boolean;
  visibleEventCount: number;
  windowEventCount: number;
  latestEventAtMs: number | null;
  overallSignal: number;
  regions: CoreActivityRegion[];
  links: CoreActivityLink[];
};

const regionIds: CoreActivityRegionId[] = ["perception", "permission", "memory", "language", "workspace", "output", "motor"];
const linkDefinitions: Record<CoreActivityLinkId, [CoreActivityRegionId, CoreActivityRegionId]> = {
  "permission-perception": ["permission", "perception"],
  "perception-workspace": ["perception", "workspace"],
  "memory-workspace": ["memory", "workspace"],
  "language-workspace": ["language", "workspace"],
  "workspace-output": ["workspace", "output"],
};
const linkIds = Object.keys(linkDefinitions) as CoreActivityLinkId[];
const snapshotKeys = ["schemaVersion", "generatedAtMs", "method", "heuristic", "windowMs", "auditHealthy", "visibleEventCount", "windowEventCount", "latestEventAtMs", "overallSignal", "regions", "links"];
const regionKeys = ["id", "label", "eventCount", "signal", "lastEventAtMs"];
const linkKeys = ["id", "from", "to", "evidenceCount", "signal"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function timestampOrNull(value: unknown): value is number | null {
  return value === null || (count(value) && value > 0);
}

function signal(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseRegion(value: unknown): CoreActivityRegion {
  if (!isObject(value)
    || !exactKeys(value, regionKeys)
    || !regionIds.includes(value.id as CoreActivityRegionId)
    || typeof value.label !== "string" || !value.label.trim() || value.label.length > 80
    || !count(value.eventCount)
    || !signal(value.signal)
    || !timestampOrNull(value.lastEventAtMs)
    || (value.eventCount === 0) !== (value.signal === 0)
    || (value.eventCount === 0) !== (value.lastEventAtMs === null)) {
    throw new Error("Región de actividad R3 inválida");
  }
  return value as CoreActivityRegion;
}

function parseLink(value: unknown): CoreActivityLink {
  if (!isObject(value)
    || !exactKeys(value, linkKeys)
    || !linkIds.includes(value.id as CoreActivityLinkId)
    || !regionIds.includes(value.from as CoreActivityRegionId)
    || !regionIds.includes(value.to as CoreActivityRegionId)
    || !count(value.evidenceCount)
    || !signal(value.signal)
    || (value.evidenceCount === 0) !== (value.signal === 0)) {
    throw new Error("Enlace de actividad R3 inválido");
  }
  const [from, to] = linkDefinitions[value.id as CoreActivityLinkId];
  if (value.from !== from || value.to !== to) throw new Error("Topología de actividad R3 incoherente");
  return value as CoreActivityLink;
}

export function parseCoreActivitySnapshot(value: unknown): CoreActivitySnapshot {
  if (!isObject(value)
    || !exactKeys(value, snapshotKeys)
    || value.schemaVersion !== 2
    || !count(value.generatedAtMs) || value.generatedAtMs === 0
    || value.method !== "r3-recency-motor-v2"
    || value.heuristic !== true
    || !count(value.windowMs) || value.windowMs === 0
    || typeof value.auditHealthy !== "boolean"
    || !count(value.visibleEventCount)
    || !count(value.windowEventCount) || value.windowEventCount > value.visibleEventCount
    || !timestampOrNull(value.latestEventAtMs)
    || !signal(value.overallSignal)
    || !Array.isArray(value.regions)
    || !Array.isArray(value.links)) {
    throw new Error("Snapshot de actividad R3 inválido");
  }
  const regions = value.regions.map(parseRegion);
  const links = value.links.map(parseLink);
  if (regions.length !== regionIds.length
    || links.length !== linkIds.length
    || new Set(regions.map((item) => item.id)).size !== regionIds.length
    || new Set(links.map((item) => item.id)).size !== linkIds.length
    || regionIds.some((id) => !regions.some((region) => region.id === id))
    || linkIds.some((id) => !links.some((link) => link.id === id))
    || (value.windowEventCount === 0) !== (value.overallSignal === 0)
    || (value.windowEventCount === 0) !== (value.latestEventAtMs === null)) {
    throw new Error("Cobertura de actividad R3 incoherente");
  }
  return { ...value, regions, links } as CoreActivitySnapshot;
}

export function applyCoreActivitySnapshot(base: BrainSnapshot, activity: CoreActivitySnapshot | null): BrainSnapshot {
  const regions = new Map(activity?.regions.map((region) => [region.id, region]));
  const region = (id: CoreActivityRegionId) => regions.get(id);
  const activationByFlowId: Record<string, CoreActivityRegionId | null> = {
    "flow-input": "perception",
    "flow-language": "language",
    "flow-memory": "memory",
    "flow-social": null,
    "flow-self": null,
    "flow-affect": null,
    "flow-inhibition": "permission",
    "flow-workspace": "workspace",
    "flow-response": "output",
    "flow-face": null,
    "flow-body": "motor",
  };
  const hasRecentActivity = Boolean(activity?.windowEventCount);
  const hasStructure = base.persistentMemoryCount > 0;
  const overallSignal = activity?.overallSignal ?? 0;
  const flowNodes = base.flowNodes.map((node) => {
    const regionId = activationByFlowId[node.id];
    const evidence = regionId ? region(regionId) : undefined;
    if (!evidence) return { ...node, activation: 0 };
    return {
      ...node,
      activation: evidence.signal,
      value: evidence.eventCount ? `${evidence.eventCount} eventos R3` : "sin señal reciente",
      detail: evidence.eventCount
        ? `${evidence.label}: ${evidence.eventCount} eventos técnicos dentro de la ventana. Intensidad heurística ${evidence.signal.toFixed(3)}.`
        : `${evidence.label}: no hay eventos R3 dentro de la ventana temporal.`,
    };
  });
  const stateMetrics = base.stateMetrics.map((metric) => {
    const evidence = metric.id === "state-inhibition" ? region("permission") : metric.id === "state-memory" ? region("memory") : undefined;
    return evidence ? { ...metric, value: evidence.signal, detail: `${evidence.label}: señal técnica derivada de ${evidence.eventCount} eventos R3 recientes; no representa una emoción.` } : { ...metric, value: 0 };
  });
  const behaviorControls = base.behaviorControls.map((control) => control.id === "control-inhibition"
    ? { ...control, value: region("permission")?.signal ?? 0, detail: "Señal técnica de actividad reciente del Gateway; permanece bloqueada y no representa voluntad." }
    : { ...control, value: 0 });

  return {
    ...base,
    hasActivity: hasStructure || hasRecentActivity,
    neuralDensity: Math.min(0.96, base.persistentNeuralDensity + overallSignal * 0.18),
    currentNeuralActivity: overallSignal,
    focusStatus: hasRecentActivity ? "actividad R3 reciente" : "sin eventos R3 recientes",
    focusDetail: hasRecentActivity
      ? `${activity?.windowEventCount} eventos técnicos en ${Math.round((activity?.windowMs ?? 0) / 60_000)} minutos; intensidad heurística ${overallSignal.toFixed(3)}.`
      : "No existen eventos R3 dentro de la ventana temporal. La estructura persistente, si existe, permanece separada.",
    flowNodes,
    stateMetrics,
    behaviorControls,
  };
}
