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
