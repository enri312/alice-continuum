export type AffectId = "joy" | "sadness" | "anger" | "fear" | "disgust" | "anxiety" | "envy" | "ennui" | "embarrassment" | "nostalgia";

export type AffectDefinition = {
  id: AffectId;
  label: string;
  color: `#${string}`;
  rgb: readonly [number, number, number];
  role: string;
};

export type AffectChannel = AffectDefinition & {
  value: number;
  availability: "planned" | "ready";
};

// Paleta afectiva propia de Alice basada en asociaciones cromáticas populares.
// Define canales de diagnóstico; no copia personajes ni implica una emoción activa.
export const affectPalette: readonly AffectDefinition[] = [
  { id: "joy", label: "Alegría", color: "#FFD84D", rgb: [255, 216, 77], role: "recompensa y valencia positiva" },
  { id: "sadness", label: "Tristeza", color: "#4AA8FF", rgb: [74, 168, 255], role: "pérdida, pausa y solicitud de apoyo" },
  { id: "anger", label: "Ira", color: "#F04444", rgb: [240, 68, 68], role: "obstáculo, límite y conflicto" },
  { id: "fear", label: "Temor", color: "#9A6BFF", rgb: [154, 107, 255], role: "riesgo inmediato y evitación" },
  { id: "disgust", label: "Desagrado", color: "#78D64B", rgb: [120, 214, 75], role: "rechazo y protección de preferencias" },
  { id: "anxiety", label: "Ansiedad", color: "#FF8A3D", rgb: [255, 138, 61], role: "anticipación de resultados negativos" },
  { id: "envy", label: "Envidia", color: "#45D6C6", rgb: [69, 214, 198], role: "comparación y deseo de adquisición" },
  { id: "ennui", label: "Aburrimiento", color: "#4F56A6", rgb: [79, 86, 166], role: "baja novedad y baja implicación" },
  { id: "embarrassment", label: "Vergüenza", color: "#F39AB8", rgb: [243, 154, 184], role: "exposición social y autocorrección" },
  { id: "nostalgia", label: "Nostalgia", color: "#B9A0AA", rgb: [185, 160, 170], role: "recuerdo autobiográfico con valencia mixta" },
] as const;

export function createPlannedAffectChannels(): AffectChannel[] {
  return affectPalette.map((definition) => ({ ...definition, value: 0, availability: "planned" }));
}

export type MemoryAffect = { emotion: AffectId; intensity: number; evidence: string };

const explicitMarkers: Record<AffectId, readonly string[]> = {
  joy: ["feliz", "felicidad", "alegre", "alegría", "alegra", "alegro", "alegró", "alegran", "alegraron", "alegraba", "contento", "contenta", "encantado", "encantada", "encanta", "encantan", "happy", "glad"],
  sadness: ["triste", "tristeza", "pena", "desanimado", "desanimada", "sad"],
  anger: ["enojado", "enojada", "enojo", "furioso", "furiosa", "rabia", "ira", "molesto", "molesta", "angry"],
  fear: ["miedo", "temor", "asustado", "asustada", "aterrorizado", "aterrorizada", "afraid", "scared"],
  disgust: ["asco", "repulsión", "repulsion", "repugnancia", "disgustado", "disgustada", "disgusted"],
  anxiety: ["ansiedad", "ansioso", "ansiosa", "nervioso", "nerviosa", "preocupado", "preocupada", "preocupación", "anxious", "worried"],
  envy: ["envidia", "envidioso", "envidiosa", "envy", "jealous"],
  ennui: ["aburrido", "aburrida", "aburrimiento", "apatía", "apatia", "bored", "boredom"],
  embarrassment: ["vergüenza", "verguenza", "avergonzado", "avergonzada", "embarrassed", "ashamed"],
  nostalgia: ["nostalgia", "nostálgico", "nostalgico", "nostálgica", "nostalgica", "nostalgic"],
};

function hasExplicitEmotion(emotion: AffectId, evidence: string): boolean {
  const words = evidence.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some((word, index) => explicitMarkers[emotion].includes(word)
    && !words.slice(Math.max(0, index - 3), index).some(previous => ["no", "nunca", "jamás", "jamas", "sin", "not", "never"].includes(previous)));
}

export function parseMemoryAffects(value: unknown, source?: string): MemoryAffect[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) throw new Error("Evaluación emocional inválida");
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== "object" || !affectPalette.some(c => c.id === item.emotion)
      || seen.has(item.emotion) || typeof item.intensity !== "number" || !Number.isFinite(item.intensity)
      || item.intensity <= 0 || item.intensity > 1 || typeof item.evidence !== "string"
      || !item.evidence.trim() || [...item.evidence].length > 240
      || (source !== undefined && !source.includes(item.evidence))
      || !hasExplicitEmotion(item.emotion, item.evidence)) throw new Error("Emoción sin evidencia literal válida");
    seen.add(item.emotion);
    return { emotion: item.emotion, intensity: item.intensity, evidence: item.evidence };
  });
}
