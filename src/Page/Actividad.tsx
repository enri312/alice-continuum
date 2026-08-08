import { useMemo, useState } from "react";
import type { CognitiveEvent, CognitiveModule } from "../core/cognitive-events";

type ActividadProps = { events: CognitiveEvent[]; onClear: () => void };

function eventTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }).format(new Date(iso));
}

export function Actividad({ events, onClear }: ActividadProps) {
  const [module, setModule] = useState<CognitiveModule | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => events.filter((event) => {
    const text = `${event.module} ${event.node} ${event.payload}`.toLocaleLowerCase();
    return (module === "ALL" || event.module === module) && text.includes(query.toLocaleLowerCase().trim());
  }).reverse(), [events, module, query]);

  return <section className="activity-page" aria-labelledby="activity-title">
    <div className="activity-heading"><div><p className="eyebrow">EVENT STREAM · PROCESO LOCAL</p><h2 id="activity-title">Actividad cognitiva</h2><p>Registro temporal de entradas, memoria, llamadas autorizadas, salidas y límites de seguridad.</p></div><div className={`activity-status ${events.length ? "" : "idle"}`}><i />{events.length ? "REGISTRANDO" : "EN ESPERA"}</div></div>
    <div className="activity-controls"><input aria-label="Buscar eventos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nodo o contenido" /><select aria-label="Filtrar módulo" value={module} onChange={(event) => setModule(event.target.value as CognitiveModule | "ALL")}><option value="ALL">TODOS LOS MÓDULOS</option><option value="SYSTEM">SYSTEM</option><option value="PERCEPTION">PERCEPTION</option><option value="MEMORY">MEMORY</option><option value="WORKSPACE">WORKSPACE</option><option value="OUTPUT">OUTPUT</option><option value="SECURITY">SECURITY</option></select><button className="console-button" onClick={onClear} disabled={!events.length}>Limpiar vista</button></div>
    <div className="event-console"><div className="event-row event-header"><span>SEQ</span><span>TIME</span><span>MODULE</span><span>LEVEL</span><span>NODE</span><span>PAYLOAD</span></div>{filtered.length ? filtered.map((event) => <div className="event-row" key={event.id}><span>{String(event.sequence).padStart(5, "0")}</span><span>{eventTime(event.createdAt)}</span><span className={`module module-${event.module.toLowerCase()}`}>{event.module}</span><span>{event.level}</span><span>{event.node}</span><span title={event.payload}>{event.payload}</span></div>) : <div className="event-empty">No hay eventos que coincidan con este filtro.</div>}</div>
    <div className="console-prompt"><strong>ALICE_CORE@LOCAL_PROCESS:~$</strong><span>{events.length} eventos temporales · las llamadas de nube requieren autorización</span></div>
  </section>;
}
