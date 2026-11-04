import type { VoiceTurnTranscript } from "./voice-input";
import type { VoiceOutputResult } from "./voice-output";
import { isVoiceStopCommand } from "./voice-commands";

export type VoiceLoopState = "idle" | "preparing" | "arming" | "listening" | "transcribing" | "thinking" | "synthesizing" | "speaking" | "error";
type Turn = { exchangeId: string };
export type VoiceTurnObservation = {
  transcript: string;
  transcriptionMs: number;
  responseMs: number | null;
  synthesisMs: number | null;
  untilPlaybackMs: number | null;
  totalMs: number | null;
  outcome: "processing" | "completed" | "textOnly" | "error";
};
export type VoiceLoopPorts = {
  authorize: () => Promise<string>;
  revoke: (id: string) => Promise<void>;
  capture: (onRecorded: (take: Blob) => void, onQuiet: () => void, onError: (error: string) => void) => { start: () => Promise<void>; cancel: () => void; finish: () => void };
  transcribe: (take: Blob, id: string) => Promise<VoiceTurnTranscript>;
  respond: (text: string, id: string) => Promise<Turn>;
  synthesize: (turn: Turn, id: string) => Promise<VoiceOutputResult>;
  play: (audio: VoiceOutputResult, onStarted?: () => void) => Promise<void>;
  stopPlayback: () => void;
  acceptTranscript?: (text: string) => boolean;
  now?: () => number;
  onTurnObserved?: (turn: VoiceTurnObservation) => void;
  onNotice?: (message: string) => void;
  onState: (state: VoiceLoopState, error?: string) => void;
};

export class VoiceLoop {
  private generation = 0;
  private session: string | null = null;
  private capture: ReturnType<VoiceLoopPorts["capture"]> | null = null;
  private active = false;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  constructor(private ports: VoiceLoopPorts) {}

  async start() {
    if (this.active) return;
    this.active = true;
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

  private async listen(generation: number) {
    if (!this.current(generation)) return;
    const capture = this.ports.capture(
      take => { if (this.current(generation) && this.capture === capture) void this.turn(take, generation); },
      () => { if (this.current(generation) && this.capture === capture) void this.listen(generation).catch(error => { if (this.current(generation)) this.fail(error); }); },
      error => { if (this.current(generation) && this.capture === capture) this.fail(error); },
    );
    this.capture = capture;
    this.ports.onState("arming");
    await capture.start();
    if (this.current(generation) && this.capture === capture) this.ports.onState("listening");
  }

  private async turn(take: Blob, generation: number) {
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
      if (transcript.noSpeech) { await this.listen(generation); return; }
      if (isVoiceStopCommand(transcript.text)) {
        this.stop("Conversación detenida por voz. El micrófono está apagado.");
        return;
      }
      if (this.ports.acceptTranscript && !this.ports.acceptTranscript(transcript.text)) {
        await this.listen(generation); return;
      }
      const transcribed = now();
      observation = { transcript: transcript.text, transcriptionMs: transcribed - started, responseMs: null,
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
