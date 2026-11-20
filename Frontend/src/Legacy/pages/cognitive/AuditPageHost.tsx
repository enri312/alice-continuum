import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseAuditSnapshot } from "../../../core/governance/audit";
import { parseDiagnosticSnapshot } from "../../../core/governance/diagnostics";
import { startStateControlsView, type ViewStatus } from "../../../components/cognitive/state-controls/lifecycle";

type Props = { desktopApp: boolean; capability: string | null; onClearCapability: () => void };
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

export function AuditPageHost(props: Props) {
  const root = `alice-audit-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const requestedView = useRef(new URLSearchParams(window.location.search).get("activityView"));
  const callbacks = useRef(props);
  callbacks.current = props;
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const config = JSON.stringify({
    type: "configure",
    desktopApp: props.desktopApp,
    capability: props.capability,
    view: requestedView.current === "diagnostic" ? "diagnostic" : "audit",
  });
  const latest = useRef(config);
  latest.current = config;
  const controller = useRef<ReturnType<typeof startStateControlsView> | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    const instance = startStateControlsView({
      root, initial: latest.current,
      load: () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadAuditPageRuntime()),
      onStatus: next => {
        if (next === "error") active = false;
        setStatus(next);
      },
      onAction: raw => {
        const action = parseAction(raw);
        if (!active || !action) return;
        if (action.type === "clearCapability") {
          callbacks.current.onClearCapability();
          return;
        }
        if (!callbacks.current.desktopApp) return;
        const { view, id } = action;
        const read = view === "audit" ? readAudit : readDiagnostic;
        const complete = (message: unknown) => {
          if (active && callbacks.current.desktopApp) {
            instance.update(JSON.stringify(message));
          }
        };
        void read(id).then(complete, error => complete({ type: "readFailure", view, id, error: String(error) }));
      },
    });
    controller.current = instance;
    return () => {
      active = false;
      controller.current = null;
      instance.dispose();
    };
  }, [root, attempt]);
  useEffect(() => { controller.current?.update(config); }, [config]);

  return <div data-audit-renderer={status === "ready" ? "dioxus" : status}>
    {status === "loading" && <p className="neuro-footnote" role="status">Preparando Auditoría y diagnóstico…</p>}
    {status === "error" && <div className="native-audit-error" role="alert">
      <strong>AUDITORÍA Y DIAGNÓSTICO NO DISPONIBLES</strong>
      <button className="console-button" type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar auditoría</button>
    </div>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
