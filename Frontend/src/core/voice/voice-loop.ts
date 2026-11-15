import type { VoiceTurnTranscript } from "./voice-input";
import type { VoiceOutputResult } from "./voice-output";
import { isAddressedToAlice, isMicrophoneOffCommand, isVoiceStopCommand } from "./voice-commands";
import { isRecoverableNoiseFailure, type NoiseFailureReason } from "./noise-types";

export type VoiceLoopState = "idle" | "preparing" | "arming" | "standby" | "transcribing" | "thinking" | "synthesizing" | "speaking" | "error";
type Turn = { exchangeId: string };
export type VoiceTurnObservation = {
  transcript: string;
  transcriptionModel: string;
  captureMs: number | null;
  transcriptionMs: number;
  responseMs: number | null;
  synthesisMs: number | null;
  untilPlaybackMs: number | null;
  totalMs: number | null;
  outcome: "processing" | "completed" | "textOnly" | "error";
};
export type VoiceIgnoredTakeObservation =
  | { reason: "insufficientSpeech" }
  | { reason: "noSpeech" | "notAddressed"; transcript: string; transcriptionModel: string; captureMs: number | null; transcriptionMs: number };
export type VoiceLoopPorts = {
  authorize: () => Promise<string>;
  revoke: (id: string) => Promise<void>;
  capture: (onRecorded: (take: Blob, metadata?: { recordedSeconds?: number }) => void, onQuiet: () => void, onError: (error: string, reason?: NoiseFailureReason) => void) => { start: () => Promise<void>; cancel: () => void; finish: () => void };
  transcribe: (take: Blob, id: string) => Promise<VoiceTurnTranscript>;
  respond: (text: string, id: string) => Promise<Turn>;
  synthesize: (turn: Turn, id: string) => Promise<VoiceOutputResult>;
  play: (audio: VoiceOutputResult, onStarted?: () => void) => Promise<void>;
  stopPlayback: () => void;
  acceptTranscript?: (text: string) => boolean;
  now?: () => number;
  onTurnObserved?: (turn: VoiceTurnObservation) => void;
  onIgnoredTakeObserved?: (take: VoiceIgnoredTakeObservation | null) => void;
  onNotice?: (message: string) => void;
  onState: (state: VoiceLoopState, error?: string) => void;
};

export class VoiceLoop {
  private generation = 0;
  private session: string | null = null;
  private capture: ReturnType<VoiceLoopPorts["capture"]> | null = null;
  private active = false;
  private captureRecoveryUsed = false;
  private ignoredTake: VoiceIgnoredTakeObservation | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  constructor(private ports: VoiceLoopPorts) {}

  async start() {
    if (this.active) return;
    this.active = true;
    this.captureRecoveryUsed = false;
    this.observeIgnoredTake(null);
    const generation = ++this.generation;
    this.ports.onState("preparing");
    try {
      const id = await this.ports.authorize();
      if (!this.current(generation)) { await this.ports.revoke(id); return; }
      this.session = id;
      this.expiry = setTimeout(() => this.stop(), 2 * 60 * 60 * 1000);
      await this.listen(generation);
    } catch (error) { if (this.current(generation)) this.fail(error); }
  }

  stop(message?: string) {
    this.active = false;
    if (this.expiry !== null) clearTimeout(this.expiry);
    this.expiry = null;
    this.generation += 1;
    this.observeIgnoredTake(null);
    this.capture?.cancel();
    this.capture = null;
    this.ports.stopPlayback();
    const id = this.session;
    this.session = null;
    if (id) void this.ports.revoke(id).catch(() => undefined);
    this.ports.onState("idle", message);
  }

  finishTurn() { this.capture?.finish(); }

  private current(generation: number) { return this.active && generation === this.generation; }

  private observeIgnoredTake(take: VoiceIgnoredTakeObservation | null) {
    // Keep one ephemeral result. Quiet windows must not hide an ASR result or
    // repeat the same notice while the person inspects what was transcribed.
    if (take === null && this.ignoredTake === null) return;
    if (take?.reason === "insufficientSpeech" && this.ignoredTake !== null) return;
    this.ignoredTake = take;
    this.ports.onIgnoredTakeObserved?.(take);
  }

  private async listen(generation: number) {
    if (!this.current(generation)) return;
    const capture = this.ports.capture(
      (take, metadata) => { if (this.current(generation) && this.capture === capture) void this.turn(take, generation, metadata); },
      () => {
        if (!this.current(generation) || this.capture !== capture) return;
        this.observeIgnoredTake({ reason: "insufficientSpeech" });
        void this.listen(generation).catch(error => { if (this.current(generation)) this.fail(error); });
      },
      (error, reason) => {
        if (!this.current(generation) || this.capture !== capture) return;
        if (!isRecoverableNoiseFailure(reason) || this.captureRecoveryUsed) { this.fail(error); return; }
        // The failed take must never reach ASR or execute a partial command.
        // Budget belongs to this session, not to each take or completed turn.
        this.captureRecoveryUsed = true;
        this.capture = null;
        try { capture.cancel(); } catch (cause) { this.fail(cause); return; }
        this.ports.onNotice?.("Se descartó la toma por una interrupción del filtro. Preparando de nuevo el micrófono; repite la frase cuando aparezca «Escuchando».");
        void this.listen(generation).catch(cause => { if (this.current(generation)) this.fail(cause); });
      },
    );
    this.capture = capture;
    this.ports.onState("arming");
    await capture.start();
    if (this.current(generation) && this.capture === capture) this.ports.onState("standby");
  }

  private async turn(take: Blob, generation: number, metadata?: { recordedSeconds?: number }) {
    const id = this.session;
    if (!id || !this.current(generation)) return;
    this.capture = null;
    const now = this.ports.now ?? (() => performance.now());
    const started = now();
    let observation: VoiceTurnObservation | undefined;
    const observed = (patch: Partial<VoiceTurnObservation>) => {
      if (!observation || !this.current(generation)) return;
      observation = { ...observation, ...patch };
      this.ports.onTurnObserved?.(observation);
    };
    try {
      this.ports.onNotice?.("");
      this.ports.onState("transcribing");
      const transcript = await this.ports.transcribe(take, id);
      if (!this.current(generation)) return;
      const transcribed = now();
      const seconds = metadata?.recordedSeconds;
      const captureMs = typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
      const ignoredTranscript = { transcript: transcript.text, transcriptionModel: transcript.model, captureMs, transcriptionMs: transcribed - started };
      if (transcript.noSpeech) {
        this.observeIgnoredTake({ reason: "noSpeech", ...ignoredTranscript });
        await this.listen(generation); return;
      }
      if (isMicrophoneOffCommand(transcript.text)) {
        this.stop("Micrófono apagado por voz. La sesión terminó.");
        return;
      }
      if (isVoiceStopCommand(transcript.text)) {
        this.observeIgnoredTake(null);
        this.ports.onNotice?.("Conversación detenida. Sigo escuchando: dirigite a Alice para hablar otra vez. Para cerrar la escucha, decí «Apaga el micrófono, Alice».");
        await this.listen(generation);
        return;
      }
      if (!(this.ports.acceptTranscript ?? isAddressedToAlice)(transcript.text)) {
        this.observeIgnoredTake({ reason: "notAddressed", ...ignoredTranscript });
        await this.listen(generation); return;
      }
      this.observeIgnoredTake(null);
      observation = { transcript: transcript.text, transcriptionModel: transcript.model,
        captureMs,
        transcriptionMs: transcribed - started, responseMs: null,
        synthesisMs: null, untilPlaybackMs: null, totalMs: null, outcome: "processing" };
      observed({});
      this.ports.onState("thinking");
      const response = await this.ports.respond(transcript.text, id);
      if (!this.current(generation)) return;
      const responded = now();
      observed({ responseMs: responded - transcribed });
      try {
        this.ports.onState("synthesizing");
        const audio = await this.ports.synthesize(response, id);
        if (!this.current(generation)) return;
        observed({ synthesisMs: now() - responded });
        this.ports.onState("speaking");
        await this.ports.play(audio, () => observed({ untilPlaybackMs: now() - started }));
        if (!this.current(generation)) return;
        observed({ outcome: "completed", totalMs: now() - started });
      } catch (error) {
        if (!this.current(generation)) return;
        this.ports.stopPlayback();
        observed({ outcome: "textOnly", totalMs: now() - started });
        this.ports.onNotice?.(`La respuesta está en el chat, pero no pude reproducir su voz. Sigo escuchando. ${String(error)}`);
      }
      if (this.current(generation)) await this.listen(generation);
    } catch (error) {
      if (this.current(generation)) { observed({ outcome: "error", totalMs: now() - started }); this.fail(error); }
    }
  }

  private fail(error: unknown) {
    this.stop();
    this.ports.onState("error", String(error));
  }
}
