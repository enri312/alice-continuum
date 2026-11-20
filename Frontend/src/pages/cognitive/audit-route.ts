import { invoke } from "@tauri-apps/api/core";
import { parseAuditSnapshot } from "../../core/governance/audit";
import { parseDiagnosticSnapshot } from "../../core/governance/diagnostics";

type Tab = "audit" | "diagnostic";
type Action = { type: "read"; view: Tab; id: number } | { type: "clearCapability" };

const localTime = new Intl.DateTimeFormat("es-PY", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3,
});

function parseAction(raw: string): Action | null {
  try {
    const value = JSON.parse(raw);
    if (value?.type === "clearCapability") return { type: "clearCapability" };
    if (value?.type === "read" && (value.view === "audit" || value.view === "diagnostic")
      && Number.isInteger(value.id) && value.id > 0 && value.id <= 0xffff_ffff) {
      return { type: "read", view: value.view, id: value.id };
    }
  } catch { return null; }
  return null;
}

// Rust controls both tabs, their selection and request state. This host adapts the
// native snapshots and uses the browser's local clock formatting for display.
async function readAudit(id: number) {
  const { schemaVersion: _version, events, ...snapshot } = parseAuditSnapshot(await invoke("audit_snapshot"));
  return {
    type: "auditSuccess", id,
    snapshot: {
      ...snapshot,
      events: events.map(event => ({
        eventId: event.eventId,
        operationId: event.operationId,
        localTime: localTime.format(new Date(event.timestampMs)),
        source: event.source,
        stage: event.stage,
        outcome: event.outcome,
        capabilityId: event.capabilityId,
        operation: event.operation,
        reasonCode: event.reasonCode,
      })),
    },
  };
}

async function readDiagnostic(id: number) {
  const snapshot = parseDiagnosticSnapshot(await invoke("diagnostic_snapshot"));
  return {
    type: "diagnosticSuccess", id,
    snapshot: {
      generatedAt: new Date(snapshot.generatedAtMs).toLocaleString("es-PY"),
      overallStatus: snapshot.overallStatus,
      summary: snapshot.summary,
      checks: snapshot.checks,
    },
  };
}

import { desktopApp } from "../../core/navigation/app-sources";
import { clearAudit } from "../../core/navigation/app-session";
import type { RouteOptions } from "../../core/navigation/view-mount";

export function auditRoute(query: URLSearchParams, capability: () => string | null): RouteOptions {
  const view = query.get("activityView") === "diagnostic" ? "diagnostic" : "audit";
  return {
    renderer: "audit", name: "Auditoría y diagnóstico", errorTitle: "AUDITORÍA Y DIAGNÓSTICO NO DISPONIBLES", retry: "Reintentar auditoría",
    load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadAuditPageRuntime()),
    configuration: () => ({ type: "configure", desktopApp, capability: capability(), view }),
    createTransport: () => ({
      dispatch(raw, reply) {
        const action = parseAction(raw);
        if (action?.type === "clearCapability") clearAudit();
        else if (desktopApp && action?.type === "read") {
          const { view, id } = action;
          const read = view === "audit" ? readAudit : readDiagnostic;
          void read(id).then(reply, error => reply({ type: "readFailure", view, id, error: String(error) }));
        }
      },
    }),
  };
}
