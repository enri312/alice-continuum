import type { BrainGroup } from "./brain";

export type NeuralRgb = readonly [number, number, number];
export type NeuralLayer = "cortex" | "association";

const inactiveColor: NeuralRgb = [66, 88, 108];
const activeGroupColors: Record<BrainGroup, NeuralRgb> = {
  input: [45, 212, 191],
  memory: [56, 189, 248],
  output: [251, 191, 36],
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Convierte la distancia al centro en un umbral de aparición estable.
 * Los puntos internos aparecen primero y la asociación central precede a la corteza.
 */
export function compactGrowthReveal(layer: NeuralLayer, radialFraction: number, jitter: number): number {
  const radius = clamp01(radialFraction);
  const noise = clamp01(jitter);
  const layerDelay = layer === "cortex" ? 0.025 : 0;
  const layerScale = layer === "cortex" ? 0.9 : 0.72;
  return clamp01(layerDelay + radius * layerScale + noise * 0.055);
}

/** Un recuerdo persistente equivale como máximo a un ancla visible. */
export function visibleMemoryAnchorCount(memoryCount: number, capacity: number): number {
  if (!Number.isFinite(memoryCount) || !Number.isFinite(capacity)) return 0;
  return Math.min(Math.max(0, Math.floor(memoryCount)), Math.max(0, Math.floor(capacity)));
}

/**
 * Los colores afectivos solo pueden entrar al volumen cuando el canal está listo
 * y aporta una señal positiva. En reposo la estructura permanece neutra.
 */
export function resolveNeuralColor(
  group: BrainGroup,
  active: boolean,
  affectValue: number,
  affectReady: boolean,
  affectColor: NeuralRgb,
): NeuralRgb {
  if (affectReady && affectValue > 0.001) return affectColor;
  return active ? activeGroupColors[group] : inactiveColor;
}
