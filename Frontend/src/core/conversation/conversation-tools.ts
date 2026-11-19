import { invoke } from "@tauri-apps/api/core";
import { openConversationCamera, VisionSession, type VisionSources } from "./vision-session";

type Action = { type: string; value?: unknown };
type DocumentPreview = {
  status: "ok" | "noText";
  sourceSha256: string;
  totalPages: number;
  chunks: { page: number; startChar: number; endChar: number; text: string }[];
};

export function createDocumentReader(container: HTMLElement, publish: () => void) {
  let file: File | undefined;
  let busy = false;
  let disposed = false;
  let error = "";
  let preview: DocumentPreview | null = null;
  const input = () => container.querySelector<HTMLInputElement>(".document-preview input[type=file]");

  async function read() {
    if (!file || busy || disposed) return;
    error = "";
    preview = null;
    const selected = file;
    const format = file.name.split(".").pop()?.toLowerCase();
    if (!format || !["pdf", "md", "txt"].includes(format) || file.size > 16 * 1024 * 1024) {
      error = "Seleccioná un archivo PDF, MD o TXT de hasta 16 MiB.";
      publish();
      return;
    }
    busy = true;
    publish();
    try {
      const bytes = Array.from(new Uint8Array(await selected.arrayBuffer()));
      if (disposed) return;
      const response = await invoke<DocumentPreview>("preview_document", { bytes, format, confirmed: true });
      if (!disposed) preview = response;
    } catch (cause) {
      if (!disposed) error = String(cause);
    } finally {
      busy = false;
      if (!disposed) publish();
    }
  }

  return {
    snapshot: () => ({ hasFile: Boolean(file), busy, error, preview }),
    dispatch(action: Action) {
      if (disposed || busy) return;
      if (action.type === "documentRead") {
        void read();
      } else if (action.type === "documentSelect" || action.type === "documentDiscard") {
        const element = input();
        if (element && action.type === "documentDiscard") element.value = "";
        file = element?.files?.[0];
        preview = null;
        error = "";
        publish();
      }
    },
    dispose() { disposed = true; file = undefined; preview = null; },
  };
}

const sourcesOff: VisionSources = { camera: false, desktop: false };

export function createConversationVision(container: HTMLElement, publish: () => void) {
  let sources = sourcesOff;
  let available = false;
  let busy = false;
  let error = "";
  let preview = "";
  let lastFrame = "";
  let expanded = false;
  let devices: { id: string; label: string }[] = [];
  let deviceId = "";
  let disposed = false;
  let generation = 0;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const session = new VisionSession({
    openCamera: () => openConversationCamera(() => void stop("Se desconectó la cámara. Las vistas se detuvieron."), deviceId),
    begin: async selected => (await invoke<{ sessionId: string }>("start_vision_session", { sources: selected })).sessionId,
    end: id => invoke("stop_vision_session", { input: { sessionId: id } }),
  });
  const current = (operation: number) => !disposed && operation === generation;

  function attachVideo() {
    const video = container.querySelector<HTMLVideoElement>(".vision-previews video");
    if (video) video.srcObject = session.current?.camera?.stream ?? null;
  }

  async function stop(reason = "") {
    const operation = ++generation;
    clearTimeout(expiry);
    sources = sourcesOff;
    busy = false;
    preview = "";
    lastFrame = "";
    error = reason;
    try {
      const stopped = session.stop();
      attachVideo();
      if (!disposed) publish();
      await stopped;
    } catch (cause) {
      if (current(operation)) {
        error = String(cause);
        publish();
      }
    }
  }

  async function changeSources(selected: VisionSources) {
    if (!available || busy || disposed) return;
    if (!selected.camera && !selected.desktop) {
      await stop();
      return;
    }
    const operation = ++generation;
    clearTimeout(expiry);
    sources = sourcesOff;
    busy = true;
    error = "";
    preview = "";
    publish();
    try {
      if (!await session.start(selected) || !current(operation)) return;
      sources = selected;
      expiry = setTimeout(() => void stop("La sesión visual venció después de dos horas."), 2 * 60 * 60 * 1_000);
      if (selected.camera) {
        deviceId = session.current?.camera?.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
        const availableDevices = await navigator.mediaDevices.enumerateDevices();
        if (!current(operation)) return;
        devices = availableDevices.filter(device => device.kind === "videoinput").map((device, i) => ({
          id: device.deviceId, label: device.label || `Cámara ${i + 1}`,
        }));
      }
      if (selected.desktop && session.current) {
        const frame = await invoke<string>("preview_vision_desktop", { input: { sessionId: session.current.id } });
        if (current(operation)) preview = `data:image/png;base64,${frame}`;
      }
    } catch (cause) {
      if (current(operation)) await stop(`No se activó la vista: ${String(cause)}`);
    } finally {
      if (current(operation)) {
        busy = false;
        attachVideo();
        publish();
      }
    }
  }

  return {
    snapshot: () => ({ available, ...sources, busy, error, preview, lastFrame, expanded, devices, deviceId }),
    setAvailable(next: boolean) {
      if (next === available || disposed) return;
      available = next;
      if (!next) void stop();
      else publish();
    },
    async capture() {
      if (disposed || !available) return;
      const frame = await session.capture();
      if (frame && !disposed) {
        lastFrame = new Date().toLocaleTimeString("es-PY");
        publish();
      }
      return frame;
    },
    dispatch(action: Action) {
      if (disposed) return;
      switch (action.type) {
        case "visionCamera": void changeSources({ ...sources, camera: !sources.camera }); break;
        case "visionDesktop": void changeSources({ ...sources, desktop: !sources.desktop }); break;
        case "visionDevice":
          if (sources.camera && !busy && typeof action.value === "string" && devices.some(device => device.id === action.value)) {
            deviceId = action.value;
            void changeSources(sources);
          }
          break;
        case "visionExpand": expanded = !expanded; publish(); break;
        case "visionStop": void stop(); break;
        case "visionVideoReady": attachVideo(); break;
      }
    },
    dispose() { disposed = true; void stop(); },
  };
}
