type PreviewAudio = Pick<HTMLAudioElement, "pause" | "removeAttribute" | "load">;
type PreviewUrls = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

// Owns one local URL for the existing filtered take, never another recording.
export class InputTakePreview {
  private url: string | null = null;
  private audio: PreviewAudio | null = null;
  constructor(private urls: PreviewUrls = URL) {}

  bind(audio: PreviewAudio) { this.audio = audio; }
  isCurrent(url: string) { return this.url === url; }

  replace(take: Blob, current: () => boolean, audio?: PreviewAudio | null): string | null {
    if (!current()) return null;
    this.clear(audio);
    this.url = this.urls.createObjectURL(take);
    return this.url;
  }

  clear(audio?: PreviewAudio | null) {
    const url = this.url;
    this.url = null;
    const player = audio ?? this.audio;
    this.audio = null;
    if (player) {
      try { player.pause(); } catch { /* The player may already be detached. */ }
      try { player.removeAttribute("src"); } catch { /* Still release the URL. */ }
      try { player.load(); } catch { /* A closed player must not block cleanup. */ }
    }
    if (url) this.urls.revokeObjectURL(url);
  }
}
