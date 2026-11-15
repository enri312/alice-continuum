import type { BrainSnapshot } from "../cognitive/brain";

export type ConversationBehaviorSettings = { creativity: number; empathy: number };
export type ConversationBehaviorKey = keyof ConversationBehaviorSettings;

export const DEFAULT_CONVERSATION_BEHAVIOR: Readonly<ConversationBehaviorSettings> = Object.freeze({ creativity: 0.2, empathy: 0.5 });

export function supportsConversationBehavior(provider: string) {
  return provider === "llamacpp" || provider === "ollama";
}

export function behaviorKeyForControl(id: string): ConversationBehaviorKey | undefined {
  if (id === "control-creativity") return "creativity";
  if (id === "control-empathy") return "empathy";
  return undefined;
}

export function updateConversationBehavior(current: ConversationBehaviorSettings, key: ConversationBehaviorKey, value: number): ConversationBehaviorSettings {
  if (!Number.isFinite(value) || value < 0 || value > 1) return current;
  return { ...current, [key]: Math.round(value * 100) / 100 };
}

export function applyConversationBehavior(snapshot: BrainSnapshot, settings: ConversationBehaviorSettings, supported: boolean, busy = false): BrainSnapshot {
  return { ...snapshot, behaviorControls: snapshot.behaviorControls.map(control => {
    const key = behaviorKeyForControl(control.id);
    if (!key) return control;
    const detail = !supported
      ? "Disponible para Gemma y Ollama locales. Este ajuste no se aplica al proveedor actual."
      : key === "creativity"
        ? `Temperatura de generación conversacional: ${settings.creativity.toFixed(2)}. Se aplica al próximo envío; no cambia el reconocimiento de voz ni las órdenes de aplicaciones.`
        : `Tono para el próximo envío: ${settings.empathy < 1 / 3 ? "directo y práctico" : settings.empathy > 2 / 3 ? "más atento al contexto emocional" : "estilo habitual"}. Tres tramos de estilo que mantienen respeto, personalidad y límites; no representa una emoción de Alice.`;
    return { ...control, availability: "ready" as const, locked: !supported || busy, value: supported ? settings[key] : 0, detail: busy ? `${detail} Hay una respuesta en curso; espera a que termine para modificarlo.` : detail };
  }) };
}
