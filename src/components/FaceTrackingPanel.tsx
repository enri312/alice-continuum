const dependencies = [
  { code: "CAM", label: "Fuente de cámara", detail: "No seleccionada" },
  { code: "MDL", label: "Detector facial", detail: "No instalado" },
  { code: "PTS", label: "Landmarks", detail: "0 puntos" },
  { code: "BLS", label: "Blendshapes", detail: "0 canales" },
  { code: "OUT", label: "Retarget facial", detail: "Sin destino" },
];

const channels = ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmileLeft", "mouthSmileRight", "browInnerUp", "gazeX", "gazeY"];

export function FaceTrackingPanel() {
  return <div className="face-diagnostic">
    <header className="face-diagnostic-header"><div><span>[FACE]</span><strong>FACIAL RETARGET DIAGNOSTIC</strong></div><p><i />SIN SEÑAL</p></header>

    <div className="face-diagnostic-layout">
      <section className="face-device-tree" aria-labelledby="face-devices-title">
        <div className="face-panel-title"><span id="face-devices-title">DEPENDENCIAS</span><small>0 / {dependencies.length}</small></div>
        <div className="face-tree-root"><span>ALICE_FACE_INPUT</span><small>PIPELINE INACTIVO</small></div>
        <div className="face-tree-list">{dependencies.map((dependency) => <div key={dependency.code}><i>{dependency.code}</i><span><strong>{dependency.label}</strong><small>{dependency.detail}</small></span><em /></div>)}</div>
        <div className="face-permission"><strong>PERMISOS</strong><span>Cámara</span><em>NO SOLICITADO</em><span>Persistencia de video</span><em>DESACTIVADA</em></div>
      </section>

      <section className="face-viewport" aria-labelledby="face-viewport-title">
        <div className="face-viewport-toolbar"><span id="face-viewport-title">REFERENCE MESH // NEUTRAL</span><small>NO ES TRACKING</small></div>
        <div className="face-canvas">
          <svg viewBox="0 0 460 360" role="img" aria-label="Malla geométrica neutral de referencia; no representa una cara detectada">
            <defs><radialGradient id="face-panel-gradient"><stop stopColor="#164e63" stopOpacity=".48"/><stop offset="1" stopColor="#020617" stopOpacity=".05"/></radialGradient><filter id="face-panel-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <ellipse cx="230" cy="180" rx="155" ry="145" fill="url(#face-panel-gradient)" opacity=".45" />
            <g className="face-axis" fill="none"><path d="M30 180h400M230 18v324"/><path d="M43 94h22M43 266h22M395 94h22M395 266h22"/></g>
            <g className="face-mesh" fill="none">
              <path d="M230 32C135 30 94 96 105 203c9 90 61 128 125 128s116-38 125-128C366 96 325 30 230 32Z"/>
              <path d="M230 33c-58 42-62 244 0 297M230 33c58 42 62 244 0 297"/>
              <path d="M142 68c50 30 126 30 176 0M113 124c66 27 168 27 234 0M105 183c72 24 178 24 250 0M115 242c67-23 163-23 230 0M148 293c48-20 116-20 164 0"/>
              <path d="M145 157c25-22 60-22 83 0-25 21-60 21-83 0Zm87 0c23-22 58-22 83 0-23 21-58 21-83 0Z"/>
              <path d="M230 151c-14 34-19 70 0 79 19-9 14-45 0-79ZM181 258c31 23 67 23 98 0-29-18-69-18-98 0Z"/>
              <path d="M159 128c19-15 43-16 64-6M237 122c21-10 45-9 64 6"/>
            </g>
            <g className="face-landmarks" filter="url(#face-panel-glow)">
              <circle cx="169" cy="157" r="3"/><circle cx="187" cy="151" r="3"/><circle cx="205" cy="157" r="3"/><circle cx="255" cy="157" r="3"/><circle cx="273" cy="151" r="3"/><circle cx="291" cy="157" r="3"/>
              <circle cx="230" cy="181" r="3"/><circle cx="220" cy="218" r="3"/><circle cx="230" cy="230" r="3"/><circle cx="240" cy="218" r="3"/>
              <circle cx="190" cy="257" r="3"/><circle cx="210" cy="249" r="3"/><circle cx="230" cy="253" r="3"/><circle cx="250" cy="249" r="3"/><circle cx="270" cy="257" r="3"/><circle cx="230" cy="271" r="3"/>
            </g>
            <g className="face-reference-labels"><text x="52" y="88">Y +1.0</text><text x="52" y="279">Y -1.0</text><text x="363" y="175">X +1.0</text><text x="44" y="175">X -1.0</text></g>
          </svg>
          <i className="face-scan-line" aria-hidden="true" />
          <div className="face-no-input"><span>000</span><strong>SIN ENTRADA FACIAL</strong><small>Malla de referencia · cámara desconectada</small></div>
          <span className="face-corner top-left" /><span className="face-corner top-right" /><span className="face-corner bottom-left" /><span className="face-corner bottom-right" />
        </div>
      </section>

      <aside className="face-telemetry">
        <div className="face-panel-title"><span>TELEMETRÍA</span><small>LOCAL</small></div>
        <dl><div><dt>Estado</dt><dd>Desconectado</dd></div><div><dt>Landmarks</dt><dd>0</dd></div><div><dt>Blendshapes</dt><dd>0</dd></div><div><dt>Frecuencia</dt><dd>0 FPS</dd></div><div><dt>Latencia</dt><dd>—</dd></div><div><dt>Confianza</dt><dd>—</dd></div><div><dt>Mirada</dt><dd>— , —</dd></div><div><dt>Speaking</dt><dd>FALSE</dd></div></dl>
        <div className="face-retarget-status"><span>RETARGET OUTPUT</span><strong>NO CONFIGURADO</strong><small>El futuro avatar se asociará aquí.</small></div>
      </aside>
    </div>

    <section className="face-channel-console" aria-labelledby="face-channels-title">
      <div className="face-panel-title"><span id="face-channels-title">FACIAL CHANNELS</span><small>8 RESERVADOS · 0 ACTIVOS</small></div>
      <div className="face-channel-grid">{channels.map((channel, index) => <div key={channel}><span>{String(index + 1).padStart(2, "0")}</span><strong>{channel}</strong><i><em /></i><small>—</small></div>)}</div>
    </section>
    <div className="console-prompt"><strong>ALICE_FACE@LOCAL_PROCESS:~$</strong><span>sin cámara · sin modelo · sin almacenamiento de video</span></div>
  </div>;
}
