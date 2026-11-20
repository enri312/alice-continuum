import type { NucleusActivityStatus } from "../../pages/shared/nucleus-shared";
import type { CSSProperties } from "react";
import type { BrainFlowNode, BrainSnapshot } from "../../../core/cognitive/brain";
import type { CoreActivityLinkId, CoreActivitySnapshot } from "../../../core/cognitive/core-activity";

type CognitiveFlowProps = {
  snapshot: BrainSnapshot;
  activity: CoreActivitySnapshot | null;
  activityStatus: NucleusActivityStatus;
  selectedId: string;
  onSelect: (id: string) => void;
};

const connections: { from: string; to: string; evidence: CoreActivityLinkId | null }[] = [
  { from: "flow-inhibition", to: "flow-input", evidence: "permission-perception" },
  { from: "flow-input", to: "flow-workspace", evidence: "perception-workspace" },
  { from: "flow-memory", to: "flow-workspace", evidence: "memory-workspace" },
  { from: "flow-language", to: "flow-workspace", evidence: "language-workspace" },
  { from: "flow-workspace", to: "flow-response", evidence: "workspace-output" },
  { from: "flow-language", to: "flow-social", evidence: null },
  { from: "flow-memory", to: "flow-social", evidence: null },
  { from: "flow-social", to: "flow-self", evidence: null },
  { from: "flow-social", to: "flow-affect", evidence: null },
  { from: "flow-self", to: "flow-workspace", evidence: null },
  { from: "flow-affect", to: "flow-workspace", evidence: null },
  { from: "flow-workspace", to: "flow-face", evidence: null },
  { from: "flow-workspace", to: "flow-body", evidence: null },
];

function point(node: BrainFlowNode) {
  return { x: node.x * 10, y: node.y * 4.3 };
}

function curve(from: BrainFlowNode, to: BrainFlowNode) {
  const start = point(from);
  const end = point(to);
  const middle = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`;
}

export function CognitiveFlow({ snapshot, activity, activityStatus, selectedId, onSelect }: CognitiveFlowProps) {
  const byId = new Map(snapshot.flowNodes.map((node) => [node.id, node]));
  const byLink = new Map(activity?.links.map((link) => [link.id, link]));

  const activeRoutes = activity?.links.filter(link => link.signal > 0).length ?? 0;
  const summary = activityStatus === "loading" ? "Leyendo auditoría…" : !activity
    ? "Lectura no disponible" : activeRoutes === 1 ? "1 ruta con señal" : `${activeRoutes} rutas con señal`;

  return <div className="cognitive-flow">
    <header className="flow-heading"><h3>Rutas del espacio de trabajo</h3><span>{summary}</span></header>
    <div className="flow-viewport" role="region" tabIndex={0} aria-label="Mapa de conexiones">
    <svg viewBox="0 0 1000 430" role="group" aria-label="Flujo funcional verificable de Alice">
      <g className="flow-connections">
        {connections.map(({ from: fromId, to: toId, evidence }) => {
          const from = byId.get(fromId);
          const to = byId.get(toId);
          if (!from || !to) return null;
          const activation = evidence ? byLink.get(evidence)?.signal ?? 0 : 0;
          return <path key={`${fromId}-${toId}`} d={curve(from, to)} data-route={activation > 0 ? "signal" : evidence ? "idle" : "planned"} style={{ "--signal": activation } as CSSProperties} />;
        })}
      </g>
      <g className="flow-nodes">
        {snapshot.flowNodes.map((node) => {
          const position = point(node);
          const selected = selectedId === node.id;
          return <g
            key={node.id}
            className={`flow-node ${node.group} ${node.availability} ${selected ? "selected" : ""}`}
            style={{ "--signal": node.activation } as CSSProperties}
            transform={`translate(${position.x} ${position.y})`}
            role="button"
            aria-pressed={selected}
            tabIndex={0}
            aria-label={`${node.label}: ${node.value}, activación ${node.activation.toFixed(3)}`}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.id); } }}
          >
            <circle className="flow-node-halo" r="28" />
            <circle className="flow-node-core" r="11" />
            <text className="flow-score" y="-23" textAnchor="middle">{node.activation.toFixed(3)}</text>
            <text className="flow-label" y="35" textAnchor="middle">{node.label.toUpperCase()}</text>
            {node.availability === "planned" && <text className="flow-planned" y="49" textAnchor="middle">NO IMPLEMENTADO</text>}
          </g>;
        })}
      </g>
    </svg>
    </div>
    <div className="flow-legend"><span className="ready">Señal reciente</span><span>Sin señal</span><span className="planned">Ruta prevista</span></div>
  </div>;
}
