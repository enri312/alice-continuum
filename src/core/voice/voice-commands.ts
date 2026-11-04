// Match an entire direct request, never a keyword inside a quotation or story.
// This is session control, so it runs before conversational inference and TTS.
export function isVoiceStopCommand(text: string): boolean {
  if (/["'«»“”‘’]/u.test(text)) return false;
  const command = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[.,;:!?¡¿]/gu, " ").replace(/\s+/gu, " ").trim();
  return /^(?:alice )?(?:por favor )?(?:alice )?(?:deten|detener|para|termina|finaliza|cancela) (?:por favor )?(?:la|esta) conversacion(?: alice)?(?: por favor)?$/.test(command);
}

// Optional noisy-room mode: a direct address, not an arbitrary mention in a story.
export function isAddressedToAlice(text: string): boolean {
  if (/^[\s¡¿.,:;!?]*["'«“‘]/u.test(text)) return false;
  const words = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[.,;:!?¡¿]/gu, " ").replace(/\s+/gu, " ").trim();
  return /^(?:(?:hola|oye|ey|hey|disculpa|por favor) )?alice(?: |$)/u.test(words);
}
