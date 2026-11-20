import type { BrainFlowNode } from "../../core/cognitive/brain";
import type { CoreActivityLinkId } from "../../core/cognitive/core-activity";
import { buildActivityPayload } from "../../components/cognitive/activity-payload";
import { mountAssociationsRecovery } from "../../components/memory/associations-recovery";
import { attributes, element, svg } from "../../core/navigation/recovery-dom";
import { updateNucleusHeader, type RecoveryData } from "../../core/navigation/nucleus-recovery";
import { mountRoute, type MountedView } from "../../core/navigation/view-mount";

const connections: [string, string, CoreActivityLinkId?][] = [
  ["flow-inhibition", "flow-input", "permission-perception"],
  ["flow-input", "flow-workspace", "perception-workspace"],
  ["flow-memory", "flow-workspace", "memory-workspace"],
  ["flow-language", "flow-workspace", "language-workspace"],
  ["flow-workspace", "flow-response", "workspace-output"],
  ["flow-language", "flow-social"], ["flow-memory", "flow-social"], ["flow-social", "flow-self"],
  ["flow-social", "flow-affect"], ["flow-self", "flow-workspace"], ["flow-affect", "flow-workspace"],
  ["flow-workspace", "flow-face"], ["flow-workspace", "flow-body"],
];

const point = (node: BrainFlowNode) => [node.x * 10, node.y * 4.3];

function drawGraph(host: HTMLElement, read: () => RecoveryData, getSelected: () => string, setSelected: (id: string) => void): MountedView {
  const section = element("div");
  const inspector = element("aside", "neuro-inspector");
  const stage = element("div", "neuro-stage");
  section.append(element("div", "neuro-layout", stage, inspector));
  host.append(section);
  let last = "";

  function showSelection(nodes: BrainFlowNode[]) {
    const selected = nodes.find(node => node.id === getSelected()) ?? nodes[0];
    for (const row of stage.querySelectorAll(".flow-node")) {
      const active = row.getAttribute("data-node") === selected.id;
      row.classList.toggle("selected", active);
      row.setAttribute("aria-pressed", String(active));
    }
    inspector.replaceChildren(element("p", "eyebrow", "INSPECTOR"), element("h3", "", selected.label),
      element("span", "inspector-value", selected.value), element("p", "", selected.detail),
      element("small", "", "La activación es una señal técnica derivada, no una experiencia interna."));
  }

  function refresh() {
    const data = read();
    const { snapshot: { flowNodes }, activity, activityStatus } = data;
    const key = JSON.stringify([flowNodes, activity, activityStatus]);
    if (last === key) return;
    last = key;
    updateNucleusHeader(section, data, "[02]", "Flujo cognitivo", "Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida.");
    const byId = new Map(flowNodes.map(node => [node.id, node]));
    const signals = new Map(activity?.links.map(link => [link.id, link.signal]));
    const active = activity?.links.filter(link => link.signal > 0).length ?? 0;
    const summary = activityStatus === "loading" ? "Leyendo auditoría…" : !activity ? "Lectura no disponible"
      : active === 1 ? "1 ruta con señal" : `${active} rutas con señal`;
    const paths = svg("g", { class: "flow-connections" });
    for (const [from, to, evidence] of connections) {
      const a = byId.get(from), b = byId.get(to);
      if (!a || !b) continue;
      const [x, y] = point(a), [endX, endY] = point(b);
      const middle = (x + endX) / 2;
      const signal = evidence ? signals.get(evidence) ?? 0 : 0;
      paths.append(svg("path", { d: `M ${x} ${y} C ${middle} ${y}, ${middle} ${endY}, ${endX} ${endY}`,
        "data-route": signal > 0 ? "signal" : evidence ? "idle" : "planned", style: `--signal: ${signal}` }));
    }
    const nodes = svg("g", { class: "flow-nodes" });
    for (const node of flowNodes) {
      const [x, y] = point(node);
      const score = node.activation.toFixed(3);
      const group = svg("g", { class: `flow-node ${node.group} ${node.availability}`, style: `--signal: ${node.activation}`,
        transform: `translate(${x} ${y})`, role: "button", tabindex: 0, "data-node": node.id,
        "aria-label": `${node.label}: ${node.value}, activación ${score}` },
        svg("circle", { class: "flow-node-halo", r: 28 }), svg("circle", { class: "flow-node-core", r: 11 }),
        svg("text", { class: "flow-score", y: -23, "text-anchor": "middle" }, score),
        svg("text", { class: "flow-label", y: 35, "text-anchor": "middle" }, node.label.toUpperCase()));
      if (node.availability === "planned") group.append(svg("text", { class: "flow-planned", y: 49, "text-anchor": "middle" }, "NO IMPLEMENTADO"));
      const select = () => { setSelected(node.id); showSelection(flowNodes); };
      group.addEventListener("click", select);
      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
      });
      nodes.append(group);
    }
    const focused = stage.contains(document.activeElement) ? document.activeElement?.getAttribute("data-node") : null;
    stage.replaceChildren(element("div", "cognitive-flow",
      element("header", "flow-heading", element("h3", "", "Rutas del espacio de trabajo"), element("span", "", summary)),
      attributes(element("div", "flow-viewport", svg("svg", { viewBox: "0 0 1000 430", role: "group", "aria-label": "Flujo funcional verificable de Alice" }, paths, nodes)),
        { role: "region", tabindex: 0, "aria-label": "Mapa de conexiones" }),
      element("div", "flow-legend", element("span", "ready", "Señal reciente"), element("span", "", "Sin señal"), element("span", "planned", "Ruta prevista"))));
    if (focused) stage.querySelector<SVGElement>(`[data-node="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    showSelection(flowNodes);
  }

  refresh();
  return { refresh, dispose: () => section.remove() };
}

export function mountFlowRecovery(host: HTMLElement, read: () => RecoveryData, initial: string, onSelect: (id: string) => void): MountedView {
  let selected = initial;
  const select = (id: string) => { selected = id; onSelect(id); };
  const section = attributes(element("section", "neuro-panel nucleus-page"), { "aria-labelledby": "[02]-title" });
  host.append(section);
  const graph = mountRoute(section, {
    renderer: "flow-graph", attribute: "data-renderer", name: "Flujo cognitivo",
    load: () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadFlowRuntime()),
    configuration() {
      const { snapshot, activity, activityStatus } = read();
      return {
        nodes: snapshot.flowNodes, links: activity?.links.map(({ id, signal }) => ({ id, signal })) ?? [],
        selectedId: selected, hasActivity: snapshot.hasActivity, activity: buildActivityPayload(activity, activityStatus),
      };
    },
    createTransport: () => ({
      dispatch(raw) {
        try {
          const action = JSON.parse(raw);
          if (action?.type === "select" && read().snapshot.flowNodes.some(node => node.id === action.id)) select(action.id);
        } catch { /* Ignore malformed graph actions. */ }
      },
    }),
    errorTitle: "Vista de respaldo activa.", recover: slot => drawGraph(slot, read, () => selected, select),
  });
  const associations = mountAssociationsRecovery(section, read().desktopApp);
  section.append(element("p", "neuro-footnote", "Los enlaces se iluminan solo cuando tienen evidencia R3 reciente. Las rutas futuras continúan visibles como planificadas y no representan actividad real."));
  function refresh() {
    const { activity, activityStatus } = read();
    section.dataset.activityState = activityStatus === "ready" && !activity?.links.some(link => link.signal > 0) ? "idle" : activityStatus;
    graph.refresh();
    associations.refresh();
  }
  refresh();
  return { refresh, dispose() { graph.dispose(); associations.dispose(); section.remove(); } };
}
