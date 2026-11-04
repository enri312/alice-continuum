import { describe, expect, it } from "vitest";
import { isAddressedToAlice, isVoiceStopCommand } from "./voice-commands";

describe("orden directa para detener la sesión", () => {
  it.each([
    "detén la conversación Alice", "¡DETÉN LA CONVERSACIÓN, ALICE!",
    "Alice, detén la conversación.", "Por favor, Alice, detén esta conversación",
    "Alice, termina la conversación por favor", "Para la conversación",
    "Detén por favor la conversación, Alice", "Finaliza la conversación",
  ])("reconoce %s", text => expect(isVoiceStopCommand(text)).toBe(true));

  it.each([
    "No detengas la conversación Alice", "No quiero que pares la conversación",
    'Dije "detén la conversación Alice" como ejemplo', '"detén la conversación Alice"',
    "Mi hermana le dijo a Alice que detenga la conversación", "Detén la música Alice",
    "¿Qué pasa si digo detén la conversación Alice?", "Cuando diga detén la conversación Alice quiero que pares",
    "Quiero continuar la conversación Alice", "", "Alice, explica cómo detener la conversación",
  ])("conserva como conversación: %s", text => expect(isVoiceStopCommand(text)).toBe(false));
});

describe("dirección explícita opcional con otras voces de fondo", () => {
  it.each(["Alice, abre Spotify", "¡Hola, Alice! ¿Me escuchas?", "Oye Alice, baja el ruido", "Por favor, Alice, explícame esto"])("admite %s", text => expect(isAddressedToAlice(text)).toBe(true));
  it.each(["Esta canción habla de Alice", '"Alice, abre Spotify"', "Cuando diga Alice responde", "Alicia es mi amiga", "", "Hola a todos"])("ignora %s", text => expect(isAddressedToAlice(text)).toBe(false));
});
