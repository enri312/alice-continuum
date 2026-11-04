import type { CloudStatus } from "../conversation/ConversationPage";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../styles/settings-runtime.css";

type ConfiguracionProps = {
  desktopApp: boolean;
  status: CloudStatus;
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  showFullHistory?: boolean;
  onShowFullHistoryChange?: (show: boolean) => void;
};

export function Configuracion({ desktopApp, status, provider, model, onProviderChange, onModelChange, showFullHistory = false, onShowFullHistoryChange }: ConfiguracionProps) {
  const [running, setRunning] = useState(false);
  const [runtimePending, setRuntimePending] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState("");
  useEffect(() => {
    if (!desktopApp) return;
    let mounted = true;
    invoke<{ running: boolean }>("local_runtime_status").then(s => {
      if (!mounted) return;
      setRunning(s.running);
      if (s.running && provider !== "llamacpp") onProviderChange("llamacpp");
    })
      .catch(e => { if (mounted) setRuntimeMessage(String(e)); });
    return () => { mounted = false; };
  }, [desktopApp]);
  async function changeRuntime(start: boolean) {
    setRuntimePending(true); setRuntimeMessage(start ? "Iniciando Gemma… No se activa el micrófono." : "Cerrando el motor propio…");
    try {
      const result = await invoke<{ running: boolean }>(start ? "start_local_runtime" : "stop_local_runtime");
      setRunning(result.running);
      if (result.running) onProviderChange("llamacpp");
      else if (provider === "llamacpp") onProviderChange("ollama");
      setRuntimeMessage(result.running ? "Gemma iniciado y seleccionado como proveedor de conversación." : "Gemma apagado. Ollama quedó seleccionado, pero no se cargó ningún modelo automáticamente.");
    } catch (e) { setRuntimeMessage(String(e)); }
    finally { setRuntimePending(false); }
  }
  const selected = status.providers.find((option) => option.id === provider);
  const configuredCount = status.providers.filter((option) => option.configured).length;

  return <section className="settings-page" aria-labelledby="settings-title">
    <header className="settings-heading">
      <div><p className="eyebrow">CONFIGURACIÓN LOCAL · SISTEMA</p><h2 id="settings-title">Configuración de Alice</h2><p>Las decisiones técnicas permanecen aquí para que Conversación se concentre únicamente en hablar, revisar permisos y enviar.</p></div>
      <div className={`cloud-status ${configuredCount ? "ready" : "offline"}`}><i />{configuredCount ? `${configuredCount} PROVEEDOR${configuredCount === 1 ? "" : "ES"} LISTO${configuredCount === 1 ? "" : "S"}` : "SIN PROVEEDOR LISTO"}</div>
    </header>

    <div className="settings-grid">
      <section className="settings-card" aria-labelledby="conversation-display-title">
        <header><div><p className="eyebrow">CONVERSACIÓN</p><h3 id="conversation-display-title">Historial visible</h3></div></header>
        <label className="context-toggle"><input type="checkbox" checked={showFullHistory} disabled={!onShowFullHistoryChange} onChange={event => onShowFullHistoryChange?.(event.target.checked)} /><span><strong>Mostrar todo el historial en el chat</strong><small>Desactivado: sólo los últimos 12 mensajes. Cambia la vista, no borra conversaciones ni modifica el contexto autorizado o los recuerdos. Se aplica durante esta sesión de la aplicación.</small></span></label>
      </section>
      <section className="settings-card inference-settings" aria-labelledby="inference-settings-title">
        <header><span>01</span><div><p className="eyebrow">RUTA DE INFERENCIA</p><h3 id="inference-settings-title">Proveedor y modelo</h3></div></header>
        <p>Elegí explícitamente la ruta local. OpenRouter permanece pausado. Iniciar Gemma también lo selecciona; cambiar una tarjeta de proveedor no inicia ni apaga modelos.</p>
        <div className="settings-policy settings-runtime">
          <strong>GEMMA LOCAL · {running ? "INICIADO" : "APAGADO O SIN VERIFICAR"}</strong>
          <p>Un solo motor. Si Ollama conserva un modelo cargado, el inicio se rechazará; no se cerrará una sesión ajena. La conversación, transcripción y memoria automática usan Gemma. Los adaptadores antiguos que requieren Ollama quedan bloqueados mientras Gemma está activo.</p>
          <div className="settings-runtime-actions">
            <button className="runtime-start" type="button" disabled={!desktopApp || running || runtimePending} onClick={() => void changeRuntime(true)}>Iniciar Gemma local</button>
            <button className="runtime-stop" type="button" disabled={!desktopApp || (!running && !runtimePending)} onClick={() => void changeRuntime(false)}>{runtimePending ? "Cancelar inicio / apagar" : "Apagar Gemma"}</button>
          </div>
          <p role="status" aria-live="polite">{runtimeMessage}</p>
        </div>
        <div className="settings-provider-list" role="radiogroup" aria-label="Proveedor predeterminado">
          {status.providers.map((option) => <button type="button" role="radio" aria-checked={provider === option.id} key={option.id} disabled={running && option.id !== "llamacpp"} className={provider === option.id ? "selected" : ""} onClick={() => onProviderChange(option.id)}>
            <span><strong>{option.label}</strong><small>{option.protocol}</small></span><em className={option.configured ? "ready" : "offline"}>{option.id === "llamacpp" ? "INICIO MANUAL" : option.configured ? "LISTO" : option.id === "ollama" ? "NO INICIADO" : "SIN CLAVE"}</em>
          </button>)}
        </div>
        <label className="settings-model-field">MODELO PREDETERMINADO<input value={model} readOnly={provider === "llamacpp"} onChange={(event) => onModelChange(event.target.value)} placeholder={selected?.defaultModel || "Identificador del modelo"} /></label>
        <div className="settings-policy"><strong>POLÍTICA DEL ADAPTADOR</strong><span>{selected?.retentionMode ?? "Seleccioná un proveedor para consultar su política."}</span></div>
        <small className="settings-security-note">Las claves API no se muestran ni se escriben aquí. Ollama no usa clave y su adaptador sólo acepta el servidor local fijado a 127.0.0.1.</small>
      </section>

      <section className="settings-card" aria-labelledby="privacy-settings-title">
        <header><span>02</span><div><p className="eyebrow">PRIVACIDAD Y EJECUCIÓN</p><h3 id="privacy-settings-title">Estado local</h3></div></header>
        <dl><div><dt>Aplicación</dt><dd>{desktopApp ? "ESCRITORIO NATIVO" : "NAVEGADOR DE DESARROLLO"}</dd></div><div><dt>Revisión antes de enviar</dt><dd>OBLIGATORIA</dd></div><div><dt>Memoria</dt><dd>LOCAL Y EDITABLE</dd></div><div><dt>Herramientas remotas</dt><dd>DESACTIVADAS</dd></div></dl>
      </section>

      <section className="settings-card" aria-labelledby="hardware-settings-title">
        <header><span>03</span><div><p className="eyebrow">BODY SOLVER · HARDWARE</p><h3 id="hardware-settings-title">Dispositivos externos</h3></div></header>
        <div className="settings-device"><i /><div><strong>SIN DISPOSITIVO CONFIGURADO</strong><small>El cuerpo y el rostro permanecen en SAFE OFF.</small></div></div>
        <p>Los visores y controladores VR se incorporarán mediante adaptadores independientes cuando exista el hardware. La lógica cognitiva no dependerá de una marca concreta.</p>
      </section>
    </div>
  </section>;
}
