export type CognitiveMemoryLayer = "episodic" | "semantic" | "procedural" | "preference" | "self" | "unclassified";
export type CognitiveMemoryStatus = "confirmed" | "conflict" | "archived" | "historical";

export type CognitiveMemoryInput = {
  id?: string;
  kind?: string;
  intention: string;
  memoryType?: "semantic" | "procedural" | "preference" | "episodic";
  source?: string;
  importance?: number;
  storageStrength?: number;
  memoryStatus?: "confirmed" | "conflict" | "archived";
  accessibilityStatus?: "accessible" | "dormant";
  suppressionStatus?: "suppressed";
  memoryVersion?: number;
  successfulRecalls?: number;
  successfulReviews?: number;
};

export type CognitiveMemoryNode = {
  id: string;
  label: string;
  layer: CognitiveMemoryLayer;
  status: CognitiveMemoryStatus;
  accessibility: "notAssessed" | "accessible" | "dormant";
  suppressed: boolean;
  version: number;
  source: string | null;
  storageStrength: number | null;
  importance: number | null;
  successfulRecalls: number;
  successfulReviews: number;
  retrieved: boolean;
  x: number;
  y: number;
  z: number;
};

const layerCenters: Record<CognitiveMemoryLayer, readonly [number, number, number]> = {
  episodic: [-0.48, 0.05, -0.05],
  semantic: [0, 0.2, 0],
  procedural: [0.48, -0.02, 0.04],
  preference: [-0.12, -0.48, 0.06],
  self: [0.08, 0.52, -0.03],
  unclassified: [0, 0, 0],
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function finiteRange(value: number | undefined, minimum: number, maximum: number) {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, value));
}

function nonNegativeInteger(value: number | undefined) {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

function stableHash(value: string, seed: number) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 4294967295;
}

export function resolveCognitiveMemoryLayer(memory: CognitiveMemoryInput): CognitiveMemoryLayer {
  if (memory.kind === "Perfil") return "self";
  if (memory.memoryType) return memory.memoryType;
  if (memory.kind === "Conversación") return "episodic";
  return "unclassified";
}

export function resolveCognitiveMemoryStatus(memory: CognitiveMemoryInput): CognitiveMemoryStatus {
  return memory.memoryStatus ?? "historical";
}

/**
 * Crea una proyección visual: cada nodo conserva el ID de un registro real.
 * Las coordenadas son sólo una distribución determinista por capa y no declaran
 * anatomía, asociación semántica ni actividad neuronal biológica.
 */
export function buildCognitiveMemoryNodes(memories: CognitiveMemoryInput[], retrievedMemoryIds: string[] = []): CognitiveMemoryNode[] {
  const retrieved = new Set(retrievedMemoryIds);
  const seen = new Set<string>();
  const nodes: CognitiveMemoryNode[] = [];
  for (const memory of memories) {
    const id = memory.id?.trim();
    const label = memory.intention.trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    const layer = resolveCognitiveMemoryLayer(memory);
    const status = resolveCognitiveMemoryStatus(memory);
    const center = layerCenters[layer];
    const angle = stableHash(id, 17) * Math.PI * 2;
    const radial = 0.08 + Math.sqrt(stableHash(id, 41)) * 0.24;
    const depth = (stableHash(id, 73) * 2 - 1) * 0.32;
    const strength = finiteRange(memory.storageStrength, 0, 1);
    const importance = finiteRange(memory.importance, 1, 5);
    nodes.push({
      id,
      label,
      layer,
      status,
      accessibility: memory.accessibilityStatus ?? "notAssessed",
      suppressed: memory.suppressionStatus === "suppressed",
      version: Number.isSafeInteger(memory.memoryVersion) && (memory.memoryVersion ?? 0) >= 2 ? memory.memoryVersion! : 1,
      source: memory.source?.trim() || null,
      storageStrength: strength === null ? null : clamp01(strength),
      importance,
      successfulRecalls: nonNegativeInteger(memory.successfulRecalls),
      successfulReviews: nonNegativeInteger(memory.successfulReviews),
      retrieved: status !== "archived" && status !== "conflict" && memory.accessibilityStatus !== "dormant" && memory.suppressionStatus !== "suppressed" && retrieved.has(id),
      x: Number((center[0] + Math.cos(angle) * radial).toFixed(6)),
      y: Number((center[1] + Math.sin(angle) * radial * 0.72).toFixed(6)),
      z: Number((center[2] + depth).toFixed(6)),
    });
  }
  return nodes;
}
