import { describe, expect, it } from "vitest";
import { isAddressedToAlice, isMicrophoneOffCommand, isVoiceStopCommand } from "./voice-commands";

describe("orden directa para detener la sesión", () => {
  it.each([
    "detén la conversación Alice", "¡DETÉN LA CONVERSACIÓN, ALICE!",
    "Alice, detén la conversación.", "Por favor, Alice, detén esta conversación",
    "Alice, termina la conversación por favor", "Para la conversación",
    "Detén por favor la conversación, Alice", "Finaliza la conversación",
    "Detend la conversación, Alice.", "Alice, detend la conversación por favor",
  ])("reconoce %s", text => expect(isVoiceStopCommand(text)).toBe(true));

  it.each([
    "No detengas la conversación Alice", "No quiero que pares la conversación",
    'Dije "detén la conversación Alice" como ejemplo', '"detén la conversación Alice"',
    "Mi hermana le dijo a Alice que detenga la conversación", "Detén la música Alice",
    "¿Qué pasa si digo detén la conversación Alice?", "Cuando diga detén la conversación Alice quiero que pares",
    "Quiero continuar la conversación Alice", "", "Alice, explica cómo detener la conversación",
    "No detend la conversación Alice", "Si digo detend la conversación Alice", '"Detend la conversación Alice"',
  ])("conserva como conversación: %s", text => expect(isVoiceStopCommand(text)).toBe(false));
});

describe("dirección explícita con otras voces de fondo", () => {
  it.each(["Alice, abre Spotify", "¡Hola, Alice! ¿Me escuchas?", "Oye Alice, baja el ruido", "Por favor, Alice, explícame esto", "¿Me escuchas, Alice?", "Reproduce mi música, Alice", "Dime, Alice", '¿Qué significa "hola", Alice?', "Alice, ¿qué dijo Marta?"])("admite %s", text => expect(isAddressedToAlice(text)).toBe(true));
  it.each(["Esta canción habla de Alice", '"Alice, abre Spotify"', "Cuando diga Alice responde", "Alicia es mi amiga", "", "Hola a todos", "Alice es una asistente", "Alice me dijo hola", "Quiero hablar con Alice", "¿Puedes preguntarle a Alice?", "Me gusta Alice", 'Marta dijo: "abre Spotify, Alice"', "Me preguntó si me escuchas, Alice"])("ignora %s", text => expect(isAddressedToAlice(text)).toBe(false));
});

describe("apagado explícito del micrófono", () => {
  it.each(["Apaga el micrófono, Alice", "Alice, desactiva el micro", "Por favor, Alice, cierra mi micrófono", "Deja de escuchar, Alice", "Apaga por favor el micrófono"])("apaga con %s", text => expect(isMicrophoneOffCommand(text)).toBe(true));
  it.each(["No apagues el micrófono", 'Dije "apaga el micrófono Alice"', "¿Qué pasa si apaga el micrófono Alice?", "Detén la conversación Alice", "Apaga Spotify Alice", "Alice, explica cómo apagar el micrófono"])("no apaga con %s", text => expect(isMicrophoneOffCommand(text)).toBe(false));
});
