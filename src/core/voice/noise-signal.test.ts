import { describe, expect, it } from "vitest";
import { readAudioSignalCounters, signalCountersAdvance, snapshotAudioSignal } from "./noise-signal";

const counters = {
  inputSamples: 4, inputSquareSum: 8.25, inputPeak: 2, inputClippedSamples: 2,
  outputSamples: 2, outputSquareSum: 0.05, outputPeak: 0.2,
};

describe("medición escalar y efímera de señal", () => {
  it("deriva RMS y clipping con cantidades independientes y conserva sólo escalares", () => {
    const value = readAudioSignalCounters(counters)!;
    const snapshot = snapshotAudioSignal(value, 4)!;
    expect(snapshot.inputRms).toBeCloseTo(Math.sqrt(8.25 / 4));
    expect(snapshot.outputRms).toBeCloseTo(Math.sqrt(0.05 / 2));
    expect(snapshot.inputClippedFraction).toBe(0.5);
    expect(snapshot.inputGain).toBe(4);
    expect(snapshot.inputSamples).toBe(4);
    expect(snapshot.outputSamples).toBe(2);
    expect(snapshot.coverage).toBe("last_received_batch");
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshotAudioSignal(value, 4)).not.toBe(snapshot);
  });

  it.each([
    undefined, null, [], {}, { ...counters, audio: [0.1] },
    { ...counters, inputSamples: NaN }, { ...counters, outputSamples: 1.5 },
    { ...counters, inputPeak: Infinity }, { ...counters, outputPeak: -1 },
    { ...counters, inputClippedSamples: 5 }, { ...counters, inputPeak: 0.5 },
    { ...counters, inputClippedSamples: 0 }, { ...counters, inputSquareSum: 3 },
    { ...counters, inputSquareSum: 100 }, { ...counters, outputSamples: 0 },
  ])("no convierte datos ausentes o imposibles en una medición válida: %j", value => {
    expect(readAudioSignalCounters(value)).toBeUndefined();
  });

  it("no presenta ausencia de muestras como silencio medido", () => {
    const empty = { inputSamples: 0, inputSquareSum: 0, inputPeak: 0, inputClippedSamples: 0, outputSamples: 0, outputSquareSum: 0, outputPeak: 0 };
    expect(readAudioSignalCounters(empty)).toBeUndefined();
    expect(snapshotAudioSignal(empty, 1)).toBeUndefined();
  });

  it("acepta silencio realmente medido con muestras y niveles cero", () => {
    const silent = { inputSamples: 4, inputSquareSum: 0, inputPeak: 0, inputClippedSamples: 0, outputSamples: 2, outputSquareSum: 0, outputPeak: 0 };
    const snapshot = snapshotAudioSignal(readAudioSignalCounters(silent)!, 1)!;
    expect(snapshot.inputSamples).toBe(4);
    expect(snapshot.outputSamples).toBe(2);
    expect(snapshot.inputRms).toBe(0);
    expect(snapshot.outputRms).toBe(0);
    expect(snapshot.inputClippedFraction).toBe(0);
    expect(snapshotAudioSignal(silent, Infinity)).toBeUndefined();
  });

  it.each([
    { inputSamples: 0, outputSamples: 2 },
    { inputSamples: 4, outputSamples: 0 },
  ])("conserva cada contador para que la UI distinga el lado sin muestras: %j", counts => {
    const partial = { ...counts, inputSquareSum: 0, inputPeak: 0, inputClippedSamples: 0, outputSquareSum: 0, outputPeak: 0 };
    const snapshot = snapshotAudioSignal(readAudioSignalCounters(partial)!, 1)!;
    expect(snapshot.inputSamples).toBe(counts.inputSamples);
    expect(snapshot.outputSamples).toBe(counts.outputSamples);
  });

  it("acepta duplicados idénticos y rechaza retrocesos o cambios sin muestras nuevas", () => {
    expect(signalCountersAdvance(counters, { ...counters })).toBe(true);
    expect(signalCountersAdvance(counters, { ...counters, inputSamples: 3 })).toBe(false);
    expect(signalCountersAdvance(counters, { ...counters, outputSamples: 1 })).toBe(false);
    expect(signalCountersAdvance(counters, { ...counters, inputSquareSum: 9 })).toBe(false);
    expect(signalCountersAdvance(counters, { ...counters, outputSquareSum: 0.06 })).toBe(false);
    expect(signalCountersAdvance(counters, { ...counters, inputSamples: 5, outputSamples: 3 })).toBe(true);
  });
});
