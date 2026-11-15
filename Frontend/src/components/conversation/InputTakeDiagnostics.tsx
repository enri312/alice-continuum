import type { Ref } from "react";
import type { AudioSignalSnapshot } from "../../core/voice/noise-types";

export function InputSignalMeasurement({ signal }: { signal?: Readonly<AudioSignalSnapshot> | null }) {
  if (!signal || (!signal.inputSamples && !signal.outputSamples)) return <p>Medición de señal: no disponible para esta toma.</p>;
  return <section className="voice-input-signal" aria-label="Medición de la señal de audio">
    <p><strong>Acumulado hasta el último lote recibido · cobertura parcial de la toma</strong></p>
    <dl>
      <div><dt>Entrada antes de RNNoise · ganancia incluida</dt><dd>{signal.inputSamples ? <>Ganancia {signal.inputGain}× · RMS {signal.inputRms.toFixed(5)} · pico {signal.inputPeak.toFixed(5)}</> : "Sin muestras de entrada"}</dd></div>
      <div><dt>Recorte de entrada</dt><dd>{signal.inputSamples ? <>{(signal.inputClippedFraction * 100).toFixed(2)}% · {signal.inputClippedSamples} de {signal.inputSamples} muestras</> : "Desconocido: no hay muestras de entrada"}</dd></div>
      <div><dt>Entrada medida</dt><dd>{signal.inputSamples} muestras · {(signal.inputSamples / signal.sampleRate).toFixed(3)} s</dd></div>
      <div><dt>Salida filtrada real</dt><dd>{signal.outputSamples ? <>RMS {signal.outputRms.toFixed(5)} · pico {signal.outputPeak.toFixed(5)} · {signal.outputSamples} muestras · {(signal.outputSamples / signal.sampleRate).toFixed(3)} s</> : "Sin muestras de salida"}</dd></div>
    </dl>
    <p>48 kHz. Estos valores son acumulados hasta el último lote recibido; no evalúan si se entiende la voz ni representan necesariamente toda la grabación.</p>
  </section>;
}

export function LastVoiceTranscript({ text }: { text: string | null }) {
  if (text === null) return null;
  return <section className="voice-input-transcript" aria-label="Última transcripción de voz">
    <strong>Última transcripción</strong>
    <p>{text || "(sin texto)"}</p>
    <small>Resultado de la última toma. Cada dictado se añade al borrador; editar el borrador no cambia este resultado.</small>
  </section>;
}

export function FilteredTakePreview({ url, audioRef, onError }: {
  url: string; audioRef: Ref<HTMLAudioElement>; onError: () => void;
}) {
  return <section className="voice-input-preview" aria-label="Revisión local de la toma filtrada">
    <strong>Escuchar toma filtrada</strong>
    <audio ref={audioRef} controls preload="none" src={url} onError={onError} aria-label="Escuchar toma filtrada">Este entorno no puede reproducir la toma.</audio>
    <p>Escucha el audio de entrada antes de transcribir. Se descarta al transcribir, grabar otra toma o cerrar el dictado.</p>
  </section>;
}
