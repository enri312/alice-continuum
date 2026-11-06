import { useEffect, useRef, useState } from "react";
import { VoiceCapture, type CaptureEnvironment } from "../../core/voice/voice-capture";
import { bytesToBase64, type VoiceTurnTranscript } from "../../core/voice/voice-input";
import { VoiceLoop, type VoiceLoopState, type VoiceTurnObservation } from "../../core/voice/voice-loop";
import type { VoiceOutputResult } from "../../core/voice/voice-output";
import type { MicrophoneOptions, NoiseStatus } from "../../core/voice/noise-types";

type Props = {
  desktopApp: boolean;
  disabled: boolean;
  onStart: () => Promise<string>;
  onStop: (id: string) => Promise<void>;
  onTranscribe: (base64: string, mime: string, id?: string) => Promise<VoiceTurnTranscript>;
  onTurn: (text: string, id: string) => Promise<{ exchangeId: string }>;
  onSpeak: (exchangeId: string, id: string) => Promise<VoiceOutputResult>;
  onActiveChange: (active: boolean, state: VoiceLoopState) => void;
  microphone?: MicrophoneOptions;
  onProcessed?: (status: NoiseStatus) => void;
  captureEnvironment?: CaptureEnvironment;
};

const labels: Record<VoiceLoopState, string> = {
  idle: "Escucha de Alice", preparing: "Preparando Gemma y la voz…", arming: "Preparando micrófono y filtro…", standby: "En espera · di Alice para hablarme",
  transcribing: "Entendiendo tu frase…", thinking: "Alice está respondiendo…",
  synthesizing: "Preparando la voz…", speaking: "Alice está hablando", error: "La sesión se detuvo",
};

export function HandsFreeVoice(props: Props) {
  const currentProps = useRef(props);
  currentProps.current = props;
  const [state, setState] = useState<VoiceLoopState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastTurn, setLastTurn] = useState<VoiceTurnObservation | null>(null);
  const loop = useRef<VoiceLoop | null>(null);
  const audio = useRef<AudioBufferSourceNode | null>(null);
  const outputContext = useRef<AudioContext | null>(null);
  const cancelPlayback = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const starting = useRef(false);
  const active = state !== "idle" && state !== "error";

  function stopPlayback() {
    if (audio.current) {
      audio.current.onended = null;
      try { audio.current.stop(); } catch { /* Playback already ended. */ }
      audio.current.disconnect();
    }
    audio.current = null;
    cancelPlayback.current?.();
    cancelPlayback.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; loop.current?.stop(); stopPlayback(); void outputContext.current?.close(); outputContext.current = null; };
  }, []);

  async function start() {
    if (starting.current || active || props.disabled || !props.desktopApp) return;
    starting.current = true;
    setError("");
    setNotice("");
    setLastTurn(null);
    let ready: Promise<void>;
    let context: AudioContext;
    try {
      context = new AudioContext();
      outputContext.current = context;
      ready = context.resume();
    } catch (cause) { starting.current = false; setError(`No se pudo preparar la salida de audio: ${String(cause)}`); return; }
    loop.current = new VoiceLoop({
      authorize: async () => {
        await ready;
        if (!mounted.current || outputContext.current !== context) throw Error("La preparación de voz se canceló.");
        return currentProps.current.onStart();
      },
      revoke: id => currentProps.current.onStop(id),
      capture: (onRecorded, onQuiet, onError) => new VoiceCapture({
        onStarted: () => undefined, onElapsed: () => undefined,
        onProcessed: status => currentProps.current.onProcessed?.(status),
        onRecorded: take => onRecorded(take), onQuiet, onError,
      }, currentProps.current.captureEnvironment, true, currentProps.current.microphone),
      transcribe: async (take, id) => currentProps.current.onTranscribe(bytesToBase64(new Uint8Array(await take.arrayBuffer())), take.type, id),
      respond: (text, id) => currentProps.current.onTurn(text, id),
      synthesize: (turn, id) => currentProps.current.onSpeak(turn.exchangeId, id),
      onTurnObserved: turn => { if (mounted.current) setLastTurn(turn); },
      onNotice: message => { if (mounted.current) setNotice(message); },
      play: async (result, onStarted) => {
        const context = outputContext.current;
        if (!context) throw Error("La salida de audio está cerrada.");
        const bytes = Uint8Array.from(atob(result.audioBase64), character => character.charCodeAt(0));
        const buffer = await context.decodeAudioData(bytes.buffer);
        if (outputContext.current !== context || context.state === "closed") return;
        return new Promise<void>((resolve, reject) => {
          const player = context.createBufferSource();
          player.buffer = buffer;
          player.connect(context.destination);
          audio.current = player;
          cancelPlayback.current = resolve;
          player.onended = () => { stopPlayback(); resolve(); };
          try { player.start(); onStarted?.(); } catch (cause) { stopPlayback(); reject(cause); }
        });
      },
      stopPlayback,
      onState: (next, message) => {
        if (!mounted.current) return;
        setState(next);
        if (next === "idle" || next === "error") {
          starting.current = false;
          void outputContext.current?.close();
          outputContext.current = null;
        }
        if (message && next === "error") setError(message);
        else if (message) setNotice(message);
        currentProps.current.onActiveChange(next !== "idle" && next !== "error", next);
      },
    });
    await loop.current.start();
  }

  return <section className={`hands-free-voice ${active ? "active" : ""}`} aria-label="Conversación automática por voz">
    <div className="hands-free-controls">
      <button type="button" className={active ? "secondary danger" : "primary"} disabled={!props.desktopApp || (!active && props.disabled)} onClick={() => active ? loop.current?.stop() : void start()}>{active ? "Apagar micrófono" : "Iniciar escucha de Alice"}</button>
      {state === "standby" && <button type="button" className="secondary" onClick={() => loop.current?.finishTurn()}>Terminé de hablar</button>}
      <strong role="status" aria-live="polite">{labels[state]}</strong>
    </div>
    {!active && <p>Al iniciar, el micrófono queda en espera. Alice atiende frases dirigidas a ella, como «Alice, abre Spotify» o «¿Me escuchas, Alice?». Las demás frases se descartan después de transcribirlas localmente. Las respuestas atendidas usan Gemma y Fish. La escucha termina al apagar el micrófono, cambiar de pantalla o cumplir dos horas.</p>}
    {active && <p>{state === "standby" ? "Micrófono activo con reducción de ruido. Incluye «Alice» en cada frase que quieras que atienda. «Detén la conversación, Alice» vuelve a la espera; «Apaga el micrófono, Alice» termina la escucha." : state === "arming" ? "Preparando la entrada y el filtro local antes de escuchar." : "Micrófono apagado mientras Alice transcribe, procesa o habla. Después vuelve a la espera. Puedes apagarlo con el botón en cualquier momento."}</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {lastTurn && <details className="voice-session-observation"><summary>Último mensaje atendido · {lastTurn.outcome === "textOnly" ? "respuesta en texto" : lastTurn.outcome === "error" ? "interrumpido" : lastTurn.untilPlaybackMs === null ? "en proceso" : `${(lastTurn.untilPlaybackMs / 1000).toFixed(1)} s hasta iniciar la voz`}</summary>
      <p><strong>Alice entendió:</strong> {lastTurn.transcript}</p>
      <dl>{([["Transcripción",lastTurn.transcriptionMs],["Respuesta",lastTurn.responseMs],["Preparación de voz",lastTurn.synthesisMs]] as const).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value === null ? "—" : `${(value/1000).toFixed(1)} s`}</dd></div>)}</dl>
      <p>Medido desde que termina la grabación. La pausa de cierre y la duración de lo que dices quedan fuera. Este detalle se conserva sólo en esta pantalla.</p>
    </details>}
  </section>;
}
