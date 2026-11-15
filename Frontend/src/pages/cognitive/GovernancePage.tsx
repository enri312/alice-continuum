import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { auditSizeLabel, parseAuditSnapshot } from "../../core/governance/audit";
import type { AuditSnapshot } from "../../core/governance/audit";
import { parseDiagnosticSnapshot } from "../../core/governance/diagnostics";
import type { DiagnosticCategory, DiagnosticSnapshot, DiagnosticStatus } from "../../core/governance/diagnostics";

type ActivityView = "audit" | "diagnostic";
type GovernanceProps = { desktopApp: boolean };

function eventTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 }).format(new Date(iso));
}

export function AuditoriaDiagnostico({ desktopApp }: GovernanceProps) {
  const requestedView = new URLSearchParams(window.location.search).get("activityView");
  const allowedViews: ActivityView[] = ["audit", "diagnostic"];
  const [view, setView] = useState<ActivityView>(allowedViews.includes(requestedView as ActivityView) ? requestedView as ActivityView : allowedViews[0]);
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);
  const [auditError, setAuditError] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticSnapshot | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
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

  const refreshDiagnostic = useCallback(async () => {
    if (!desktopApp) return;
    setDiagnosticLoading(true);
    setDiagnosticError("");
    try {
      setDiagnostic(parseDiagnosticSnapshot(await invoke<unknown>("diagnostic_snapshot")));
    } catch (error) {
      setDiagnosticError(String(error));
    } finally {
      setDiagnosticLoading(false);
    }
  }, [desktopApp]);

  useEffect(() => { if (view === "diagnostic") void refreshDiagnostic(); }, [view, refreshDiagnostic]);

  const diagnosticCategories: { id: DiagnosticCategory; label: string }[] = [
    { id: "path", label: "RUTAS" }, { id: "dataVersion", label: "VERSIONES DE DATOS" }, { id: "provider", label: "PROVEEDORES" }, { id: "adapter", label: "ADAPTADORES" }, { id: "permission", label: "PERMISOS" },
  ];
  const diagnosticStatusLabel: Record<DiagnosticStatus, string> = { healthy: "SALUDABLE", configurationPending: "CONFIGURACIÓN PENDIENTE", unavailable: "NO DISPONIBLE", error: "ERROR" };

  return <section className="activity-page" aria-labelledby="activity-title">
    <div className="activity-heading"><div><p className="eyebrow">[08—09] OWNER INSPECTION · LOCAL</p><h2 id="activity-title">Auditoría y diagnóstico</h2><p>Evidencia persistente y salud técnica para inspección del propietario.</p></div><div className={`activity-status ${audit?.totalValidEvents ? "" : "idle"}`}><i />{audit?.totalValidEvents ? "EVIDENCIA REAL" : "EN ESPERA"}</div></div>
    <div className="activity-view-tabs" role="tablist" aria-label="Herramientas de auditoría y diagnóstico"><button type="button" role="tab" aria-selected={view === "audit"} className={view === "audit" ? "selected" : ""} onClick={() => setView("audit")}><span>[08]</span>NATIVE AUDIT R3</button><button type="button" role="tab" aria-selected={view === "diagnostic"} className={view === "diagnostic" ? "selected" : ""} onClick={() => setView("diagnostic")}><span>[09]</span>PASSIVE DIAGNOSTIC</button></div>
    {view === "audit" ? <section className="native-audit" aria-labelledby="native-audit-title">
      <header className="event-console-title"><span>[08]</span><strong id="native-audit-title">UNIFIED NATIVE AUDIT · SCHEMA V1</strong><small>{audit?.totalValidEvents ?? 0} VALID EVENTS</small></header>
      <div className="native-audit-toolbar"><p>Metadatos mínimos correlacionados. Nunca guarda mensajes, imágenes, audio, parámetros privados ni claves.</p><button className="console-button" type="button" onClick={() => void refreshAudit()} disabled={!desktopApp || auditLoading}>{auditLoading ? "Leyendo…" : "Actualizar lectura"}</button></div>
      {!desktopApp ? <div className="event-empty">La auditoría nativa está disponible únicamente en Alice Desktop.</div> : auditError ? <div className="native-audit-error"><strong>LECTURA NO DISPONIBLE</strong><span>{auditError}</span></div> : audit ? <>
        <dl className="native-audit-summary"><div><dt>ESTADO</dt><dd className={audit.healthy ? "healthy" : "warning"}>{audit.healthy ? "ÍNTEGRA" : "REVISAR"}</dd></div><div><dt>ARCHIVO ACTUAL</dt><dd>{auditSizeLabel(audit.currentBytes)} / {auditSizeLabel(audit.maximumCurrentBytes)}</dd></div><div><dt>ROTACIÓN ANTERIOR</dt><dd>{auditSizeLabel(audit.rotatedBytes)}</dd></div><div><dt>LÍNEAS INVÁLIDAS</dt><dd>{audit.invalidLines}</dd></div></dl>
        <div className="native-audit-path"><span>FUENTE LOCAL</span><strong title={audit.storagePath}>{audit.storagePath || "El archivo se creará al registrar el primer evento."}</strong><small>Solo lectura desde esta pantalla · límite actual 5 MiB + una rotación</small></div>
        <div className="event-console native"><div className="native-event-row event-header"><span>TIME</span><span>SOURCE</span><span>STAGE</span><span>OPERATION</span><span>OUTCOME</span><span>REASON / CORRELATION</span></div>{audit.events.length ? [...audit.events].reverse().map((event) => <div className="native-event-row" key={event.eventId}><span>{eventTime(new Date(event.timestampMs).toISOString())}</span><span>{event.source.toUpperCase()}</span><span>{event.stage.toUpperCase()}</span><span title={event.capabilityId ? `${event.capabilityId} / ${event.operation}` : event.operation}>{event.operation}</span><span className={`audit-outcome ${event.outcome}`}>{event.outcome.toUpperCase()}</span><span title={event.operationId}>{event.reasonCode} · {event.operationId.slice(0, 8)}</span></div>) : <div className="event-empty">Todavía no existen eventos nativos en el archivo R3.</div>}</div>
      </> : <div className="event-empty">Leyendo auditoría nativa…</div>}
    </section> : <section className="passive-diagnostic" aria-labelledby="passive-diagnostic-title">
      <header className="event-console-title"><span>[09]</span><strong id="passive-diagnostic-title">PASSIVE SYSTEM DIAGNOSTIC · SCHEMA V1</strong><small>{diagnostic?.summary.total ?? 0} CHECKS</small></header>
      <div className="native-audit-toolbar"><p>Solo inspecciona. No abre dispositivos, no envía red, no solicita permisos y no corrige archivos.</p><button className="console-button" type="button" onClick={() => void refreshDiagnostic()} disabled={!desktopApp || diagnosticLoading}>{diagnosticLoading ? "Inspeccionando…" : "Actualizar diagnóstico"}</button></div>
      {!desktopApp ? <div className="event-empty">El diagnóstico nativo está disponible únicamente en Alice Desktop.</div> : diagnosticError ? <div className="native-audit-error"><strong>DIAGNÓSTICO NO DISPONIBLE</strong><span>{diagnosticError}</span></div> : diagnostic ? <>
        <dl className="diagnostic-summary"><div><dt>ESTADO</dt><dd className={`diagnostic-${diagnostic.overallStatus}`}>{diagnostic.overallStatus === "healthy" ? "SALUDABLE" : diagnostic.overallStatus === "attention" ? "ATENCIÓN" : "ERROR"}</dd></div><div><dt>SALUDABLES</dt><dd>{diagnostic.summary.healthy}</dd></div><div><dt>CONFIG. PENDIENTE</dt><dd>{diagnostic.summary.configurationPending}</dd></div><div><dt>NO DISPONIBLES</dt><dd>{diagnostic.summary.unavailable}</dd></div><div><dt>ERRORES</dt><dd>{diagnostic.summary.errors}</dd></div></dl>
        <div className="diagnostic-groups">{diagnosticCategories.map((category) => { const categoryChecks = diagnostic.checks.filter((item) => item.category === category.id); return <section key={category.id} aria-label={category.label}><header><strong>{category.label}</strong><span>{categoryChecks.length}</span></header><div>{categoryChecks.map((item) => <article key={item.id} className={`diagnostic-check status-${item.status}`}><i /><div><strong>{item.label}</strong><p>{item.summary}</p></div><span>{diagnosticStatusLabel[item.status]}</span></article>)}</div></section>; })}</div>
        <footer className="diagnostic-footnote">GENERADO LOCALMENTE · {new Date(diagnostic.generatedAtMs).toLocaleString("es-PY")} · SIN EFECTOS LATERALES</footer>
      </> : <div className="event-empty">Abrí esta vista para ejecutar la inspección pasiva.</div>}
    </section>}
  </section>;
}
