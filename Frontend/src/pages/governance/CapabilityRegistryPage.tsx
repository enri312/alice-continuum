import { useEffect, useMemo, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { effectLabel, permissionModeLabel, riskLabel } from "../../core/governance/display-labels";
import { BridgeViewIcon } from "../../components/icons/BridgeViewIcon";
import { PermissionGatewayPanel } from "../../components/governance/PermissionGatewayPanel";
import {
  createWebDevelopmentCapabilityRegistry,
  parseCapabilityRegistrySnapshot,
  summarizeCapabilityRegistry,
} from "../../core/governance/capabilities";
import type {
  CapabilityDescriptor,
  CapabilityDomain,
  CapabilityRegistryResult,
} from "../../core/governance/capabilities";

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

const healthLabel: Record<CapabilityDescriptor["health"]["status"], string> = {
  unchecked: "Sin comprobar", healthy: "Saludable", degraded: "Degradada", unavailable: "No disponible", error: "Error",
};
const enforcerLabel: Record<CapabilityDescriptor["permission"]["enforcedBy"], string> = {
  native: "aplicación nativa", currentUi: "interfaz", operatingSystem: "sistema operativo", none: "ninguno",
};

export function CapacidadesYPermisos({ onOpenAudit }: {
  onOpenAudit: (capability?: string) => void;
}) {
  const [section, setSection] = useState<"registry" | "permissions">("registry");
  const [registry, setRegistry] = useState<CapabilityRegistryResult>(() => createWebDevelopmentCapabilityRegistry());
  const [loadState, setLoadState] = useState<RegistryLoadState>(isTauri() ? "loading" : "ready");
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
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
  }, []);

  const capabilities = registry.snapshot.capabilities;
  const selected = capabilities.find((capability) => capability.id === selectedId) ?? capabilities[0];
  const summary = useMemo(() => summarizeCapabilityRegistry(registry.snapshot), [registry.snapshot]);
  const groups = useMemo(() => domainOrder
    .map((domain) => ({ domain, capabilities: capabilities.filter((capability) => capability.domain === domain) }))
    .filter((group) => group.capabilities.length > 0), [capabilities]);

  const nativeReady = loadState === "ready" && registry.source === "native";
  return <section className="bridge-page" aria-labelledby="bridge-title">
    <div className="bridge-heading"><h2 id="bridge-title">Capacidades y permisos</h2></div>
    <div className="governance-sections" role="group" aria-label="Herramientas de capacidades y permisos">
      <button type="button" aria-controls="registry-panel" aria-pressed={section === "registry"} onClick={() => setSection("registry")}><BridgeViewIcon kind="registry" />Inventario de capacidades</button>
      <button type="button" aria-controls="permissions-panel" aria-pressed={section === "permissions"} onClick={() => setSection("permissions")}><BridgeViewIcon kind="permissions" />Permisos</button>
    </div>
    <div id="permissions-panel" hidden={section !== "permissions"}>
      <PermissionGatewayPanel visible={section === "permissions"} />
    </div>
    <div id="registry-panel" hidden={section !== "registry"}>
      <div className="bridge-metrics" aria-label="Resumen del registro">
        <div><span>TOTAL</span><strong>{nativeReady ? String(summary.total).padStart(2, "0") : "—"}</strong><small>registradas</small></div>
        <div><span>DISPONIBLES</span><strong>{nativeReady ? String(summary.available).padStart(2, "0") : "—"}</strong><small>listas o activas</small></div>
        <div><span>PLANIFICADAS</span><strong>{nativeReady ? String(summary.planned).padStart(2, "0") : "—"}</strong><small>sin adaptador</small></div>
        <div><span>ERROR / DEGRADADA</span><strong>{nativeReady ? String(summary.unhealthy).padStart(2, "0") : "—"}</strong><small>requieren revisión</small></div>
      </div>

      <div className="bridge-layout">
        <div className="bridge-workspace">
          <div className="bridge-map-heading"><span>R1 · INVENTARIO POR DOMINIO</span><small>{registry.source === "native" ? `lectura del ${new Date(registry.snapshot.generatedAt).toLocaleString("es-PY")}` : isTauri() ? "lectura local" : "vista web"}</small></div>
          <div className="bridge-route capability-registry-route">
            {loadState === "loading" ? <RegistryNotice code="..." title="CONSULTANDO EL REGISTRO LOCAL" detail="Las sondas son pasivas y no abren dispositivos ni escriben memoria." />
              : loadState === "error" ? <RegistryNotice code="ERR" title="REGISTRO NATIVO NO DISPONIBLE" detail={`No se pudo leer el inventario. ${loadError}`} />
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
              <div><dt>Riesgo</dt><dd>{riskLabel[selected.risk]}</dd></div>
              <div><dt>Permiso</dt><dd>{permissionModeLabel[selected.permission.mode]} · {enforcerLabel[selected.permission.enforcedBy]}</dd></div>
              <div><dt>Efectos</dt><dd>{selected.effects.map(effect => effectLabel[effect]).join(", ")}</dd></div>
              <div><dt>Salud</dt><dd>{healthLabel[selected.health.status]}</dd></div>
            </dl>
            <button type="button" className="console-button" onClick={() => onOpenAudit(selected.id)}>Ver operaciones de esta capacidad</button>
            <small>{selected.health.summary}<br />{selected.permission.summary}</small>
          </> : <RegistryNotice code="000" title="SIN CAPACIDAD SELECCIONABLE" detail="No se muestran datos inventados mientras el registro nativo no esté disponible." />}
        </aside>
      </div>

      <button type="button" className="console-button governance-audit-link" onClick={() => onOpenAudit()}>Ver el historial en Auditoría →</button>
    </div>
  </section>;
}

function RegistryNotice({ code, title, detail }: { code: string; title: string; detail: string }) {
  return <div className="capability-registry-notice"><span>{code}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}
