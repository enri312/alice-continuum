import { SpeechEndpoint } from "./speech-endpoint";
import { getMicrophone, processMicrophone } from "./noise-pipeline";
import type { MicrophoneOptions, NoiseStatus, ProcessedMicrophone } from "./noise-types";
const MAX_SECONDS = 60;
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_TYPE = "audio/webm;codecs=opus";

type CaptureEvents = {
  onStarted: () => void;
  onElapsed: (seconds: number) => void;
  onRecorded: (take: Blob, seconds: number, transcribe: boolean) => void;
  onError: (message: string) => void;
  onQuiet?: () => void;
  onProcessed?: (status: NoiseStatus) => void;
};

export type CaptureEnvironment = {
  getMicrophone: (options?: MicrophoneOptions) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => MediaRecorder;
  processMicrophone: (stream: MediaStream, onError: (message: string) => void, signal?: AbortSignal) => Promise<ProcessedMicrophone>;
};

const browserEnvironment: CaptureEnvironment = {
  getMicrophone: (options) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Este entorno no ofrece captura de micrófono compatible.");
    }
    if (!MediaRecorder.isTypeSupported(MIME_TYPE)) throw new Error("WebM/Opus no está disponible en este equipo.");
    return getMicrophone(options);
  },
  createRecorder: stream => new MediaRecorder(stream, { mimeType: MIME_TYPE }),
  processMicrophone,
};

// One capture owns its tracks and callbacks. Cancel also invalidates a pending
// permission request, whose eventual stream must immediately be released.
export class VoiceCapture {
  private generation = 0;
  private pending = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private startedAt = 0;
  private transcribe = false;
  private processed: ProcessedMicrophone | null = null;
  private processing: AbortController | null = null;
  private endpoint: SpeechEndpoint | null = null;

  constructor(private events: CaptureEvents, private environment = browserEnvironment, private automaticEndpoint = false, private options: MicrophoneOptions = {}) {}

  async start() {
    if (this.pending || this.recorder) return;
    const generation = ++this.generation;
    this.pending = true;
    try {
      const stream = await this.environment.getMicrophone(this.options);
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      for (const track of stream.getTracks()) track.addEventListener("ended", this.onDisconnected);
      this.processing = new AbortController();
      const processed = await this.environment.processMicrophone(stream, message => {
        if (generation === this.generation) this.fail(message);
      }, this.processing.signal);
      if (generation !== this.generation) { processed.close(); return; }
      this.processed = processed;
      if (this.automaticEndpoint) {
        this.endpoint = new SpeechEndpoint(Date.now());
      }
      const recorder = this.environment.createRecorder(processed.stream);
      this.recorder = recorder;
      this.chunks = [];
      this.bytes = 0;
      this.transcribe = false;
      recorder.ondataavailable = event => {
        if (generation !== this.generation || !event.data.size) return;
        this.bytes += event.data.size;
        if (this.bytes > MAX_BYTES) {
          this.fail("La toma superó 8 MB y fue descartada. Probá un turno más corto.");
          return;
        }
        this.chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (generation === this.generation) this.fail("La grabación falló y la toma fue descartada.");
      };
      recorder.onstop = () => {
        if (generation !== this.generation) return;
        const take = new Blob(this.chunks, { type: MIME_TYPE });
        const seconds = Math.max(0.1, Math.min(MAX_SECONDS, (Date.now() - this.startedAt) / 1000));
        const transcribe = this.transcribe;
        const quiet = this.automaticEndpoint && !this.endpoint?.hasSpeech;
        this.cancel();
        if (quiet) { this.events.onQuiet?.(); return; }
        if (take.size) this.events.onRecorded(take, seconds, transcribe);
        else this.events.onError("No se recibió audio. Comprobá el micrófono y grabá otra toma.");
      };
      this.startedAt = Date.now();
      recorder.start(250);
      this.timer = setInterval(() => {
        const seconds = Math.min(MAX_SECONDS, Math.floor((Date.now() - this.startedAt) / 1000));
        this.events.onElapsed(seconds);
        let evidence;
        try { evidence = this.processed!.read(); }
        catch (cause) { this.fail(String(cause)); return; }
        if (this.endpoint) {
          const endpoint = this.endpoint.update(evidence, Date.now());
          if (endpoint !== "listening") { this.finish(endpoint === "end"); return; }
        }
        // Manual capture keeps a revisable take at its limit. An active voice
        // session transcribes its shorter take automatically.
        if (seconds >= (this.automaticEndpoint ? 20 : MAX_SECONDS)) this.finish(this.automaticEndpoint);
      }, 250);
      this.events.onProcessed?.(processed.status);
      this.events.onStarted();
    } catch (cause) {
      if (generation === this.generation) this.fail(String(cause));
    } finally {
      if (generation === this.generation) this.pending = false;
    }
  }

  finish(transcribe = true) {
    const recorder = this.recorder;
    if (recorder?.state !== "recording") return;
    this.transcribe = transcribe;
    try { recorder.stop(); this.releaseMicrophone(); }
    catch (cause) { this.fail(`No se pudo terminar la toma: ${String(cause)}`); }
  }

  cancel() {
    this.generation += 1;
    this.pending = false;
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
    }
    this.releaseMicrophone();
    if (recorder?.state === "recording") {
      try { recorder.stop(); } catch { /* All tracks and callbacks are already released. */ }
    }
    this.chunks = [];
    this.bytes = 0;
    this.endpoint = null;
  }

  private onDisconnected = () => this.fail("El micrófono se desconectó. La toma fue descartada; volvé a conectarlo para continuar.");

  private releaseMicrophone() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.processed?.close();
    this.processed = null;
    this.processing?.abort();
    this.processing = null;
    this.stream?.getTracks().forEach(track => {
      track.removeEventListener("ended", this.onDisconnected);
      track.stop();
    });
    this.stream = null;
  }

  private fail(message: string) {
    this.cancel();
    this.events.onError(message);
  }
}
