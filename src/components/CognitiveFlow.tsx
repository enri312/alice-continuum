import type { CSSProperties } from "react";
import type { BrainFlowNode, BrainSnapshot } from "../core/brain";

type CognitiveFlowProps = {
  snapshot: BrainSnapshot;
  selectedId: string;
  onSelect: (id: string) => void;
};

const connections = [
  ["flow-input", "flow-language"], ["flow-input", "flow-memory"],
  ["flow-language", "flow-social"], ["flow-memory", "flow-social"],
  ["flow-memory", "flow-affect"], ["flow-social", "flow-self"],
  ["flow-social", "flow-affect"], ["flow-self", "flow-workspace"],
  ["flow-affect", "flow-workspace"], ["flow-affect", "flow-inhibition"],
  ["flow-inhibition", "flow-workspace"], ["flow-workspace", "flow-response"],
  ["flow-workspace", "flow-face"], ["flow-workspace", "flow-body"],
] as const;

function point(node: BrainFlowNode) {
  return { x: node.x * 10, y: node.y * 4.3 };
}

function curve(from: BrainFlowNode, to: BrainFlowNode) {
  const start = point(from);
  const end = point(to);
  const middle = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} C ${middle} ${start.y}, ${middle} ${end.y}, ${end.x} ${end.y}`;
}

export function CognitiveFlow({ snapshot, selectedId, onSelect }: CognitiveFlowProps) {
  const byId = new Map(snapshot.flowNodes.map((node) => [node.id, node]));

  return <div className={`cognitive-flow ${snapshot.hasActivity ? "has-activity" : "is-empty"}`}>
    <div className="flow-state">
      <span>{snapshot.hasActivity ? "SEÑAL REGISTRADA" : "SIN ACTIVIDAD COGNITIVA REGISTRADA"}</span>
      <strong>{snapshot.hasActivity ? snapshot.focusStatus : "0 eventos"}</strong>
    </div>
    <svg viewBox="0 0 1000 430" role="img" aria-label="Flujo funcional verificable de Alice">
      <g className="flow-connections">
        {connections.map(([fromId, toId]) => {
          const from = byId.get(fromId);
          const to = byId.get(toId);
          if (!from || !to) return null;
          const activation = Math.max(from.activation, to.activation);
          return <path key={`${fromId}-${toId}`} d={curve(from, to)} style={{ "--signal": activation } as CSSProperties} />;
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
            tabIndex={0}
            aria-label={`${node.label}: ${node.value}, activación ${node.activation.toFixed(3)}`}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(node.id); }}
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
    <div className="flow-legend"><span className="ready">implementado</span><span className="planned">fase futura</span><span>valor = actividad real</span></div>
  </div>;
}
