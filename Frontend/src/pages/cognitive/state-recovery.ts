import { applyConversationBehavior, behaviorKeyForControl } from "../../core/conversation/behavior-settings";
import { describeRetrieval } from "../../components/cognitive/retrieval-display";
import { attributes, element, replaceKeepingFocus } from "../../core/navigation/recovery-dom";
import { updateNucleusHeader, type RecoveryData } from "../../core/navigation/nucleus-recovery";
import { makeButton, type MountedView } from "../../core/navigation/view-mount";

const chips = {
  ready: ["state-status-implemented", "IMPLEMENTADO"],
  planned: ["state-status-planned", "FUTURO"],
};
const hidden = { "aria-hidden": true };

export function mountStateRecovery(host: HTMLElement, read: () => RecoveryData, initial: string, onSelect: (id: string) => void): MountedView {
  let selected = initial;
  let rendered = "";
  const section = element("section", "neuro-panel nucleus-page");
  const stage = element("div", "neuro-stage");
  const inspector = element("aside", "neuro-inspector");
  section.append(element("div", "neuro-layout", stage, inspector),
    element("p", "neuro-footnote", "Los ajustes de estilo no conceden permisos. Las señales técnicas no representan emociones ni conciencia; los módulos pendientes conservan su bloqueo."));
  host.append(section);

  function model() {
    const data = read();
    const { behavior } = data;
    const snapshot = behavior ? applyConversationBehavior(data.snapshot, behavior.settings, behavior.supported, behavior.busy) : data.snapshot;
    return { data, snapshot, behavior };
  }
  function showSelection() {
    const { snapshot } = model();
    for (const row of stage.querySelectorAll<HTMLElement>(".state-selection-target")) {
      const active = row.dataset.selection === selected;
      row.classList.toggle("selected", active);
      const control = row.matches("button") ? row : row.querySelector("button");
      control?.setAttribute("aria-pressed", String(active));
    }
    const label = element("p", "eyebrow", "INSPECTOR");
    if (selected === "retrieved-memory") {
      const view = describeRetrieval(snapshot.retrievedMemory);
      inspector.replaceChildren(label, element("div", "state-retrieval-inspector",
        element("h3", "", "Memoria recuperada"), element("span", "state-retrieval-status", view.status), element("p", "", element("strong", "", view.type)),
        element("p", "", view.text), element("dl", "", element("dt", "", view.scoreLabel), element("dd", "", view.score),
          element("dt", "", "Coincidencias vigentes"), element("dd", "", String(snapshot.retrievedMemory.count))),
        element("p", "", view.detail), view.source ? element("small", "", `Fuente: ${view.source}.`) : null));
    } else {
      const item = [...snapshot.stateMetrics, ...snapshot.behaviorControls].find(item => item.id === selected) ?? snapshot.stateMetrics[0];
      inspector.replaceChildren(label, element("h3", "", item.label), element("span", "inspector-value", item.value.toFixed(3)),
        element("p", "", item.detail), element("small", "", "Creatividad y estilo empático se aplican a la conversación local. Los controles bloqueados conservan sus límites."));
    }
  }
  function select(id: string) {
    selected = id;
    onSelect(id);
    showSelection();
  }
  function title(id: string, text: string, detail = "") {
    return element("div", "state-section-title", attributes(element("span", "", text), { id, role: "heading", "aria-level": 3 }),
      detail ? element("small", "", detail) : null);
  }
  function refresh() {
    const { data, snapshot, behavior } = model();
    const key = JSON.stringify([data.activityStatus, data.activity, snapshot.stateMetrics, snapshot.behaviorControls,
      snapshot.retrievedMemory, snapshot.nodes, snapshot.hasActivity]);
    if (key === rendered) return;
    rendered = key;
    updateNucleusHeader(section, data, "[03]", "Estado y controles", "Señales verificables, memoria recuperada y ajustes disponibles para el próximo envío.");
    const memory = snapshot.nodes.find(node => node.id === "memory")?.value ?? "0 recuerdos";
    const metrics = element("div", "metric-grid");
    for (const item of snapshot.stateMetrics) {
      const [chip, status] = chips[item.availability];
      const score = item.value.toFixed(3);
      const fill = element("i");
      fill.style.width = `${item.value * 100}%`;
      const row = makeButton("", () => select(item.id),
        `metric-row state-selection-target state-kind-metric state-availability-${item.availability} ${item.availability}`);
      row.append(element("span", "metric-label state-item-label", element("span", "state-item-name", item.label), element("i", `state-status-chip ${chip}`, status)),
        attributes(element("span", "metric-track state-value-track", fill), hidden), attributes(element("strong", "state-value-output", score), hidden));
      attributes(row, { "data-selection": item.id, "data-recovery-focus": item.id,
        "aria-label": `${item.label}: ${score}. Estado: ${status.toLowerCase()}. Abrir en el inspector.` });
      metrics.append(row);
    }
    const retrieval = describeRetrieval(snapshot.retrievedMemory);
    const row = makeButton("", () => select("retrieved-memory"), "retrieved-row state-selection-target state-kind-retrieval");
    row.append(element("span", "", retrieval.type), element("strong", "", retrieval.text),
      attributes(element("em", "", retrieval.score), { title: retrieval.scoreLabel }));
    attributes(row, { "data-selection": "retrieved-memory", "data-recovery-focus": "retrieved-memory",
      "aria-label": `Memoria recuperada, ${retrieval.type}: ${retrieval.text}. ${retrieval.status}. ${retrieval.scoreLabel}: ${retrieval.score}. Abrir detalles en el inspector.` });
    const controls = element("div", "control-grid");
    for (const item of snapshot.behaviorControls) {
      const [chip, status] = chips[item.availability];
      const locked = item.locked || !behavior;
      const lock = locked ? "Bloqueado." : "Ajuste de esta sesión.";
      const score = item.value.toFixed(2);
      const btn = makeButton("", () => select(item.id), "state-control-inspect");
      btn.append(element("span", "state-item-name", item.label), element("span", "state-status-list",
        element("i", `state-status-chip ${chip}`, status),
        element("i", `state-status-chip state-status-${locked ? "locked" : "implemented"}`, locked ? "BLOQUEADO" : "AJUSTABLE")));
      attributes(btn, { "aria-label": `${item.label}: ${score}. Estado: ${status.toLowerCase()}. ${lock} Abrir en el inspector.`,
        "data-recovery-focus": item.id });
      const slider = attributes(element("input", "state-behavior-range"), { type: "range", min: 0, max: 1, step: 0.01,
        "aria-label": `${item.label}. ${lock}`, "aria-valuetext": score, "data-recovery-focus": `${item.id}-range` });
      const output = attributes(element("strong", "state-value-output", score), hidden);
      slider.value = String(item.value);
      slider.disabled = locked;
      slider.addEventListener("focus", () => select(item.id));
      slider.addEventListener("input", () => {
        output.textContent = slider.valueAsNumber.toFixed(2);
        slider.setAttribute("aria-valuetext", output.textContent);
      });
      slider.addEventListener("change", () => {
        const key = behaviorKeyForControl(item.id);
        const current = read().behavior;
        if (key && current?.supported && !current.busy) current.onChange(key, slider.valueAsNumber);
      });
      const lockClass = locked ? "state-lock-locked" : "state-lock-available";
      controls.append(attributes(element("div",
        `control-row state-control-slider state-selection-target state-kind-control state-availability-${item.availability} ${lockClass} ${item.availability}`, btn, slider, output), { "data-selection": item.id }));
    }
    replaceKeepingFocus(stage, element("div", `internal-state ${snapshot.hasActivity ? "has-activity" : "is-empty"}`,
      element("div", "nucleus-panel-label state-panel-caption", element("span", "", "[03]"), element("strong", "", "REPLY + AFFECT + DRIVE STATE"),
        element("small", "", "SEÑALES DE LECTURA · AJUSTES DE SESIÓN")),
      element("header", "state-header", element("div", "", element("span", "state-monogram", "ALI"), element("strong", "", "ALICE"),
        element("small", "", "MODELO INTERNO · SEÑALES Y AJUSTES DE SESIÓN")), element("span", "state-records", memory.toUpperCase())),
      attributes(element("section", "state-section", title("signals-title", "SEÑALES INTERNAS", snapshot.hasActivity ? "DATOS VERIFICABLES" : "SIN ACTIVIDAD"), metrics), { "aria-labelledby": "signals-title" }),
      attributes(element("section", "state-section retrieved-memory", title("retrieved-title", "MEMORIA RECUPERADA"), row), { "aria-labelledby": "retrieved-title" }),
      attributes(element("section", "state-section behavior-section", title("behavior-title", "CONTROLES DE COMPORTAMIENTO", "AJUSTES DEL PRÓXIMO ENVÍO · BLOQUEO SEGÚN DISPONIBILIDAD"), controls), { "aria-labelledby": "behavior-title" })));
    showSelection();
  }
  refresh();
  return { refresh, dispose: () => section.remove() };
}
