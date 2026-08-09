import { useEffect, useMemo, useRef, useState } from "react";
import { buildIdentificationSnapshot } from "../core/identification";
import type { IdentificationInputs, IdentificationSnapshot } from "../core/identification";

type TimedSnapshot = {
  snapshot: IdentificationSnapshot;
  processingMs: number;
};

type IdentificacionProps = IdentificationInputs & {
  observationAvailable: boolean;
  onToggleObservation: () => void;
  onConverse: () => void;
};

const evidenceLabels = {
  observed: "OBSERVADO",
  heuristic: "HEURÍSTICO",
  unavailable: "NO DISPONIBLE",
} as const;

const demoContexts = [
  "Era una broma, no te enojes conmigo.",
  "Eso no salió como esperábamos, pero podemos revisarlo juntos.",
  "Me dio curiosidad. Cuéntame un poco más.",
];

function createTimedSnapshot(inputs: IdentificationInputs): TimedSnapshot {
  const startedAt = performance.now();
  const snapshot = buildIdentificationSnapshot(inputs);
  return { snapshot, processingMs: performance.now() - startedAt };
}

export function Identificacion(props: IdentificacionProps) {
  const { observationAvailable, onToggleObservation, onConverse, ...identificationInputs } = props;
  const [mode, setMode] = useState<"live" | "paused">("live");
  const [frozen, setFrozen] = useState<TimedSnapshot | null>(null);
  const [cycle, setCycle] = useState(1);
  const [inspect, setInspect] = useState(true);
  const [stagedInput, setStagedInput] = useState("");
  const [diagnosticInput, setDiagnosticInput] = useState("");
  const [diagnosticMode, setDiagnosticMode] = useState<"manual" | "auto-demo">("manual");
  const [demoIndex, setDemoIndex] = useState(-1);
  const fingerprintRef = useRef("");
  const analysisInputs = useMemo(() => ({ ...identificationInputs, diagnosticInput, diagnosticMode }), [
    props.cloudPending,
    props.draft,
    props.foregroundContext,
    props.lastUserMessage,
    props.memoryCount,
    props.messageCount,
    props.observerEnabled,
    props.retrievedMemoryCount,
    diagnosticInput,
    diagnosticMode,
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

  function injectDiagnosticInput() {
    const input = stagedInput.trim();
    if (!input) return;
    setDiagnosticInput(input);
    setDiagnosticMode("manual");
    setMode("live");
  }

  function loadNextDemoContext() {
    const nextIndex = (demoIndex + 1) % demoContexts.length;
    const next = demoContexts[nextIndex];
    setDemoIndex(nextIndex);
    setDiagnosticInput(next);
    setDiagnosticMode("auto-demo");
    setMode("live");
  }

  return <section className="identification-page" aria-labelledby="identification-title">
    <header className="identification-header">
      <div className="identification-title-block">
        <span className="identification-mark">00</span>
        <div>
          <p className="eyebrow">[00] ACTIVE VIEW</p>
          <h2 id="identification-title">PERCEPTION DIAGNOSTIC <span>// LOCAL</span></h2>
        </div>
      </div>
      <div className="identification-status" aria-label={`Estado ${mode}`}>
        <i className={mode} />
        <strong>{mode === "live" ? "LIVE" : "PAUSED"}</strong>
        <small>{snapshot.source === "none" ? "WAITING_INPUT" : "LOCAL_INPUT"}</small>
      </div>
    </header>

    <dl className="identification-telemetry">
      <div><dt>CYCLE</dt><dd>{String(cycle).padStart(7, "0")}</dd></div>
      <div><dt>COGNITIVE UPDATE</dt><dd>EVENT_DRIVEN</dd></div>
      <div><dt>AFFECT SIM</dt><dd>UNMODELED / OFF</dd></div>
      <div><dt>PROCESSING</dt><dd>{current.processingMs.toFixed(3)} MS</dd></div>
      <div><dt>RENDER</dt><dd>{mode === "live" ? "AUTO_REND" : "FROZEN"}</dd></div>
    </dl>

    <div className="identification-controls" aria-label="Controles del panel">
      <button className={mode === "live" ? "selected" : ""} type="button" onClick={resume}>LIVE</button>
      <button type="button" onClick={step}>STEP</button>
      <button className={mode === "paused" ? "selected warning" : ""} type="button" onClick={pause}>PAUSE</button>
      <button className={mode === "live" ? "selected" : ""} type="button" onClick={resume}>AUTO_REND</button>
      <button className={props.observerEnabled ? "selected" : ""} type="button" aria-pressed={props.observerEnabled} onClick={onToggleObservation} disabled={!observationAvailable} title={observationAvailable ? "Activar o detener la observación local autorizada" : "La observación está disponible en la aplicación de escritorio"}>OBSERVE</button>
      <button type="button" onClick={onConverse}>CONVERSE</button>
      <button className={inspect ? "selected" : ""} type="button" aria-pressed={inspect} onClick={() => setInspect((currentInspect) => !currentInspect)}>INSPECT</button>
      <button type="button" disabled title="El historial de ciclos aún no está implementado">REPLAY · R1+</button>
      <span className="identification-failsafe"><i /> FAILSAFE · LOCAL ONLY</span>
    </div>

    <div className="identification-body">
      <section className="identification-input" aria-labelledby="perception-input-title">
        <header>
          <h3 id="perception-input-title"><span>[00]</span> CONVERSATION / PERCEPTION INPUT</h3>
          <small>AUTO_DEMO · MANUAL</small>
        </header>
        <div className="identification-injector">
          <textarea aria-label="Texto preparado para inyección local" value={stagedInput} onChange={(event) => { const value = event.target.value; setStagedInput(value); if (!value.trim() && diagnosticMode === "manual") { setDiagnosticInput(""); setDemoIndex(-1); } }} placeholder="Ej.: TEST DE PERSONALIDAD MÚLTIPLE Y LIBRE ALBEDRÍO" />
          <div><button type="button" onClick={injectDiagnosticInput} disabled={!stagedInput.trim()}>INJECT INPUT</button><button type="button" onClick={loadNextDemoContext}>NEXT AUTO CONTEXT</button></div>
          <small>SIMULADOR LOCAL · no envía a la nube, no conversa y no guarda memoria</small>
        </div>
        <div className="identification-processed" aria-live="polite">
          <div className="identification-received"><span>ACTIVE INPUT</span><strong>{snapshot.input || "SIN ENTRADA ACTIVA"}</strong><small>{snapshot.source === "diagnostic" ? diagnosticMode === "auto-demo" ? "AUTO_DEMO" : "MANUAL_INPUT" : snapshot.source === "none" ? "WAITING_INPUT" : "LIVE_CONTEXT"}</small></div>
          <div className={`identification-tokens ${snapshot.tokens.length ? "" : "empty"}`}>{snapshot.tokens.length ? snapshot.tokens.map((token, index) => <span key={`${token}-${index}`}>{token}</span>) : <p><strong>0 TOKENS</strong><span>Esperando entrada de conversación o contexto simulado.</span></p>}</div>
          <small className="identification-token-count">{snapshot.tokens.length} TOKENS · VISUAL MAX 32</small>
        </div>
        {snapshot.tokens.length >= 32 && <p className="identification-limit">La visualización se limita a los primeros 32 tokens.</p>}
      </section>

      <section className="perception-vector" aria-labelledby="perception-vector-title">
        <header>
          <h3 id="perception-vector-title">PERCEPTION VECTOR</h3>
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
