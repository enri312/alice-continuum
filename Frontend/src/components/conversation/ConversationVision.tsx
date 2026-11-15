import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openConversationCamera, VisionSession, type VisionInput, type VisionSources } from "../../core/conversation/vision-session";
import "../../styles/conversation-vision.css";

export type ConversationVisionHandle = { capture: () => Promise<VisionInput | undefined> };
const off: VisionSources = {camera:false,desktop:false};
export const ConversationVision = forwardRef<ConversationVisionHandle, { desktopApp: boolean; provider: string }>(function ConversationVision({desktopApp,provider},ref) {
  const [sources,setSources] = useState(off);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [preview,setPreview] = useState("");
  const [lastFrame,setLastFrame] = useState("");
  const [expanded,setExpanded] = useState(false);
  const [devices,setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId,setDeviceId] = useState("");
  const selectedDevice = useRef("");
  const video = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  const operation = useRef(0);
  const session = useRef<VisionSession | null>(null);
  if (!session.current) session.current = new VisionSession({
    openCamera: () => openConversationCamera(() => { void stop("Se desconectó la cámara. Las vistas se detuvieron."); },selectedDevice.current),
    begin: async selected => (await invoke<{sessionId:string}>("start_vision_session",{sources:selected})).sessionId,
    end: id => invoke("stop_vision_session",{input:{sessionId:id}}),
  });
  async function stop(reason = "") {
    operation.current++;
    setBusy(false); setSources(off); setPreview(""); setLastFrame(""); setError(reason);
    try { await session.current!.stop(); } catch (cause) { if (mounted.current) setError(String(cause)); }
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current=false; operation.current++; void session.current!.stop().catch(() => {}); };
  },[]);
  useEffect(() => { if (provider !== "llamacpp") void stop(); },[provider]);
  useEffect(() => {
    if (video.current) video.current.srcObject = session.current?.current?.camera?.stream ?? null;
    if (!sources.camera && !sources.desktop) return;
    const timer = window.setTimeout(() => { void stop("La sesión visual venció después de dos horas."); },2*60*60*1000);
    return () => window.clearTimeout(timer);
  },[sources]);
  useImperativeHandle(ref,() => ({capture: async () => {
    const frame = await session.current!.capture();
    if (frame && mounted.current) setLastFrame(new Date().toLocaleTimeString("es-PY"));
    return frame;
  }}),[]);
  async function changeSources(selected: VisionSources) {
    if (!selected.camera && !selected.desktop) { await stop(); return; }
    const token = ++operation.current;
    setBusy(true); setError(""); setPreview(""); setSources(off);
    try {
      if (!await session.current!.start(selected) || token !== operation.current || !mounted.current) return;
      setSources(selected);
      if (selected.camera) {
        const current = session.current!.current!.camera!.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? "";
        const available = await navigator.mediaDevices.enumerateDevices();
        if (token !== operation.current || !mounted.current) return;
        setDevices(available.filter(device => device.kind === "videoinput"));
        selectedDevice.current = current; setDeviceId(current);
      }
      if (selected.desktop) {
        const id = session.current!.current!.id;
        const frame = await invoke<string>("preview_vision_desktop",{input:{sessionId:id}});
        if (token === operation.current && mounted.current) setPreview(`data:image/png;base64,${frame}`);
      }
    } catch (cause) {
      if (token === operation.current && mounted.current) await stop(`No se activó la vista: ${String(cause)}`);
    } finally { if (token === operation.current && mounted.current) setBusy(false); }
  }
  const active = sources.camera || sources.desktop;
  return <section className={`conversation-vision ${active ? "active" : ""}`} aria-label="Vista de Alice">
    <div className="vision-toolbar"><span className="vision-status"><i />{busy ? "Preparando vista…" : active ? "Vista activa · Gemma local" : "Vista de Alice"}</span>
      <button type="button" aria-pressed={sources.camera} disabled={!desktopApp || provider !== "llamacpp" || busy} onClick={() => void changeSources({...sources,camera:!sources.camera})}>{sources.camera ? "Apagar cámara" : "Activar cámara"}</button>
      <button type="button" aria-pressed={sources.desktop} disabled={!desktopApp || provider !== "llamacpp" || busy} onClick={() => void changeSources({...sources,desktop:!sources.desktop})}>{sources.desktop ? "Dejar de compartir" : "Compartir escritorio"}</button>
      {(active || busy) && <button type="button" className="vision-stop" onClick={() => void stop()}>Detener vistas</button>}
      {active && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Ocultar vistas" : "Ver vistas"}</button>}
    </div>
    {sources.camera && <label className="vision-device">Cámara <select aria-label="Cámara para Alice" value={deviceId} disabled={busy} onChange={event => { selectedDevice.current=event.target.value; setDeviceId(event.target.value); void changeSources(sources); }}>{devices.map((device,index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Cámara ${index+1}`}</option>)}</select></label>}
    <p>{active ? `Imagen nueva al responder por voz o texto.${lastFrame ? ` Último turno visual: ${lastFrame}.` : " Pregúntame qué veo."}` : "Activa una vista para hablar de lo que tienes delante o de tu pantalla."}</p>
    {active && <div className="vision-previews" hidden={!expanded}>
      {sources.camera && <figure><video ref={video} autoPlay muted playsInline /><figcaption>Cámara · vista en directo</figcaption></figure>}
      {sources.desktop && <figure>{preview && <img src={preview} alt="Vista inicial del escritorio compartido" />}<figcaption>Escritorio · vista inicial; se captura de nuevo en cada turno</figcaption></figure>}
    </div>}
    {expanded && active && <small>Se procesan imágenes en este equipo. El chat conserva las respuestas, sin guardar los fotogramas. Compartes todos los monitores visibles; las ventanas minimizadas y los archivos sin abrir quedan fuera de la vista.</small>}
    {error && <p role="alert" className="vision-error">{error}</p>}
  </section>;
});
