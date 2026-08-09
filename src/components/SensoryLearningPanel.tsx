type SensoryLearningPanelProps = {
  observationEnabled: boolean;
};

const sources = [
  { id: "screen", code: "SCR", label: "Pantalla seleccionada", adapter: "Windows Graphics Capture", phase: "R2", policy: "Fotogramas temporales elegidos mediante el selector seguro de Windows; no grabación continua." },
  { id: "camera", code: "CAM", label: "Cámara de la notebook", adapter: "Windows MediaCapture", phase: "R2", policy: "Vista previa visible y sesión revocable; los fotogramas se descartan después del análisis local." },
  { id: "microphone", code: "MIC", label: "Micrófono", adapter: "WASAPI + VAD / Whisper local", phase: "R2", policy: "Solo durante una sesión autorizada; primero se detecta voz y después se propone una transcripción." },
  { id: "media", code: "MED", label: "Música y reproductores", adapter: "Windows Media Control", phase: "R2", policy: "Primero título, artista, aplicación y estado de reproducción; no se captura el audio si existen metadatos." },
  { id: "actions", code: "ACT", label: "Acciones en el equipo", adapter: "UI Automation events", phase: "R5", policy: "Eventos estructurados de foco y controles; nunca registro global de teclas ni contraseñas." },
  { id: "gestures", code: "GST", label: "Gestos, rostro y pose", adapter: "MediaPipe Tasks local", phase: "R9", policy: "Landmarks y gestos derivados en memoria temporal; no identificación biométrica ni almacenamiento facial." },
] as const;

export function SensoryLearningPanel({ observationEnabled }: SensoryLearningPanelProps) {
  return <section className="sensory-learning" aria-labelledby="sensory-learning-title">
    <header>
      <div><p className="eyebrow">APRENDIZAJE MULTIMODAL · GOBERNADO</p><h3 id="sensory-learning-title">Lo que Alice podrá aprender de su entorno</h3><p>Observar no equivale a recordar. Cada señal se procesa localmente, produce un candidato explicable y solo se vuelve recuerdo después de tu confirmación.</p></div>
      <div className="sensory-gate"><i />GATEWAY R2 REQUERIDO</div>
    </header>

    <div className="sensory-current-limit"><span>CAPACIDAD ACTUAL</span><strong>METADATOS DE VENTANA · {observationEnabled ? "ACTIVOS" : "DESACTIVADOS"}</strong><small>Hoy Alice únicamente puede consultar, con autorización, el título y proceso de la ventana en primer plano. No recibe píxeles, cámara ni audio.</small></div>

    <div className="sensory-source-grid">
      {sources.map((source) => <article key={source.id}>
        <header><span>{source.code}</span><div><strong>{source.label}</strong><small>{source.adapter}</small></div><em>{source.phase}</em></header>
        <p>{source.policy}</p>
        <footer><i />NO CONECTADO</footer>
      </article>)}
    </div>

    <div className="learning-pipeline" aria-label="Flujo gobernado de aprendizaje">
      <div><span>01</span><strong>SESIÓN AUTORIZADA</strong><small>fuente y duración visibles</small></div><i>→</i><div><span>02</span><strong>ANÁLISIS LOCAL</strong><small>sin conservar señal cruda</small></div><i>→</i><div><span>03</span><strong>CANDIDATO</strong><small>origen y confianza</small></div><i>→</i><div><span>04</span><strong>CONFIRMACIÓN</strong><small>guardar, corregir o descartar</small></div>
    </div>

    <section className="learning-inbox" aria-labelledby="learning-inbox-title">
      <header><div><p className="eyebrow">BANDEJA DE CANDIDATOS</p><h4 id="learning-inbox-title">Aprendizajes pendientes</h4></div><span>0 CANDIDATOS</span></header>
      <div><strong>SIN OBSERVACIONES PROPUESTAS</strong><p>La bandeja permanecerá vacía hasta que R1 registre cada capacidad y R2 pueda conceder una sesión específica y revocable.</p><button type="button" disabled>Iniciar sesión sensorial · requiere R2</button></div>
    </section>
  </section>;
}
