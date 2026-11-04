export type VisionSources = { camera: boolean; desktop: boolean };
export type VisionInput = { sessionId: string; camera: { imageBase64: string; capturedAtMs: number } | null; desktop: boolean };
export type CameraHandle = { stream?: MediaStream; capture: () => Promise<string>; close: () => void };
export type VisionServices = {
  openCamera: () => Promise<CameraHandle>;
  begin: (sources: VisionSources) => Promise<string>;
  end: (id: string) => Promise<void>;
};

// Generation guards also cover permissions that resolve after Stop/unmount.
export class VisionSession {
  private generation = 0;
  private active: { id: string; sources: VisionSources; camera?: CameraHandle } | null = null;
  constructor(private services: VisionServices) {}
  get current() { return this.active; }
  async stop() {
    this.generation++;
    const previous = this.active;
    this.active = null;
    previous?.camera?.close();
    if (previous) await this.services.end(previous.id);
  }
  async start(sources: VisionSources) {
    const generation = ++this.generation;
    const previous = this.active;
    this.active = null;
    previous?.camera?.close();
    if (previous) await this.services.end(previous.id);
    if (generation !== this.generation) return false;
    let camera: CameraHandle | undefined;
    let id: string | undefined;
    try {
      if (sources.camera) camera = await this.services.openCamera();
      if (generation !== this.generation) { camera?.close(); return false; }
      id = await this.services.begin(sources);
      if (generation !== this.generation) { camera?.close(); await this.services.end(id); return false; }
      this.active = { id, sources, camera };
      return true;
    } catch (error) {
      camera?.close();
      if (id) await this.services.end(id);
      throw error;
    }
  }
  async capture(): Promise<VisionInput | undefined> {
    const active = this.active;
    if (!active) return undefined;
    const imageBase64 = await active.camera?.capture();
    if (active !== this.active) throw Error("La vista cambió durante la captura. Vuelve a enviar el mensaje.");
    return { sessionId: active.id, desktop: active.sources.desktop,
      camera: imageBase64 ? { imageBase64, capturedAtMs: Date.now() } : null };
  }
}

export async function openConversationCamera(onEnded: () => void, deviceId?: string): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw Error("La cámara no está disponible en este entorno.");
  const devices = await navigator.mediaDevices.enumerateDevices();
  const preferred = deviceId || devices.find(device => device.kind === "videoinput" && /acer|integrated|built.in|hd user facing/i.test(device.label))?.deviceId;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: {ideal:1280}, height:{ideal:720}, ...(preferred ? {deviceId:{exact:preferred}} : {facingMode:"user"}) } });
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.srcObject = stream;
  let closed = false;
  const close = () => { closed = true; stream.getTracks().forEach(track => track.stop()); video.pause(); video.srcObject = null; };
  stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => { if (!closed) onEnded(); }, {once:true}));
  try { await video.play(); } catch (error) { close(); throw error; }
  return { stream, close, capture: async () => {
    if (closed || !stream.getVideoTracks().some(track => track.readyState === "live") || video.readyState < 2 || !video.videoWidth) throw Error("La cámara todavía no tiene una imagen disponible.");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw Error("No se pudo preparar la imagen de cámara.");
    for (const max of [960,640]) {
      const scale = Math.min(1,max/Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1,Math.round(video.videoWidth*scale)); canvas.height = Math.max(1,Math.round(video.videoHeight*scale));
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const frame = canvas.toDataURL("image/png").split(",")[1];
      if (frame && frame.length <= 4_000_000) return frame;
    }
    throw Error("La imagen de cámara supera el tamaño permitido.");
  }};
}
