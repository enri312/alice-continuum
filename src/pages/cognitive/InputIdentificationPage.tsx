import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DocumentPreview } from "../../components/documents/DocumentPreview";
import { buildIdentificationSnapshot } from "../../core/cognitive/identification";
import type { IdentificationInputs, IdentificationSnapshot } from "../../core/cognitive/identification";

type TimedSnapshot = {
  snapshot: IdentificationSnapshot;
  processingMs: number;
};

type IdentificacionProps = IdentificationInputs & {
  observationAvailable: boolean;
  onToggleObservation: () => void;
  conversationPanel: ReactNode;
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

export function Identificacion(props: IdentificacionProps) {
  const { observationAvailable, onToggleObservation, conversationPanel, ...identificationInputs } = props;
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
      <button className={`identification-control-mode ${mode === "live" ? "selected" : ""}`} type="button" aria-pressed={mode === "live"} onClick={resume}>LIVE</button>
      <button className="identification-control-action" type="button" onClick={step}>STEP</button>
      <button className={`identification-control-mode ${mode === "paused" ? "selected warning" : ""}`} type="button" aria-pressed={mode === "paused"} onClick={pause}>PAUSE</button>
      <button className={`identification-control-mode ${mode === "live" ? "selected" : ""}`} type="button" aria-pressed={mode === "live"} onClick={resume}>AUTO_REND</button>
      <button className={`identification-control-toggle ${props.observerEnabled ? "selected" : ""}`} type="button" aria-pressed={props.observerEnabled} onClick={onToggleObservation} disabled={!observationAvailable} title={observationAvailable ? "Activar o detener la observación local autorizada" : "La observación está disponible en la aplicación de escritorio"}>OBSERVE</button>
      <button className="identification-control-action" type="button" onClick={() => document.getElementById("alice-message")?.focus()}>CONVERSE</button>
      <button className={`identification-control-toggle ${inspect ? "selected" : ""}`} type="button" aria-pressed={inspect} onClick={() => setInspect((currentInspect) => !currentInspect)}>INSPECT</button>
      <button className="identification-control-action" type="button" disabled title="El historial de ciclos aún no está implementado">REPLAY · R1+</button>
      <span className="identification-failsafe"><i /> FAILSAFE · LOCAL ONLY</span>
    </div>

    <div className="identification-body">
      <section className="identification-input" aria-labelledby="perception-input-title">
        <header>
          <h3 id="perception-input-title"><span>[00]</span> CONVERSATION / PERCEPTION INPUT</h3>
          <small>REAL_INPUT · REVIEW_REQUIRED</small>
        </header>
        {conversationPanel}
        <div className="identification-processed" aria-live="polite">
          <div className="identification-received"><span>ACTIVE INPUT</span><strong>{snapshot.input || "SIN ENTRADA ACTIVA"}</strong><small>{snapshot.source === "none" ? "WAITING_INPUT" : "LIVE_CONTEXT"}</small></div>
          <div className={`identification-tokens ${snapshot.tokens.length ? "" : "empty"}`}>{snapshot.tokens.length ? snapshot.tokens.map((token, index) => <span key={`${token}-${index}`}>{token}</span>) : <p><strong>0 TOKENS</strong><span>Esperando una entrada real de conversación o percepción autorizada.</span></p>}</div>
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

      <DocumentPreview />
    </div>
  </section>;
}
