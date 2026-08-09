import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CognitiveEvent, CognitiveModule } from "../core/cognitive-events";
import { CognitiveTimeline } from "../components/CognitiveTimeline";
import { auditSizeLabel, parseAuditSnapshot } from "../core/audit";
import type { AuditSnapshot } from "../core/audit";

type ActividadProps = { desktopApp: boolean; events: CognitiveEvent[]; onClear: () => void };

function eventTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }).format(new Date(iso));
}

export function Actividad({ desktopApp, events, onClear }: ActividadProps) {
  const requestedView = new URLSearchParams(window.location.search).get("activityView");
  const [view, setView] = useState<"timeline" | "events" | "audit">(requestedView === "events" || requestedView === "audit" ? requestedView : "timeline");
  const [module, setModule] = useState<CognitiveModule | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);
  const [auditError, setAuditError] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const filtered = useMemo(() => events.filter((event) => {
    const text = `${event.module} ${event.node} ${event.payload}`.toLocaleLowerCase();
    return (module === "ALL" || event.module === module) && text.includes(query.toLocaleLowerCase().trim());
  }).reverse(), [events, module, query]);

  const refreshAudit = useCallback(async () => {
    if (!desktopApp) return;
    setAuditLoading(true);
    setAuditError("");
    try {
      setAudit(parseAuditSnapshot(await invoke<unknown>("audit_snapshot")));
    } catch (error) {
      setAuditError(String(error));
    } finally {
      setAuditLoading(false);
    }
  }, [desktopApp]);

  useEffect(() => { void refreshAudit(); }, [refreshAudit]);

  return <section className="activity-page" aria-labelledby="activity-title">
    <div className="activity-heading"><div><p className="eyebrow">[06—08] ACTIVITY DIAGNOSTICS · LOCAL</p><h2 id="activity-title">Actividad cognitiva</h2><p>Línea temporal, eventos de sesión y auditoría nativa persistente sin contenido privado.</p></div><div className={`activity-status ${events.length || audit?.totalValidEvents ? "" : "idle"}`}><i />{events.length || audit?.totalValidEvents ? "ACTIVIDAD REAL" : "EN ESPERA"}</div></div>
    <div className="activity-view-tabs" role="tablist" aria-label="Visualizaciones de actividad"><button type="button" role="tab" aria-selected={view === "timeline"} className={view === "timeline" ? "selected" : ""} onClick={() => setView("timeline")}><span>[06]</span>COGNITIVE TIMELINE</button><button type="button" role="tab" aria-selected={view === "events"} className={view === "events" ? "selected" : ""} onClick={() => setView("events")}><span>[07]</span>EVENT STREAM</button><button type="button" role="tab" aria-selected={view === "audit"} className={view === "audit" ? "selected" : ""} onClick={() => setView("audit")}><span>[08]</span>NATIVE AUDIT R3</button></div>
    {view === "timeline" ? <CognitiveTimeline events={events} /> : <>
    {view === "events" ? <>
      <div className="event-console-title"><span>[07]</span><strong>EVENT STREAM / LOCAL CONSOLE</strong><small>{events.length} RECORDS</small></div>
      <div className="activity-controls"><input aria-label="Buscar eventos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nodo o contenido" /><select aria-label="Filtrar módulo" value={module} onChange={(event) => setModule(event.target.value as CognitiveModule | "ALL")}><option value="ALL">TODOS LOS MÓDULOS</option><option value="SYSTEM">SYSTEM</option><option value="PERCEPTION">PERCEPTION</option><option value="MEMORY">MEMORY</option><option value="WORKSPACE">WORKSPACE</option><option value="OUTPUT">OUTPUT</option><option value="SECURITY">SECURITY</option></select><button className="console-button" onClick={onClear} disabled={!events.length}>Limpiar vista</button></div>
      <div className="event-console"><div className="event-row event-header"><span>SEQ</span><span>TIME</span><span>MODULE</span><span>LEVEL</span><span>NODE</span><span>PAYLOAD</span></div>{filtered.length ? filtered.map((event) => <div className="event-row" key={event.id}><span>{String(event.sequence).padStart(5, "0")}</span><span>{eventTime(event.createdAt)}</span><span className={`module module-${event.module.toLowerCase()}`}>{event.module}</span><span>{event.level}</span><span>{event.node}</span><span title={event.payload}>{event.payload}</span></div>) : <div className="event-empty">No hay eventos que coincidan con este filtro.</div>}</div>
      <div className="console-prompt"><strong>ALICE_CORE@LOCAL_PROCESS:~$</strong><span>{events.length} eventos temporales · limpiar no modifica la auditoría nativa</span></div>
    </> : <section className="native-audit" aria-labelledby="native-audit-title">
      <header className="event-console-title"><span>[08]</span><strong id="native-audit-title">UNIFIED NATIVE AUDIT · SCHEMA V1</strong><small>{audit?.totalValidEvents ?? 0} VALID EVENTS</small></header>
      <div className="native-audit-toolbar"><p>Metadatos mínimos correlacionados. Nunca guarda mensajes, imágenes, audio, parámetros privados ni claves.</p><button className="console-button" type="button" onClick={() => void refreshAudit()} disabled={!desktopApp || auditLoading}>{auditLoading ? "Leyendo…" : "Actualizar lectura"}</button></div>
      {!desktopApp ? <div className="event-empty">La auditoría nativa está disponible únicamente en Alice Desktop.</div> : auditError ? <div className="native-audit-error"><strong>LECTURA NO DISPONIBLE</strong><span>{auditError}</span></div> : audit ? <>
        <dl className="native-audit-summary"><div><dt>ESTADO</dt><dd className={audit.healthy ? "healthy" : "warning"}>{audit.healthy ? "ÍNTEGRA" : "REVISAR"}</dd></div><div><dt>ARCHIVO ACTUAL</dt><dd>{auditSizeLabel(audit.currentBytes)} / {auditSizeLabel(audit.maximumCurrentBytes)}</dd></div><div><dt>ROTACIÓN ANTERIOR</dt><dd>{auditSizeLabel(audit.rotatedBytes)}</dd></div><div><dt>LÍNEAS INVÁLIDAS</dt><dd>{audit.invalidLines}</dd></div></dl>
        <div className="native-audit-path"><span>FUENTE LOCAL</span><strong title={audit.storagePath}>{audit.storagePath || "El archivo se creará al registrar el primer evento."}</strong><small>Solo lectura desde esta pantalla · límite actual 5 MiB + una rotación</small></div>
        <div className="event-console native"><div className="native-event-row event-header"><span>TIME</span><span>SOURCE</span><span>STAGE</span><span>OPERATION</span><span>OUTCOME</span><span>REASON / CORRELATION</span></div>{audit.events.length ? [...audit.events].reverse().map((event) => <div className="native-event-row" key={event.eventId}><span>{eventTime(new Date(event.timestampMs).toISOString())}</span><span>{event.source.toUpperCase()}</span><span>{event.stage.toUpperCase()}</span><span title={event.capabilityId ? `${event.capabilityId} / ${event.operation}` : event.operation}>{event.operation}</span><span className={`audit-outcome ${event.outcome}`}>{event.outcome.toUpperCase()}</span><span title={event.operationId}>{event.reasonCode} · {event.operationId.slice(0, 8)}</span></div>) : <div className="event-empty">Todavía no existen eventos nativos en el archivo R3.</div>}</div>
      </> : <div className="event-empty">Leyendo auditoría nativa…</div>}
    </section>}
    </>}
  </section>;
}
