function directCommand(text: string): string | null {
  if (/["'«»“”‘’]/u.test(text)) return null;
  return normalize(text);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[.,;:!?¡¿]/gu, " ").replace(/\s+/gu, " ").trim();
}

// Match the entire request before inference/TTS. "Detend" is the observed ASR
// spelling; it is accepted only inside this bounded conversation-control grammar.
export function isVoiceStopCommand(text: string): boolean {
  const command = directCommand(text);
  return command !== null && /^(?:alice )?(?:por favor )?(?:alice )?(?:deten|detend|detener|para|termina|finaliza|cancela) (?:por favor )?(?:la|esta) conversacion(?: alice)?(?: por favor)?$/.test(command);
}

export function isMicrophoneOffCommand(text: string): boolean {
  const command = directCommand(text);
  return command !== null && /^(?:alice )?(?:por favor )?(?:alice )?(?:(?:apaga|apagar|desactiva|desactivar|cierra|cerrar) (?:por favor )?(?:el|mi|este) (?:microfono|micro)|deja de escuchar)(?: alice)?(?: por favor)?$/.test(command);
}

// Explicit address only. This operates on ASR text; it is not acoustic wake-word
// detection, speaker identification or a general conversational-attention model.
export function isAddressedToAlice(text: string): boolean {
  if (/^[\s¡¿.,:;!?]*["'«“‘]/u.test(text)) return false;
  const words = normalize(text);
  if (/^alice (?:es|era|fue|tiene|tenia|dijo|dice|pregunto|me dijo|se llama|aparece)(?: |$)/u.test(words)) return false;
  if (/^(?:(?:hola|oye|ey|hey|disculpa|por favor) )?alice(?: |$)/u.test(words)) return true;
  // A trailing vocative is admitted for a question or imperative, not "hablo con Alice".
  if (/(?:^| )(?:con|a|sobre|de|llamada|llamado) alice$/u.test(words)) return false;
  return /^(?:que|como|cual|cuando|donde|quien|por que|puedes|podrias|estas|me (?:escuchas|oyes|ves|ayudas)|quiero que|abre|reproduce|pausa|continua|busca|muestra|cierra|explica|dime|ayudame|escucha|responde|espera|deten|detend)\b.* alice$/u.test(words);
}
