import { buildIdentificationSnapshot, type IdentificationInputs } from "../../core/cognitive/identification";
import { InputTakePreview } from "../../core/voice/input-take-preview";
import type { AudioSignalSnapshot, MicrophoneSensitivity, NoiseStatus } from "../../core/voice/noise-types";
import { VoiceCapture } from "../../core/voice/voice-capture";
import { bytesToBase64, type VoiceTurnTranscript } from "../../core/voice/voice-input";
import { VoiceLoop, type VoiceIgnoredTakeObservation, type VoiceLoopState, type VoiceTurnObservation } from "../../core/voice/voice-loop";
import type { VoiceOutputPreview, VoiceOutputResult } from "../../core/voice/voice-output";

type VoicePorts = {
  desktopApp: () => boolean;
  isDisabled: () => boolean;
  getDraft: () => string;
  setDraft: (value: string) => void;
  invalidateReview: () => void;
  prepare: () => Promise<void>;
  start: () => Promise<string>;
  stop: (id: string) => Promise<void>;
  transcribe: (audio: string, mime: string, session?: string) => Promise<VoiceTurnTranscript>;
  respond: (text: string, session: string) => Promise<{ exchangeId: string }>;
  speak: (exchange: string, session: string) => Promise<VoiceOutputResult>;
  preview: (exchange: string) => Promise<VoiceOutputPreview>;
  confirm: (request: string) => Promise<VoiceOutputResult>;
  cancel: (request: string) => Promise<void>;
};

type CaptureState = "idle" | "requesting" | "recording" | "recorded" | "transcribing" | "review";
type Device = { id: string; label: string };
const microphoneOff = "El micrófono está apagado. Nada se graba ni se envía.";
const labels: Record<VoiceLoopState, string> = {
  idle: "Escucha de Alice", preparing: "Preparando Gemma y la voz…", arming: "Preparando micrófono y filtro…",
  standby: "Escuchando · di Alice y tu frase", transcribing: "Entendiendo tu frase…", thinking: "Alice está respondiendo…",
  synthesizing: "Preparando la voz…", speaking: "Alice está hablando", error: "La sesión se detuvo",
};

export function measureInputDiagnostics(inputs: IdentificationInputs, observationAvailable: boolean) {
  const started = performance.now();
  const snapshot = buildIdentificationSnapshot(inputs);
  return { snapshot, processingMs: performance.now() - started, observationAvailable, fingerprint: JSON.stringify(inputs) };
}

/** Owns browser audio handles. Only the view data crosses to Dioxus. */
export function createConversationVoice(ports: VoicePorts, onChange: () => void) {
  const state = {
    loopState: "idle" as VoiceLoopState,
    loopError: "", notice: "", lastTurn: null as VoiceTurnObservation | null, ignored: null as VoiceIgnoredTakeObservation | null,
    devices: [] as Device[], deviceMessage: "", device: "", sensitivity: "soft" as MicrophoneSensitivity,
    noise: null as NoiseStatus | null,
    manualOpen: false, captureState: "idle" as CaptureState, inputMessage: microphoneOff, elapsed: 0,
    recorded: null as number | null, transcriptMs: null as number | null, model: null as string | null,
    transcript: null as string | null, signal: null as Readonly<AudioSignalSnapshot> | null, inputUrl: null as string | null,
    pending: null as "preview" | "confirm" | "cancel" | null, preview: null as VoiceOutputPreview | null,
    output: null as (Omit<VoiceOutputResult, "audioBase64" | "mimeType"> & { url: string }) | null,
    playback: "ready" as "ready" | "playing" | "paused", outputError: "",
  };
  let disposed = false;
  let captureGeneration = 0;
  let previewGeneration = 0;
  let capture: VoiceCapture | null = null;
  let take: Blob | null = null;
  let loop: VoiceLoop | null = null;
  let context: AudioContext | null = null;
  let player: AudioBufferSourceNode | null = null;
  let finishPlayback: (() => void) | null = null;
  const inputPreview = new InputTakePreview();
  const active = () => state.loopState !== "idle" && state.loopState !== "error";
  const busy = () => ["requesting", "recording", "transcribing"].includes(state.captureState);
  const locked = () => disposed || !ports.desktopApp() || ports.isDisabled() || busy() || active() || Boolean(state.pending);
  const canReviewTranscript = () => !disposed && ports.desktopApp() && !ports.isDisabled()
    && !busy() && !state.pending && (!active() || state.loopState === "standby");
  const update = (values: Partial<typeof state>) => {
    Object.assign(state, values);
    if (!disposed) onChange();
  };

  function snapshot() {
    const playbackStatus = state.playback === "playing" ? { label: "Alice está hablando", tone: "speaking" } :
      state.playback === "paused" ? { label: "Voz de Alice en pausa", tone: "idle" } : null;
    const status = active() ? { label: labels[state.loopState], tone: state.loopState === "standby" ? "recording" : state.loopState === "speaking" ? "speaking" : "busy" }
      : state.captureState === "recording" ? { label: "Te escucho", tone: "recording" }
      : state.captureState === "transcribing" ? { label: "Transcribiendo tu voz", tone: "busy" }
      : state.captureState === "requesting" ? { label: "Preparando el micrófono", tone: "busy" }
      : state.pending === "confirm" ? { label: "Generando la voz de Alice", tone: "busy" }
      : playbackStatus ?? (state.outputError ? { label: "Hay un problema que revisar", tone: "error" }
        : state.preview ? { label: "Respuesta lista para autorizar su voz", tone: "idle" } : null);
    return { ...state, desktopApp: ports.desktopApp(), disabled: ports.isDisabled(), busy: busy(), active: active(), modeOpen: state.manualOpen,
      loopLabel: labels[state.loopState], statusLabel: status?.label ?? "", statusTone: status?.tone ?? "",
      canReviewTranscript: canReviewTranscript() };
  }

  function clearInputPreview() {
    const node = document.getElementById("alice-voice-input-player");
    const audio = node instanceof HTMLAudioElement ? node : null;
    inputPreview.clear(audio);
    state.inputUrl = null;
  }

  function discardOutput() {
    if (state.output) {
      const url = state.output.url;
      state.output = null;
      const audio = document.getElementById("alice-voice-output-player");
      if (audio instanceof HTMLAudioElement) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      URL.revokeObjectURL(url);
    }
    state.playback = "ready";
  }

  function stopManualInput(message: string) {
    ++captureGeneration;
    capture?.cancel();
    capture = null;
    take = null;
    clearInputPreview();
    Object.assign(state, { captureState: "idle", recorded: null, transcriptMs: null, model: null, transcript: null, signal: null, inputMessage: message });
  }

  function clearOutput() {
    ++previewGeneration;
    const oldPreview = state.preview;
    state.preview = null;
    if (oldPreview && state.pending !== "confirm" && state.pending !== "cancel") {
      void ports.cancel(oldPreview.requestId).catch(() => undefined);
    }
    state.pending = null;
    discardOutput();
  }

  function closeManual() {
    stopManualInput(microphoneOff);
    clearOutput();
    update({ manualOpen: false, outputError: "" });
  }

  async function transcribe(recording: Blob, token: number, beforeText: string) {
    clearInputPreview();
    update({ captureState: "transcribing", transcriptMs: null, model: null, transcript: null,
      inputMessage: "Transcribiendo tu voz localmente. Todavía no se envía nada al chat.", outputError: "" });
    try {
      const bytes = bytesToBase64(new Uint8Array(await recording.arrayBuffer()));
      if (disposed || token !== captureGeneration) return;
      const result = await ports.transcribe(bytes, recording.type || "audio/webm");
      if (disposed || token !== captureGeneration) return;
      take = null;
      if (!result.noSpeech) ports.setDraft([beforeText.trim(), result.text].filter(Boolean).join("\n"));
      update({ transcriptMs: result.durationMs, model: result.model, transcript: result.text,
        captureState: result.noSpeech ? "idle" : "review",
        inputMessage: result.noSpeech ? "No se detectó habla inteligible. Probá otra toma hablando cerca del micrófono."
          : "Revisá lo que entendí en el mensaje y pulsá Revisar mensaje. Tu respuesta tendrá una vista previa de voz para autorizarla." });
    } catch (error) {
      if (!disposed && token === captureGeneration) update({ captureState: "recorded", inputMessage: `No se completó la transcripción: ${String(error)} Podés reintentar o descartar la toma.` });
    }
  }

  async function startManual() {
    if (locked() || !state.manualOpen) return;
    const token = ++captureGeneration;
    const beforeText = ports.getDraft();
    const previousTake = take;
    const current = () => !disposed && token === captureGeneration;
    clearInputPreview();
    clearOutput();
    ports.invalidateReview();
    update({ captureState: "requesting", inputMessage: "Preparando Gemma local antes de abrir el micrófono…",
      recorded: null, transcriptMs: null, model: null, transcript: null, signal: null, outputError: "" });
    try {
      await ports.prepare();
      if (!current()) return;
      update({ inputMessage: "Preparando micrófono y filtro de ruido…" });
      let recordingStarted = false;
      capture = new VoiceCapture({
        onStarted: () => {
          if (!current()) return;
          recordingStarted = true;
          take = null;
          update({ captureState: "recording", elapsed: 0, inputMessage: "Grabando. Al terminar, haz clic en «Parar y revisar audio» para escuchar la toma o en «Terminé de hablar y transcribir» para obtener el texto. Máximo: 60 segundos." });
        },
        onElapsed: elapsed => { if (current()) update({ elapsed }); },
        onProcessed: noise => { if (current()) update({ noise }); },
        onRecorded: (recording, seconds, transcribeNow, signal) => {
          if (!current()) return;
          capture = null;
          take = recording;
          let url = null;
          let message = "Micrófono apagado. La toma está lista para transcribir localmente.";
          if (!transcribeNow) {
            try { url = inputPreview.replace(recording, current); }
            catch { message = "No se pudo preparar la reproducción. Puedes transcribir la toma localmente o descartarla."; }
          }
          update({ captureState: "recorded", recorded: seconds, signal: signal ?? null, inputUrl: url, inputMessage: message });
          if (transcribeNow) void transcribe(recording, token, beforeText);
        },
        onError: error => {
          if (!current()) return;
          capture = null;
          take = recordingStarted ? null : previousTake;
          update({ captureState: take ? "recorded" : "idle", inputMessage: error });
        },
      }, undefined, false, { deviceId: state.device, sensitivity: state.sensitivity });
      await capture.start();
    } catch (error) {
      if (current()) update({ captureState: previousTake ? "recorded" : "idle", inputMessage: `No se abrió el micrófono: ${String(error)}` });
    }
  }

  function stopPlayback() {
    if (player) {
      player.onended = null;
      try { player.stop(); } catch { /* Playback already ended. */ }
      player.disconnect();
      player = null;
    }
    finishPlayback?.();
    finishPlayback = null;
  }

  function closeContext() {
    const output = context;
    context = null;
    if (output) void output.close().catch(() => undefined);
  }

  async function startLoop() {
    if (locked() || context) return;
    update({ loopError: "", notice: "", lastTurn: null, ignored: null });
    let output: AudioContext;
    try {
      output = new AudioContext();
      context = output;
    } catch (error) {
      update({ loopError: `No se pudo preparar la salida de audio: ${String(error)}` });
      return;
    }
    const ready = output.resume();
    loop = new VoiceLoop({
      authorize: async () => {
        await ready;
        if (disposed || context !== output) throw Error("La preparación de voz se canceló.");
        closeManual();
        ports.invalidateReview();
        return ports.start();
      },
      revoke: ports.stop,
      capture: (recorded, quiet, error) => new VoiceCapture({
        onStarted: () => undefined, onElapsed: () => undefined,
        onProcessed: noise => update({ noise }),
        onRecorded: (recording, seconds) => recorded(recording, { recordedSeconds: seconds }), onQuiet: quiet, onError: error,
      }, undefined, true, { deviceId: state.device, sensitivity: state.sensitivity }),
      transcribe: async (recording, id) => ports.transcribe(bytesToBase64(new Uint8Array(await recording.arrayBuffer())), recording.type, id),
      respond: ports.respond,
      synthesize: (turn, id) => ports.speak(turn.exchangeId, id),
      play: async (result, started) => {
        if (context !== output) throw Error("La salida de audio está cerrada.");
        const bytes = Uint8Array.from(atob(result.audioBase64), character => character.charCodeAt(0));
        const buffer = await output.decodeAudioData(bytes.buffer);
        if (context !== output || disposed || output.state === "closed") return;
        return new Promise<void>((resolve, reject) => {
          const node = output.createBufferSource();
          node.buffer = buffer;
          node.connect(output.destination);
          player = node;
          finishPlayback = resolve;
          node.onended = stopPlayback;
          try { node.start(); started?.(); }
          catch (cause) {
            finishPlayback = null;
            stopPlayback();
            reject(cause);
          }
        });
      },
      stopPlayback,
      onNotice: notice => update({ notice }),
      onTurnObserved: lastTurn => update({ lastTurn }),
      onIgnoredTakeObserved: ignored => update({ ignored }),
      onState: (loopState, message) => {
        if (loopState === "idle" || loopState === "error") closeContext();
        const feedback = message ? (loopState === "error" ? { loopError: message } : { notice: message }) : {};
        update({ loopState, ...feedback });
      },
    });
    await loop.start();
  }

  async function prepareOutput(exchangeId: string, afterDictation = false) {
    if (disposed || !ports.desktopApp() || active() || busy() || state.pending || !exchangeId
      || (ports.isDisabled() && !afterDictation)) return;
    clearOutput();
    const token = ++previewGeneration;
    update({ pending: "preview", outputError: "" });
    try {
      const preview = await ports.preview(exchangeId);
      if (disposed || token !== previewGeneration) {
        void ports.cancel(preview.requestId).catch(() => undefined);
        return;
      }
      update({ preview });
    } catch (error) {
      if (token === previewGeneration) update({ outputError: `No se pudo preparar la voz: ${String(error)}` });
    } finally {
      if (token === previewGeneration) update({ pending: null });
    }
  }

  async function decideOutput(confirm: boolean) {
    const preview = state.preview;
    if (locked() || !preview || (confirm && !preview.canConfirm)) return;
    const token = ++previewGeneration;
    update({ pending: confirm ? "confirm" : "cancel", outputError: "" });
    try {
      if (confirm) {
        const { audioBase64, mimeType, ...metadata } = await ports.confirm(preview.requestId);
        if (disposed || token !== previewGeneration) return;
        const bytes = Uint8Array.from(atob(audioBase64), character => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        update({ output: { ...metadata, url }, playback: "ready", preview: null });
      } else {
        await ports.cancel(preview.requestId);
        if (token === previewGeneration) update({ preview: null });
      }
    } catch (error) {
      if (token === previewGeneration) update({ preview: confirm ? null : preview,
        outputError: `${confirm ? "No se pudo generar la voz" : "No se pudo descartar la vista previa de voz"}: ${String(error)}` });
    } finally {
      if (token === previewGeneration) update({ pending: null });
    }
  }

  async function refreshDevices() {
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(item => item.kind === "audioinput" && item.deviceId);
      update({ devices: inputs.map((item, index) => ({ id: item.deviceId, label: item.label || `Micrófono ${index + 1}` })),
        deviceMessage: inputs.length ? "Si faltan nombres, actualiza la lista después de tu primera toma." : "No se encontraron micrófonos disponibles." });
    } catch {
      update({ deviceMessage: "No se pudo consultar la lista de micrófonos." });
    }
  }

  function dispatch(action: unknown) {
    if (disposed || !action || typeof action !== "object") return false;
    const { type, value, exchangeId } = action as Record<string, unknown>;
    switch (type) {
      case "listen": if (active()) loop?.stop(); else void startLoop(); break;
      case "finishTurn": if (state.loopState === "standby") loop?.finishTurn(); break;
      case "reviewTranscript": {
        if (!canReviewTranscript()) break;
        const transcript = value === "ignored"
          ? (state.ignored?.reason === "notAddressed" ? state.ignored.transcript : "")
          : (value === "attended" ? state.lastTurn?.transcript : "");
        if (!transcript?.trim()) break;
        if (active()) loop?.stop();
        ports.setDraft([ports.getDraft().trimEnd(), transcript.trim()].filter(Boolean).join("\n"));
        update({ notice: "Transcripción en el borrador. Corregila y pulsá «Revisar mensaje»." });
        break;
      }
      case "toggleManual":
        if (ports.desktopApp() && !ports.isDisabled() && !active()) {
          if (state.manualOpen) closeManual();
          else update({ manualOpen: true });
        }
        break;
      case "record": void startManual(); break;
      case "finishRecord": if (state.captureState === "recording") capture?.finish(value !== false); break;
      case "discardTake": stopManualInput("Toma descartada. El micrófono está apagado."); update({}); break;
      case "transcribe":
        if (!locked() && take && state.captureState === "recorded") void transcribe(take, captureGeneration, ports.getDraft());
        break;
      case "refreshDevices": if (!locked()) void refreshDevices(); break;
      case "device":
        if (!locked() && typeof value === "string" && (!value || state.devices.some(item => item.id === value))) update({ device: value });
        break;
      case "sensitivity": if (!locked() && (value === "soft" || value === "normal")) update({ sensitivity: value }); break;
      case "inputPlaybackError":
        if (typeof value === "string" && inputPreview.isCurrent(value)) {
          clearInputPreview();
          update({ inputMessage: "No se pudo reproducir la toma filtrada. Puedes transcribirla localmente o descartarla." });
        }
        break;
      case "preview": if (typeof exchangeId === "string") void prepareOutput(exchangeId); break;
      case "cancel": void decideOutput(false); break;
      case "confirm": void decideOutput(true); break;
      case "focusOutput":
        requestAnimationFrame(() => {
          if (disposed) return;
          const panel = document.getElementById("alice-voice-output-panel");
          panel?.scrollIntoView({ behavior: "smooth", block: "center" });
          panel?.focus({ preventScroll: true });
        });
        break;
      case "playback":
        if (state.output && (value === "playing" || value === "paused")) update({ playback: value });
        break;
      case "discardOutput": discardOutput(); update({}); break;
      case "outputPlaybackError":
        if (state.output) {
          discardOutput();
          update({ outputError: "El audio temporal no pudo reproducirse y fue descartado." });
        }
        break;
      default: return false;
    }
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    loop?.stop();
    stopPlayback();
    closeContext();
    stopManualInput(microphoneOff);
    clearOutput();
  }

  function previewSpokenResponse(exchangeId: string) {
    if (!state.manualOpen) return;
    if (state.captureState === "review") update({ captureState: "idle" });
    void prepareOutput(exchangeId, true);
  }

  return { snapshot, dispatch, dispose, previewSpokenResponse };
}
