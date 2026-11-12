import type { AudioSignalCounters, AudioSignalSnapshot } from "./noise-types";

const keys = ["inputSamples", "inputSquareSum", "inputPeak", "inputClippedSamples", "outputSamples", "outputSquareSum", "outputPeak"] as const;
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function level(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function possibleEnergy(samples: number, squares: number, peak: number) {
  if (!samples) return squares === 0 && peak === 0;
  if (!peak) return squares === 0;
  const peakSquared = peak * peak;
  const maximum = samples * peakSquared;
  if (!Number.isFinite(maximum)) return false;
  const tolerance = Math.max(1e-30, maximum) * 1e-8;
  return squares + tolerance >= peakSquared && squares <= maximum + tolerance;
}

// Diagnostics are a closed scalar contract; malformed metrics never become
// plausible-looking zero levels or escape into a transcript/audio payload.
export function readAudioSignalCounters(value: unknown): Readonly<AudioSignalCounters> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(key => !(keys as readonly string[]).includes(key))) return undefined;
  if (!count(data.inputSamples) || !count(data.outputSamples) || !count(data.inputClippedSamples)
    || !level(data.inputSquareSum) || !level(data.outputSquareSum) || !level(data.inputPeak) || !level(data.outputPeak)) return undefined;
  if (data.inputSamples === 0 && data.outputSamples === 0) return undefined;
  if (data.inputClippedSamples > data.inputSamples
    || (data.inputPeak > 1) !== (data.inputClippedSamples > 0)
    || data.inputSquareSum + 1e-8 < data.inputClippedSamples
    || !possibleEnergy(data.inputSamples, data.inputSquareSum, data.inputPeak)
    || !possibleEnergy(data.outputSamples, data.outputSquareSum, data.outputPeak)) return undefined;
  return Object.freeze({
    inputSamples: data.inputSamples, inputSquareSum: data.inputSquareSum, inputPeak: data.inputPeak,
    inputClippedSamples: data.inputClippedSamples, outputSamples: data.outputSamples,
    outputSquareSum: data.outputSquareSum, outputPeak: data.outputPeak,
  });
}

export function signalCountersAdvance(previous: Readonly<AudioSignalCounters>, next: Readonly<AudioSignalCounters>): boolean {
  if (next.inputSamples < previous.inputSamples || next.outputSamples < previous.outputSamples
    || next.inputSquareSum < previous.inputSquareSum || next.outputSquareSum < previous.outputSquareSum
    || next.inputPeak < previous.inputPeak || next.outputPeak < previous.outputPeak
    || next.inputClippedSamples < previous.inputClippedSamples) return false;
  if (next.inputSamples === previous.inputSamples && (next.inputSquareSum !== previous.inputSquareSum
    || next.inputPeak !== previous.inputPeak || next.inputClippedSamples !== previous.inputClippedSamples)) return false;
  return next.outputSamples !== previous.outputSamples
    || (next.outputSquareSum === previous.outputSquareSum && next.outputPeak === previous.outputPeak);
}

export function snapshotAudioSignal(counters: Readonly<AudioSignalCounters>, inputGain: number): Readonly<AudioSignalSnapshot> | undefined {
  if (!Number.isFinite(inputGain) || inputGain <= 0 || (counters.inputSamples === 0 && counters.outputSamples === 0)) return undefined;
  return Object.freeze({
    sampleRate: 48000, inputGain,
    inputSamples: counters.inputSamples,
    inputRms: counters.inputSamples ? Math.sqrt(counters.inputSquareSum / counters.inputSamples) : 0,
    inputPeak: counters.inputPeak, inputClippedSamples: counters.inputClippedSamples,
    inputClippedFraction: counters.inputSamples ? counters.inputClippedSamples / counters.inputSamples : 0,
    outputSamples: counters.outputSamples,
    outputRms: counters.outputSamples ? Math.sqrt(counters.outputSquareSum / counters.outputSamples) : 0,
    outputPeak: counters.outputPeak, coverage: "last_received_batch",
  });
}
