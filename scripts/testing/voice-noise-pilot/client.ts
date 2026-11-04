import { processMicrophone } from "../../../src/core/voice/noise-pipeline";
import { SpeechEndpoint } from "../../../src/core/voice/speech-endpoint";
import speechUrl from "../../../local/artifacts/voice-noise-2026-11-04/synthetic-speech.wav?url";

const status = document.querySelector("#status")!;
const results = document.querySelector("#results")!;
const button = document.querySelector<HTMLButtonElement>("#start")!;
button.onclick = async () => {
  button.disabled = true;
  const context = new AudioContext({ sampleRate: 48000 });
  const report: unknown[] = [];
  let runtimeError = "";
  try {
    await context.resume();
    const speech = await context.decodeAudioData(await (await fetch(speechUrl)).arrayBuffer());
    for (const name of ["noise", "speech", "speech+noise"]) {
      runtimeError = "";
      status.textContent = `Procesando ${name}…`;
      const duration = name === "noise" ? 5 : speech.duration + 2;
      const buffer = context.createBuffer(1, Math.ceil(duration * 48000), 48000);
      const samples = buffer.getChannelData(0);
      const original = speech.getChannelData(0);
      let seed = 42;
      let inputEnergy = 0;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        const noise = (seed / 2147483648) * 0.08 + Math.sin(i * 2 * Math.PI * 150 / 48000) * 0.04;
        const spoken = i >= 48000 && i - 48000 < original.length ? original[i - 48000] : 0;
        samples[i] = (name === "noise" ? 0 : spoken) + (name === "speech" ? 0 : noise);
        inputEnergy += samples[i] ** 2;
      }
      const input = context.createMediaStreamDestination();
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(input);
      const preparedAt = performance.now();
      const filtered = await processMicrophone(input.stream, message => { runtimeError ||= message; });
      const setupMs = performance.now() - preparedAt;
      const output = context.createMediaStreamSource(filtered.stream);
      const meter = context.createAnalyser(); meter.fftSize = 2048; output.connect(meter);
      const measurement = new Float32Array(meter.fftSize);
      const endpoint = new SpeechEndpoint(Date.now());
      const recorder = new MediaRecorder(filtered.stream, { mimeType: "audio/webm;codecs=opus" });
      let recordedBytes = 0, ticks = 0, energy = 0, maxProbability = 0, voiceMs = 0;
      recorder.ondataavailable = event => { recordedBytes += event.data.size; };
      const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
      recorder.start(250);
      source.start();
      const timer = setInterval(() => {
        try {
          const evidence = filtered.read();
          maxProbability = Math.max(maxProbability, evidence.probability); voiceMs += evidence.voicedMs;
          endpoint.update(evidence, Date.now());
          meter.getFloatTimeDomainData(measurement);
          energy += measurement.reduce((sum, value) => sum + value * value, 0) / measurement.length;
          ticks++;
        } catch (error) { runtimeError ||= String(error); }
      }, 250);
      await new Promise<void>(resolve => { source.onended = () => resolve(); });
      await new Promise(resolve => setTimeout(resolve, 300));
      clearInterval(timer);
      recorder.stop(); await stopped;
      const inputRms = Math.sqrt(inputEnergy / samples.length), outputRms = Math.sqrt(energy / ticks);
      report.push({ name, duration, setupMs, inputRms, outputRms, attenuationDb: 20 * Math.log10(outputRms / inputRms), maxProbability, voiceMs, hasSpeech: endpoint.hasSpeech, recordedBytes, runtimeError });
      filtered.close(); input.stream.getTracks().forEach(track => track.stop()); source.disconnect(); output.disconnect();
      results.textContent = JSON.stringify(report, null, 2);
    }
    const passed = report.every((entry: any) => !entry.runtimeError && entry.recordedBytes > 0 && (entry.name === "noise" ? !entry.hasSpeech && entry.attenuationDb < -10 : entry.hasSpeech));
    status.textContent = passed ? "Prueba completada · APROBADA" : "Prueba completada · REVISAR";
    results.textContent = JSON.stringify({ passed, report }, null, 2);
  } catch (error) { status.textContent = "Error de ejecución"; results.textContent = String(error); }
  finally { await context.close(); button.disabled = false; }
};
