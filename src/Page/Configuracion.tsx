import type { CloudStatus } from "./Conversacion";

type ConfiguracionProps = {
  desktopApp: boolean;
  status: CloudStatus;
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
};

export function Configuracion({ desktopApp, status, provider, model, onProviderChange, onModelChange }: ConfiguracionProps) {
  const selected = status.providers.find((option) => option.id === provider);
  const configuredCount = status.providers.filter((option) => option.configured).length;

  return <section className="settings-page" aria-labelledby="settings-title">
    <header className="settings-heading">
      <div><p className="eyebrow">CONFIGURACIÓN LOCAL · SISTEMA</p><h2 id="settings-title">Configuración de Alice</h2><p>Las decisiones técnicas permanecen aquí para que Conversación se concentre únicamente en hablar, revisar permisos y enviar.</p></div>
      <div className={`cloud-status ${configuredCount ? "ready" : "offline"}`}><i />{configuredCount ? `${configuredCount} PROVEEDOR${configuredCount === 1 ? "" : "ES"} LISTO${configuredCount === 1 ? "" : "S"}` : "SIN PROVEEDOR LISTO"}</div>
    </header>

    <div className="settings-grid">
      <section className="settings-card inference-settings" aria-labelledby="inference-settings-title">
        <header><span>01</span><div><p className="eyebrow">RUTA DE INFERENCIA</p><h3 id="inference-settings-title">Proveedor y modelo</h3></div></header>
        <p>Esta selección se guarda localmente y se usa como ruta predeterminada para las nuevas conversaciones.</p>
        <div className="settings-provider-list" role="radiogroup" aria-label="Proveedor predeterminado">
          {status.providers.map((option) => <button type="button" role="radio" aria-checked={provider === option.id} key={option.id} className={provider === option.id ? "selected" : ""} onClick={() => onProviderChange(option.id)}>
            <span><strong>{option.label}</strong><small>{option.protocol}</small></span><em className={option.configured ? "ready" : "offline"}>{option.configured ? "LISTO" : option.id === "ollama" ? "NO INICIADO" : "SIN CLAVE"}</em>
          </button>)}
        </div>
        <label className="settings-model-field">MODELO PREDETERMINADO<input value={model} onChange={(event) => onModelChange(event.target.value)} placeholder={selected?.defaultModel || "Identificador del modelo"} /></label>
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
