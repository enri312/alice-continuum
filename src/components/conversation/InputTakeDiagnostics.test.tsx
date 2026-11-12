import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AudioSignalSnapshot } from "../../core/voice/noise-types";
import { FilteredTakePreview, InputSignalMeasurement, LastVoiceTranscript } from "./InputTakeDiagnostics";

const signal: AudioSignalSnapshot = {
  sampleRate: 48000, inputGain: 4, inputSamples: 2400, inputRms: 0.2, inputPeak: 1.2,
  inputClippedSamples: 24, inputClippedFraction: 0.01, outputSamples: 1920, outputRms: 0.1, outputPeak: 0.8,
  coverage: "last_received_batch",
};

describe("diagnóstico manual de entrada", () => {
  it("muestra entrada y salida medidas con cobertura parcial sin atribuir inteligibilidad", () => {
    const markup = renderToStaticMarkup(<InputSignalMeasurement signal={signal} />);
    expect(markup).toContain("Ganancia 4×");
    expect(markup).toContain("pico 1.20000");
    expect(markup).toContain("1.00% · 24 de 2400 muestras");
    expect(markup).toContain("2400 muestras · 0.050 s");
    expect(markup).toContain("1920 muestras · 0.040 s");
    expect(markup).toContain("cobertura parcial de la toma");
    expect(markup).toContain("no evalúan si se entiende la voz");
  });
  it("explica la ausencia de medición sin presentar ceros inventados", () => {
    const markup = renderToStaticMarkup(<InputSignalMeasurement />);
    expect(markup).toContain("no disponible");
    expect(markup).not.toContain("0.00%");
  });
  it("distingue una entrada sin muestras de silencio medido", () => {
    const markup = renderToStaticMarkup(<InputSignalMeasurement signal={{ ...signal, inputSamples: 0, inputRms: 0, inputPeak: 0, inputClippedSamples: 0, inputClippedFraction: 0 }} />);
    expect(markup).toContain("Sin muestras de entrada");
    expect(markup).toContain("Desconocido: no hay muestras de entrada");
    expect(markup).not.toContain("0.00%");
  });
  it("distingue una salida sin muestras de silencio medido", () => {
    const markup = renderToStaticMarkup(<InputSignalMeasurement signal={{ ...signal, outputSamples: 0, outputRms: 0, outputPeak: 0 }} />);
    expect(markup).toContain("Sin muestras de salida");
    expect(markup).not.toContain("RMS 0.00000");
  });
  it("ofrece el audio local con controles sin reproducirlo ni precargarlo", () => {
    const onError = vi.fn();
    const markup = renderToStaticMarkup(<FilteredTakePreview url="blob:local-take" audioRef={createRef()} onError={onError} />);
    expect(markup).toContain("Escuchar toma filtrada");
    expect(markup).toContain('src="blob:local-take"');
    expect(markup).toContain('preload="none"');
    expect(markup).toContain("controls=");
    expect(markup).not.toContain("autoPlay");
    expect(markup).not.toContain("autoplay");
    expect(onError).not.toHaveBeenCalled();
  });
  it("mantiene el último resultado separado del borrador que el usuario puede editar", () => {
    const render = (draft: string) => renderToStaticMarkup(<><LastVoiceTranscript text="resultado del ASR" /><textarea defaultValue={draft} /></>);
    for (const draft of ["borrador acumulado", "PAUSA SPOTIFY editado"]) {
      const markup = render(draft);
      expect(markup).toContain("<p>resultado del ASR</p>");
      expect(markup).toContain(draft);
      expect(markup).toContain("editar el borrador no cambia este resultado");
    }
    expect(renderToStaticMarkup(<LastVoiceTranscript text={null} />)).toBe("");
  });
});
