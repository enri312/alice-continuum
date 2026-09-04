import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { BridgeViewIcon } from "../components/BridgeViewIcon";
import { FaceTrackingPanel } from "../components/FaceTrackingPanel";
import { BodySolverPanel } from "../components/BodySolverPanel";
import { PermissionGatewayPanel } from "../components/PermissionGatewayPanel";
import {
  createWebDevelopmentCapabilityRegistry,
  parseCapabilityRegistrySnapshot,
  summarizeCapabilityRegistry,
} from "../core/capabilities";
import type {
  CapabilityDescriptor,
  CapabilityDomain,
  CapabilityRegistryResult,
} from "../core/capabilities";

type RegistryLoadState = "loading" | "ready" | "error";

const domainOrder: CapabilityDomain[] = ["cloud", "context", "perception", "memory", "avatar", "output", "task"];
const domainLabels: Record<CapabilityDomain, string> = {
  cloud: "NUBE",
  context: "CONTEXTO",
  perception: "PERCEPCIÓN",
  memory: "MEMORIA",
  avatar: "AVATAR",
  output: "SALIDAS",
  task: "TAREAS",
};
const domainGlyphs: Record<CapabilityDomain, string> = {
  cloud: "CLD",
  context: "CTX",
  perception: "SNS",
  memory: "MEM",
  avatar: "AVR",
  output: "OUT",
  task: "TSK",
};
const stateLabels: Record<CapabilityDescriptor["state"], string> = {
  unavailable: "NO DISPONIBLE",
  disabled: "DESACTIVADA",
  idle: "LISTA",
  active: "ACTIVA",
  degraded: "DEGRADADA",
  error: "ERROR",
};
const maturityLabels: Record<CapabilityDescriptor["maturity"], string> = {
  implemented: "IMPLEMENTADA",
  partial: "PARCIAL",
  planned: "PLANIFICADA",
};

export function Puentes({ onObservationStateChange, fixedView }: { onObservationStateChange: (enabled: boolean) => void; fixedView?: "overview" | "face" | "body" }) {
  const requestedView = new URLSearchParams(window.location.search).get("bridgeView");
  const [selectedView, setSelectedView] = useState<"overview" | "face" | "body">(requestedView === "face" || requestedView === "body" ? requestedView : "overview");
  const view = fixedView ?? selectedView;
  const [registry, setRegistry] = useState<CapabilityRegistryResult>(() => createWebDevelopmentCapabilityRegistry());
  const [loadState, setLoadState] = useState<RegistryLoadState>(isTauri() ? "loading" : "ready");
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri() || view !== "overview") return;
    let cancelled = false;
    invoke<unknown>("capability_registry_status")
      .then((value) => {
        const snapshot = parseCapabilityRegistrySnapshot(value);
        if (cancelled) return;
        setRegistry({ source: "native", snapshot });
        setLoadState("ready");
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(String(error));
      });
    return () => { cancelled = true; };
  }, [view]);

  const capabilities = registry.snapshot.capabilities;
  const selected = capabilities.find((capability) => capability.id === selectedId) ?? capabilities[0];
  const summary = useMemo(() => summarizeCapabilityRegistry(registry.snapshot), [registry.snapshot]);
  const groups = useMemo(() => domainOrder
    .map((domain) => ({ domain, capabilities: capabilities.filter((capability) => capability.domain === domain) }))
    .filter((group) => group.capabilities.length > 0), [capabilities]);

  return <section className="bridge-page" aria-labelledby={view === "overview" ? "bridge-title" : undefined} aria-label={view === "face" ? "Control facial de Alice" : view === "body" ? "Solucionador corporal de Alice" : undefined}>
    {view === "overview" && <div className="bridge-heading">
      <div><p className="eyebrow">[R1] CAPABILITY REGISTRY · SOLO CONSULTA</p><h2 id="bridge-title">Registro de capacidades</h2><p>Estado comprobable de lo que Alice puede hacer hoy y de lo que sigue solamente planificado.</p></div>
      <div className={`bridge-offline ${loadState === "ready" && registry.source === "native" ? "is-native" : ""}`}><i />{loadState === "loading" ? "CONSULTANDO" : registry.source === "native" ? `${summary.available} DISPONIBLES` : "DESARROLLO WEB"}</div>
    </div>}

    {!fixedView && <div className="bridge-view-tabs" role="tablist" aria-label="Visualizaciones de Puentes">
      <button role="tab" aria-label="Registro de capacidades" data-tooltip="Capacidades" aria-selected={view === "overview"} className={view === "overview" ? "selected" : ""} onClick={() => setSelectedView("overview")}><BridgeViewIcon kind="overview" active={view === "overview"} /><span>Capacidades</span></button>
      <button role="tab" aria-label="Diagnóstico de rostro" data-tooltip="Rostro" aria-selected={view === "face"} className={view === "face" ? "selected" : ""} onClick={() => setSelectedView("face")}><BridgeViewIcon kind="face" active={view === "face"} /><span>Rostro</span></button>
      <button role="tab" aria-label="Diagnóstico corporal" data-tooltip="Cuerpo" aria-selected={view === "body"} className={view === "body" ? "selected" : ""} onClick={() => setSelectedView("body")}><BridgeViewIcon kind="body" active={view === "body"} /><span>Cuerpo</span></button>
    </div>}

    {view === "overview" ? <>
      <div className="bridge-metrics" aria-label="Resumen del registro">
        <div><span>TOTAL</span><strong>{String(summary.total).padStart(2, "0")}</strong><small>registradas</small></div>
        <div><span>DISPONIBLES</span><strong>{String(summary.available).padStart(2, "0")}</strong><small>idle o active</small></div>
        <div><span>PLANIFICADAS</span><strong>{String(summary.planned).padStart(2, "0")}</strong><small>sin adaptador</small></div>
        <div><span>ERROR / DEGRADADA</span><strong>{String(summary.unhealthy).padStart(2, "0")}</strong><small>salud real</small></div>
      </div>

      <PermissionGatewayPanel onObservationStateChange={onObservationStateChange} />

      <div className="bridge-layout">
        <div className="bridge-workspace">
          <div className="bridge-map-heading"><span>INVENTARIO POR DOMINIO</span><small>{registry.source === "native" ? `snapshot ${registry.snapshot.generatedAt}` : "sin backend nativo"}</small></div>
          <div className="bridge-route capability-registry-route">
            {loadState === "loading" ? <RegistryNotice code="..." title="CONSULTANDO BACKEND NATIVO" detail="Las sondas son pasivas y no abren dispositivos ni escriben memoria." />
              : loadState === "error" ? <RegistryNotice code="ERR" title="REGISTRO NATIVO NO DISPONIBLE" detail={`Reinicia Alice para cargar el comando R1 actualizado. ${loadError}`} />
              : groups.length === 0 ? <RegistryNotice code="WEB" title="ENTORNO DE DESARROLLO" detail="El navegador no simula capacidades. Abre la aplicación de escritorio para consultar el registro nativo." />
              : groups.map((group) => <section className="capability-domain" key={group.domain} aria-labelledby={`domain-${group.domain}`}>
                <header><strong id={`domain-${group.domain}`}>{domainLabels[group.domain]}</strong><span>{group.capabilities.length} capacidades</span></header>
                <div className="bridge-grid">
                  {group.capabilities.map((capability) => <button key={capability.id} data-state={capability.state} className={selected?.id === capability.id ? "selected" : ""} onClick={() => setSelectedId(capability.id)} aria-pressed={selected?.id === capability.id}>
                    <span className="bridge-glyph" aria-hidden="true">{domainGlyphs[capability.domain]}</span><span><strong>{capability.label}</strong><small>{maturityLabels[capability.maturity]} · {stateLabels[capability.state]}</small></span><i aria-hidden="true" />
                  </button>)}
                </div>
              </section>)}
          </div>
        </div>

        <aside className="bridge-inspector" aria-live="polite">
          <p className="eyebrow">INSPECTOR DE CAPACIDAD</p>
          {selected ? <>
            <div className="bridge-inspector-code">{domainGlyphs[selected.domain]}<span>{stateLabels[selected.state]}</span></div>
            <h3>{selected.label}</h3><p>{selected.description}</p>
            <dl>
              <div><dt>ID</dt><dd>{selected.id}</dd></div>
              <div><dt>Madurez</dt><dd>{maturityLabels[selected.maturity]}</dd></div>
              <div><dt>Adaptador</dt><dd>{selected.adapter}</dd></div>
              <div><dt>Operaciones</dt><dd>{selected.operations.join(", ")}</dd></div>
              <div><dt>Riesgo</dt><dd>{selected.risk.toUpperCase()}</dd></div>
              <div><dt>Permiso</dt><dd>{selected.permission.mode} · {selected.permission.enforcedBy}</dd></div>
              <div><dt>Efectos</dt><dd>{selected.effects.join(", ")}</dd></div>
              <div><dt>Salud</dt><dd>{selected.health.status.toUpperCase()}</dd></div>
              <div><dt>Última ejecución</dt><dd>— · reservado para R3</dd></div>
            </dl>
            <small>{selected.health.summary}<br />{selected.permission.summary}</small>
          </> : <RegistryNotice code="000" title="SIN CAPACIDAD SELECCIONABLE" detail="No se muestran datos inventados mientras el registro nativo no esté disponible." />}
        </aside>
      </div>

      <div className="bridge-console" aria-label="Monitor de ejecución reservado">
        <div className="bridge-console-title"><strong>EXECUTION MONITOR · R3</strong><span>0 ejecuciones declaradas</span></div>
        <div className="bridge-console-head"><span>CAPABILITY</span><span>STATUS</span><span>OUTCOME</span><span>RISK</span><span>TIME</span><span>CORRELATION</span></div>
        <div className="bridge-console-empty"><span>000</span><strong>SIN TELEMETRÍA DE EJECUCIÓN</strong><small>R1 mantiene lastExecution en null; no se fabrican paquetes, latencias ni actividad.</small></div>
      </div>
      <div className="console-prompt"><strong>ALICE_CAPABILITY@LOCAL_PROCESS:~$</strong><span>{registry.source === "native" ? "snapshot nativo validado · consulta pasiva" : "fallback web explícito · ninguna capacidad simulada"}</span></div>
    </> : view === "face" ? <FaceTrackingPanel /> : <BodySolverPanel />}
  </section>;
}

function RegistryNotice({ code, title, detail }: { code: string; title: string; detail: string }) {
  return <div className="capability-registry-notice"><span>{code}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}
