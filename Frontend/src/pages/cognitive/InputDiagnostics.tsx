import { useEffect, useMemo, useRef, useState } from "react";
import { buildIdentificationSnapshot } from "../../core/cognitive/identification";
import type { IdentificationInputs, IdentificationSnapshot } from "../../core/cognitive/identification";

type TimedSnapshot = {
  snapshot: IdentificationSnapshot;
  processingMs: number;
};

type IdentificacionProps = IdentificationInputs & {
  observationAvailable: boolean;
  onToggleObservation: () => void;
};

const evidenceLabels = {
  observed: "OBSERVADO",
  heuristic: "HEURÍSTICO",
  unavailable: "NO DISPONIBLE",
} as const;

function createTimedSnapshot(inputs: IdentificationInputs): TimedSnapshot {
  const startedAt = performance.now();
  const snapshot = buildIdentificationSnapshot(inputs);
  return { snapshot, processingMs: performance.now() - startedAt };
}

export function InputDiagnostics(props: IdentificacionProps) {
  const { observationAvailable, onToggleObservation, ...identificationInputs } = props;
  const [mode, setMode] = useState<"live" | "paused">("live");
  const [frozen, setFrozen] = useState<TimedSnapshot | null>(null);
  const [cycle, setCycle] = useState(1);
  const [inspect, setInspect] = useState(true);
  const fingerprintRef = useRef("");
  const analysisInputs = useMemo(() => identificationInputs, [
    props.cloudPending,
    props.draft,
    props.foregroundContext,
    props.lastUserMessage,
    props.memoryCount,
    props.messageCount,
    props.observerEnabled,
    props.retrievedMemoryCount,
  ]);
  const live = useMemo(() => createTimedSnapshot(analysisInputs), [analysisInputs]);
  const fingerprint = JSON.stringify({
    source: live.snapshot.source,
    input: live.snapshot.input,
    messages: props.messageCount,
    memories: props.memoryCount,
    retrieval: props.retrievedMemoryCount,
    context: props.foregroundContext,
    cloudPending: props.cloudPending,
  });

  useEffect(() => {
    if (mode !== "live" || fingerprintRef.current === fingerprint) return;
    fingerprintRef.current = fingerprint;
    setCycle((current) => current + 1);
  }, [fingerprint, mode]);

  const current = mode === "live" ? live : frozen ?? live;
  const { snapshot } = current;

  function pause() {
    setFrozen(live);
    setMode("paused");
  }

  function step() {
    setFrozen(createTimedSnapshot(analysisInputs));
    setCycle((currentCycle) => currentCycle + 1);
    setMode("paused");
  }

  function resume() {
    fingerprintRef.current = fingerprint;
    setMode("live");
    setCycle((currentCycle) => currentCycle + 1);
  }

  return <section className="identification-page" aria-labelledby="input-diagnostic-title">
    <header className="identification-header">
      <div className="identification-title-block">
        <span className="identification-mark">00</span>
        <div>
          <p className="eyebrow">ANÁLISIS LOCAL DEL MENSAJE</p>
          <h3 id="input-diagnostic-title">Diagnóstico de entrada</h3>
        </div>
      </div>
      <div className="identification-status" aria-label={`Estado ${mode}`}>
        <i className={mode} />
        <strong>{mode === "live" ? "LIVE" : "PAUSED"}</strong>
        <small>{snapshot.source === "none" ? "WAITING_INPUT" : "LOCAL_INPUT"}</small>
      </div>
    </header>

    <dl className="identification-telemetry">
      <div><dt>CICLO</dt><dd>{String(cycle).padStart(7, "0")}</dd></div>
      <div><dt>ACTUALIZACIÓN</dt><dd>POR EVENTOS</dd></div>
      <div><dt>AFFECT SIM</dt><dd>UNMODELED / OFF</dd></div>
      <div><dt>ANÁLISIS LOCAL</dt><dd>{current.processingMs.toFixed(3)} MS</dd></div>
      <div><dt>RENDER</dt><dd>{mode === "live" ? "AUTO_REND" : "FROZEN"}</dd></div>
    </dl>

    <p className="diagnostic-explanation">Esta vista analiza el texto con reglas locales. Congelarla sólo detiene este diagnóstico; la conversación y el micrófono siguen sus propios controles. El tiempo mostrado no es la latencia de Gemma.</p>
    <div className="identification-controls" aria-label="Controles del diagnóstico de entrada">
      <button type="button" aria-pressed={mode === "live"} onClick={resume}>Actualizar en vivo</button>
      <button type="button" onClick={step}>Capturar diagnóstico</button>
      <button type="button" aria-pressed={mode === "paused"} onClick={pause}>Congelar diagnóstico</button>
      <button type="button" aria-pressed={inspect} onClick={() => setInspect(value => !value)}>Detalles de las reglas</button>
      <button type="button" onClick={onToggleObservation} disabled={!observationAvailable}>Gestionar observación</button>
    </div>

    <div className="identification-body">
      <section className="identification-input" aria-labelledby="perception-input-title">
        <header>
          <h4 id="perception-input-title">Palabras del mensaje</h4>
          <small>REAL_INPUT · REVIEW_REQUIRED</small>
        </header>
        <div className="identification-processed" aria-live="polite">
          <div className="identification-received"><span>ACTIVE INPUT</span><strong>{snapshot.input || "SIN ENTRADA ACTIVA"}</strong><small>{snapshot.source === "none" ? "WAITING_INPUT" : "LIVE_CONTEXT"}</small></div>
          <div className={`identification-tokens ${snapshot.tokens.length ? "" : "empty"}`}>{snapshot.tokens.length ? snapshot.tokens.map((token, index) => <span key={`${token}-${index}`}>{token}</span>) : <p><strong>SIN TEXTO</strong><span>Esperando una entrada real de conversación o percepción autorizada.</span></p>}</div>
          <small className="identification-token-count">{snapshot.tokens.length} PALABRAS · MÁXIMO 32</small>
        </div>
        {snapshot.tokens.length >= 32 && <p className="identification-limit">La visualización se limita a las primeras 32 palabras; no es el tokenizador del modelo.</p>}
      </section>

      <section className="perception-vector" aria-labelledby="perception-vector-title">
        <header>
          <h4 id="perception-vector-title">Origen y clasificación</h4>
          <small>PROVENANCE REQUIRED</small>
        </header>
        <dl>
          {snapshot.fields.map((field) => <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>
              <strong>{field.value}</strong>
              <span className={`evidence-${field.evidence}`}>{evidenceLabels[field.evidence]}</span>
              {inspect && <small>{field.detail}</small>}
            </dd>
          </div>)}
        </dl>
      </section>

    </div>
  </section>;
}
