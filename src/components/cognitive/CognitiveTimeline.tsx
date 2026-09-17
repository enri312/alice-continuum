import { useState } from "react";
import type { CSSProperties } from "react";
import type { CognitiveEvent } from "../../core/cognitive/cognitive-events";

type CognitiveTimelineProps = { events: CognitiveEvent[] };

function shortTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}

function elapsedLabel(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${(milliseconds / 60_000).toFixed(1)} min`;
}

export function CognitiveTimeline({ events }: CognitiveTimelineProps) {
  const visible = events.slice(-24);
  const [selectedId, setSelectedId] = useState("");
  const selected = visible.find((event) => event.id === selectedId) ?? visible.at(-1);
  const firstTime = visible.length ? Date.parse(visible[0].createdAt) : 0;
  const lastTime = visible.length ? Date.parse(visible[visible.length - 1].createdAt) : 0;
  const span = Math.max(0, lastTime - firstTime);
  const modules = new Set(visible.map((event) => event.module)).size;

  return <section className="cognitive-timeline" aria-labelledby="timeline-title">
    <header><div><span>[06]</span><strong id="timeline-title">COGNITIVE TIMELINE</strong></div><small>{visible.length ? "LOCAL EVENT CLOCK" : "WAITING FOR EVENTS"}</small></header>
    <dl className="timeline-summary"><div><dt>VISIBLE EVENTS</dt><dd>{visible.length} / {events.length}</dd></div><div><dt>MODULES</dt><dd>{modules}</dd></div><div><dt>TIME SPAN</dt><dd>{elapsedLabel(span)}</dd></div><div><dt>RETENTION</dt><dd>TEMPORAL</dd></div></dl>
    <div className="timeline-stage">
      {!visible.length ? <div className="timeline-empty"><span>000</span><strong>SIN EVENTOS COGNITIVOS</strong><small>La línea aparecerá cuando Alice registre actividad local verificable.</small></div> : <>
        <div className="timeline-axis"><span>{shortTime(visible[0].createdAt)}</span><i /><span>{shortTime(visible[visible.length - 1].createdAt)}</span></div>
        <div className="timeline-rail" role="list" aria-label="Últimos eventos cognitivos">
          {visible.map((event, index) => {
            const timestamp = Date.parse(event.createdAt);
            const position = visible.length === 1 ? 50 : 4 + ((timestamp - firstTime) / Math.max(1, span)) * 92;
            return <button key={event.id} type="button" role="listitem" className={`timeline-node module-${event.module.toLowerCase()} ${selected?.id === event.id ? "selected" : ""} lane-${index % 3}`} style={{ "--timeline-left": `${position}%` } as CSSProperties} aria-label={`${event.module}, ${event.node}, ${shortTime(event.createdAt)}`} onClick={() => setSelectedId(event.id)}><i /><span>{String(event.sequence).padStart(4, "0")}</span></button>;
          })}
        </div>
      </>}
    </div>
    <div className="timeline-inspector" aria-live="polite">
      {selected ? <><span>{shortTime(selected.createdAt)} · SEQ {String(selected.sequence).padStart(5, "0")}</span><strong>{selected.module} / {selected.node}</strong><p>{selected.payload}</p><em>{selected.level}</em></> : <><span>NO SELECTION</span><strong>NINGÚN EVENTO DISPONIBLE</strong><p>La inspección permanece vacía.</p><em>—</em></>}
    </div>
    <div className="timeline-legend"><span className="module-system">SYSTEM</span><span className="module-perception">PERCEPTION</span><span className="module-memory">MEMORY</span><span className="module-workspace">WORKSPACE</span><span className="module-output">OUTPUT</span><span className="module-security">SECURITY</span></div>
  </section>;
}
