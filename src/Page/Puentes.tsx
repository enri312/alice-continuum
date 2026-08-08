import { useState } from "react";
import { BridgeViewIcon } from "../components/BridgeViewIcon";
import { FaceTrackingPanel } from "../components/FaceTrackingPanel";

type BridgeId = "text" | "voice" | "face" | "gaze" | "body" | "external";

type BridgeDefinition = {
  id: BridgeId;
  code: string;
  label: string;
  description: string;
  protocol: string;
  permission: string;
  glyph: string;
};

const bridges: BridgeDefinition[] = [
  { id: "text", code: "TXT", label: "Texto externo", description: "Entrega respuestas aprobadas a otra aplicación.", protocol: "Sin adaptador", permission: "Destino explícito", glyph: "T_" },
  { id: "voice", code: "VOC", label: "Voz", description: "Convierte una respuesta autorizada en audio reproducible.", protocol: "Sin motor TTS", permission: "Audio de salida", glyph: "))" },
  { id: "face", code: "FCE", label: "Rostro", description: "Expone expresión, intensidad y estado de habla para un avatar.", protocol: "Sin adaptador", permission: "Avatar configurado", glyph: ":)" },
  { id: "gaze", code: "GAZ", label: "Mirada", description: "Publica un vector de orientación para los ojos del avatar.", protocol: "Sin adaptador", permission: "Destino configurado", glyph: "<>" },
  { id: "body", code: "BDY", label: "Cuerpo", description: "Entrega poses o acciones corporales aprobadas.", protocol: "Sin driver", permission: "Dispositivo y avatar", glyph: "/|" },
  { id: "external", code: "EXT", label: "Adaptador externo", description: "Reserva un canal para VRChat u otra aplicación futura.", protocol: "Sin endpoint", permission: "Revisión de seguridad", glyph: "IO" },
];

export function Puentes() {
  const requestedView = new URLSearchParams(window.location.search).get("bridgeView");
  const [view, setView] = useState<"overview" | "face">(requestedView === "face" ? "face" : "overview");
  const [selectedId, setSelectedId] = useState<BridgeId>("text");
  const selected = bridges.find((bridge) => bridge.id === selectedId) ?? bridges[0];

  return <section className="bridge-page" aria-labelledby="bridge-title">
    <div className="bridge-heading">
      <div><p className="eyebrow">[05] OUTPUT BRIDGE REGISTRY · LOCAL</p><h2 id="bridge-title">Puentes de salida</h2><p>Frontera entre las decisiones aprobadas de Alice y sus futuras formas de expresión.</p></div>
      <div className="bridge-offline"><i />0 CONECTADOS</div>
    </div>

    <div className="bridge-view-tabs" role="tablist" aria-label="Visualizaciones de Puentes">
      <button role="tab" aria-label="Resumen de puentes" data-tooltip="Resumen" aria-selected={view === "overview"} className={view === "overview" ? "selected" : ""} onClick={() => setView("overview")}><BridgeViewIcon kind="overview" active={view === "overview"} /><span>Resumen</span></button>
      <button role="tab" aria-label="Diagnóstico de rostro" data-tooltip="Rostro" aria-selected={view === "face"} className={view === "face" ? "selected" : ""} onClick={() => setView("face")}><BridgeViewIcon kind="face" active={view === "face"} /><span>Rostro</span></button>
    </div>

    {view === "overview" ? <>
    <div className="bridge-metrics" aria-label="Estado general de los puentes">
      <div><span>ADAPTADORES</span><strong>0 / {bridges.length}</strong><small>en línea</small></div>
      <div><span>PAQUETES</span><strong>000000</strong><small>enviados</small></div>
      <div><span>CONFIRMADOS</span><strong>000000</strong><small>acknowledged</small></div>
      <div><span>LATENCIA</span><strong>—</strong><small>sin medición</small></div>
    </div>

    <div className="bridge-layout">
      <div className="bridge-workspace">
        <div className="bridge-map-heading"><span>RUTA DE SALIDA</span><small>ningún destino recibe datos</small></div>
        <div className="bridge-route" aria-label="Topología de puentes desconectados">
          <div className="bridge-source"><span>A</span><strong>ALICE CORE</strong><small>respuesta aprobada</small></div>
          <div className="bridge-route-link" aria-hidden="true"><i /><i /><i /></div>
          <div className="bridge-gate"><span>00</span><div><strong>PERMISSION GATE</strong><small>sin solicitud activa</small></div><em>BLOQUEADO</em></div>
          <div className="bridge-bus" aria-hidden="true"><i /></div>
          <div className="bridge-grid">
            {bridges.map((bridge) => <button key={bridge.id} className={selectedId === bridge.id ? "selected" : ""} onClick={() => setSelectedId(bridge.id)} aria-pressed={selectedId === bridge.id}>
              <span className="bridge-glyph" aria-hidden="true">{bridge.glyph}</span><span><strong>{bridge.label}</strong><small>{bridge.code} · SIN CONFIGURAR</small></span><i aria-hidden="true" />
            </button>)}
          </div>
        </div>
      </div>

      <aside className="bridge-inspector" aria-live="polite">
        <p className="eyebrow">INSPECTOR DE CANAL</p><div className="bridge-inspector-code">{selected.code}<span>OFFLINE</span></div>
        <h3>{selected.label}</h3><p>{selected.description}</p>
        <dl><div><dt>Estado</dt><dd>Desconectado</dd></div><div><dt>Protocolo</dt><dd>{selected.protocol}</dd></div><div><dt>Destino</dt><dd>No definido</dd></div><div><dt>Permiso requerido</dt><dd>{selected.permission}</dd></div><div><dt>Paquetes / ACK</dt><dd>0 / 0</dd></div><div><dt>Última latencia</dt><dd>—</dd></div></dl>
        <button className="console-button" disabled>Configurar adaptador · próxima etapa</button>
        <small>Alice no enviará datos a este canal hasta que exista una implementación y una autorización visibles.</small>
      </aside>
    </div>

    <div className="bridge-console" aria-label="Monitor de salida vacío">
      <div className="bridge-console-title"><strong>OUTPUT MONITOR</strong><span>0 registros locales</span></div>
      <div className="bridge-console-head"><span>CHANNEL</span><span>STATUS</span><span>PACKETS</span><span>ACK</span><span>LATENCY</span><span>LAST VALUE</span></div>
      <div className="bridge-console-empty"><span>000</span><strong>SIN TELEMETRÍA</strong><small>Los valores aparecerán cuando un adaptador real produzca datos.</small></div>
    </div>
    <div className="console-prompt"><strong>ALICE_BRIDGE@LOCAL_PROCESS:~$</strong><span>registro vacío · cámara, micrófono, avatar y VR permanecen desactivados</span></div>
    </> : <FaceTrackingPanel />}
  </section>;
}
