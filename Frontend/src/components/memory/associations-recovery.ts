import { invoke } from "@tauri-apps/api/core";
import { attributes, element, replaceKeepingFocus } from "../../core/navigation/recovery-dom";
import { makeButton, mountRoute, type MountedView } from "../../core/navigation/view-mount";
import { startAssociationsTransport } from "./associations-transport";
import { parseConfirmationAction, type ConfirmationPayload } from "./confirmation-bridge";
import { parseRelationReview, type SavedRelationsPayload } from "./saved-relations-bridge";
import { buildSourceChoices, canPreviewSources, parseSourceFormAction, type SourceFormAction, type SourceFormPayload } from "./source-form-bridge";
import "../documents/DocumentPreview.css";

type Evidence = { recordId: string; recordVersion: number; recordSha256: string; quote: string };
type Node = { evidenceUse: string; recordVersion: number; lifecycle: { recordId: string; recordSha256: string } };
type MemoryRecord = { id: string; intention: string };
type Relation = { id: string; revision: number; withdrawn: boolean; sourcesCurrent: boolean; evidence: { recordId: string }[] };
type Status = { revision: number; associations: Relation[] };
type Review = { kind: "create"; evidence: Evidence[]; revision: number; token: string }
  | { kind: "change"; relation: Relation; revision: number; token: string };

const runtime = () => import("../cognitive/state-controls/runtime");
const indexes = [0, 1] as const;

function disabledButton(text: string, disabled: boolean, click: () => void) {
  const button = makeButton(text, click, "");
  button.disabled = disabled;
  return button;
}

function sourceFallback(host: HTMLElement, read: () => SourceFormPayload, act: (action: SourceFormAction) => void): MountedView {
  const low = element("p", "", "Se necesitan dos episodios recuperables para proponer una relación.");
  const fields = element("fieldset", "", element("legend", "", "Elegir fuentes y copiar una cita literal de cada entrada"));
  fields.style.cssText = "border: 1px solid #315366; padding: 16px";
  const inputs = indexes.map(index => {
    const number = index + 1;
    const select = attributes(element("select"), { "aria-label": `Experiencia ${number}` });
    const quote = attributes(element("textarea"), { "aria-label": `Cita ${number}`, maxlength: 2048, rows: 2 });
    const entry = element("pre");
    entry.style.whiteSpace = "pre-wrap";
    const details = element("details", "", element("summary", "", `Leer entrada original ${number}`), entry);
    select.addEventListener("change", () => act({ type: "selectSource", index, id: select.value }));
    quote.addEventListener("input", () => act({ type: "editQuote", index, quote: quote.value }));
    const row = element("div", "", element("label", "", `Experiencia ${number}`, select), details, element("label", "", `Cita ${number}`, quote));
    row.style.marginBottom = "16px";
    fields.append(row);
    return { select, quote, entry, details };
  });
  const preview = makeButton("Revisar relación", () => act({ type: "previewSources" }), "");
  fields.append(preview);
  host.append(low, fields);
  let lastChoices = "";
  function refresh() {
    const data = read();
    const choices = JSON.stringify(data.sources.map(({ id, title }) => [id, title]));
    low.hidden = data.sources.length >= 2;
    fields.hidden = !low.hidden;
    fields.disabled = data.busy;
    preview.disabled = !canPreviewSources(data);
    for (const i of indexes) {
      const { select, quote, entry, details } = inputs[i];
      if (choices !== lastChoices) select.replaceChildren(attributes(element("option", "", "Seleccionar episodio"), { value: "" }),
        ...data.sources.map(source => attributes(element("option", "", source.title), { value: source.id })));
      select.value = data.selected[i];
      const current = data.sources.find(source => source.id === data.selected[i]);
      details.hidden = !current;
      entry.textContent = current?.entry ?? "";
      if (quote.value !== data.quotes[i]) quote.value = data.quotes[i];
    }
    lastChoices = choices;
  }
  refresh();
  return { refresh, dispose() { low.remove(); fields.remove(); } };
}

function listFallback(host: HTMLElement, read: () => SavedRelationsPayload, review: (id: string) => void): MountedView {
  let previous = "";
  const area = element("div");
  host.append(area);
  function refresh() {
    const { relations, busy } = read();
    const key = JSON.stringify([relations, busy]);
    if (key === previous) return;
    previous = key;
    const contents = document.createDocumentFragment();
    contents.append(element("h4", "", "Relaciones guardadas"));
    if (!relations.length) contents.append(element("p", "", "No hay relaciones guardadas. No se crearon conexiones automáticas."));
    for (const relation of relations) {
      const action = relation.withdrawn ? "Restaurar relación" : "Retirar relación";
      const status = relation.withdrawn ? "Retirada" : relation.sourcesCurrent ? "Vigente · confirmada por vos" : "No vigente · fuente cambiada o no recuperable";
      const button = disabledButton(action, busy || (relation.withdrawn && !relation.sourcesCurrent), () => review(relation.id));
      const row = element("article", "", element("p", "", relation.title), element("p", "", status),
        attributes(button, { "data-recovery-focus": relation.id }));
      row.style.cssText = "border-top: 1px solid #315366; padding: 14px 0";
      contents.append(row);
    }
    replaceKeepingFocus(area, contents);
  }
  refresh();
  return { refresh, dispose: () => area.remove() };
}

function confirmationFallback(host: HTMLElement, read: () => ConfirmationPayload, act: (type: "confirm" | "cancel", token: string) => void): MountedView {
  const area = element("div");
  host.append(area);
  let previous = "";
  function refresh() {
    const data = read();
    const key = JSON.stringify(data);
    if (key === previous) return;
    previous = key;
    const create = data.kind === "create";
    const description = create ? "Las dos citas coinciden con las fuentes actuales. Revisá si realmente querés relacionar estas experiencias:"
      : `¿${data.withdrawn ? "Restaurar" : "Retirar"} esta relación? No modifica recuerdos y conserva las revisiones anteriores.`;
    const region = attributes(element("div", "", element("p", "", description)), {
      role: "region", "aria-label": create ? "Confirmar relación revisada" : "Confirmar cambio de relación",
    });
    if (create) region.append(...data.quotes.map(quote => element("blockquote", "", quote)));
    region.append(disabledButton(create ? "Confirmar y guardar relación" : "Confirmar cambio", data.busy, () => act("confirm", data.token)));
    if (!create) region.append(disabledButton("Cancelar", data.busy, () => act("cancel", data.token)));
    area.replaceChildren(region);
  }
  refresh();
  return { refresh, dispose: () => area.remove() };
}

function mountEditor(host: HTMLElement, desktopApp: boolean): MountedView {
  const section = attributes(element("section", "perception-vector document-preview memory-associations",
    element("header", "", attributes(element("h3", "", "RELACIONES ENTRE RECUERDOS"), { id: "associations-title" })),
    element("p", "", "Relacioná dos experiencias por decisión tuya. Una relación confirmada expresa tu criterio; no demuestra causalidad ni convierte respuestas del modelo en hechos.")),
    { "aria-labelledby": "associations-title" });
  host.append(section);
  if (!desktopApp) {
    section.append(element("p", "", "Disponible en la aplicación de escritorio."));
    return { refresh() {}, dispose: () => section.remove() };
  }

  let active = true;
  let busy = false;
  let status: Status | null = null;
  let nodes: Node[] = [];
  let records: MemoryRecord[] = [];
  const selected: [string, string] = ["", ""];
  const quotes: [string, string] = ["", ""];
  let review: Review | null = null;
  let token = 0;
  let error = "", message = "";
  let list: MountedView | undefined, form: MountedView | undefined, confirmation: MountedView | undefined;
  let displayedToken = "";
  const update = makeButton("Actualizar relaciones", () => { void run(readStores); }, "");
  const count = element("p"), sourceSlot = element("div"), listSlot = element("div"), confirmationSlot = element("div");
  const feedback = element("div");
  section.append(update, count, sourceSlot, listSlot, confirmationSlot, feedback);

  async function readStores() {
    if (!active) return;
    const [graph, memory, relations] = await Promise.all([
      invoke<{ nodes: Node[] }>("knowledge_graph_snapshot"),
      invoke<{ sessions: MemoryRecord[] }>("load_memory"),
      invoke<Status>("knowledge_graph_associations"),
    ]);
    if (!active) return;
    if (!Array.isArray(graph?.nodes) || !Array.isArray(memory?.sessions) || !Array.isArray(relations?.associations)
      || !Number.isSafeInteger(relations.revision) || relations.revision < 0) throw new Error("Lectura de relaciones inválida.");
    nodes = graph.nodes.filter(item => item?.evidenceUse === "episodeOnly" && typeof item.lifecycle?.recordId === "string"
      && Number.isSafeInteger(item.recordVersion) && /^sha256:[a-f0-9]{64}$/i.test(item.lifecycle.recordSha256));
    records = memory.sessions.filter(item => typeof item?.id === "string" && typeof item.intention === "string");
    status = relations;
    review = null;
  }

  async function run(operation: () => Promise<void>) {
    if (busy || !active) return;
    busy = true;
    error = "";
    message = "";
    refresh();
    try { await operation(); }
    catch (cause) { error = String(cause); review = null; }
    finally { busy = false; if (active) refresh(); }
  }

  const sourceData = (): SourceFormPayload => ({ busy, sources: buildSourceChoices(nodes.map(node => node.lifecycle.recordId), records, selected), selected, quotes });
  function sourceAction(raw: string) {
    const action = parseSourceFormAction(raw, sourceData());
    if (!action) return;
    if (action.type === "previewSources") {
      void run(async () => {
        if (!status) return;
        const revision = status.revision;
        const evidence = selected.map((id, index) => {
          const node = nodes.find(node => node.lifecycle.recordId === id);
          if (!node) throw new Error("Seleccioná dos episodios recuperables.");
          return { recordId: id, recordVersion: node.recordVersion, recordSha256: node.lifecycle.recordSha256, quote: quotes[index] };
        });
        await invoke("preview_knowledge_graph_association", { evidence });
        if (active) review = { kind: "create", evidence, revision, token: `create-${++token}` };
      });
    } else {
      if (action.type === "selectSource") {
        selected[action.index] = action.id;
        quotes[action.index] = "";
      } else quotes[action.index] = action.quote;
      if (review?.kind === "create") review = null;
      refresh();
    }
  }

  const listData = (): SavedRelationsPayload => ({
    busy, relations: (status?.associations ?? []).map(item => ({
      id: item.id, withdrawn: item.withdrawn, sourcesCurrent: item.sourcesCurrent,
      title: item.evidence.map(source => records.find(record => record.id === source.recordId)?.intention.slice(0, 90) || source.recordId).join(" ↔ "),
    })),
  });

  function reviewAction(raw: string) {
    const id = parseRelationReview(raw, listData());
    const relation = status?.associations.find(item => item.id === id);
    if (!status || !relation) return;
    review = { kind: "change", relation, revision: status.revision, token: `change-${++token}` };
    refresh();
  }

  function confirmData(item: Review): ConfirmationPayload {
    return { kind: item.kind, token: item.token, busy,
      quotes: item.kind === "create" ? item.evidence.map(evidence => evidence.quote) : [],
      withdrawn: item.kind === "change" && item.relation.withdrawn };
  }

  function confirm(raw: string) {
    const item = review;
    if (!item || !active) return;
    const action = parseConfirmationAction(raw, confirmData(item));
    if (!action) return;
    if (action === "cancel") { review = null; refresh(); return; }
    void run(async () => {
      if (item.kind === "create") await invoke("confirm_knowledge_graph_association", {
        evidence: item.evidence, expectedRevision: item.revision, confirmed: true,
      });
      else await invoke("set_knowledge_graph_association_withdrawn", {
        id: item.relation.id, withdrawn: !item.relation.withdrawn, expectedRevision: item.revision, confirmed: true,
      });
      await readStores();
      message = item.kind === "create" ? "Relación guardada por tu confirmación." : "Cambio guardado en el historial de relaciones.";
    });
  }

  function refresh() {
    update.disabled = busy;
    const current = status;
    count.hidden = !current;
    if (current) {
      count.textContent = `${current.associations.filter(item => !item.withdrawn && item.sourcesCurrent).length} vigentes · revisión ${current.revision} · estado comprobado al actualizar`;
      form ??= mountRoute(sourceSlot, {
        renderer: "source-form", name: "Formulario de fuentes", errorTitle: "Formulario de respaldo activo.", retry: "Reintentar formulario",
        load: () => runtime().then(module => module.loadSourceFormRuntime()), configuration: sourceData,
        createTransport: () => ({ dispatch: sourceAction }),
        recover: slot => sourceFallback(slot, sourceData, action => sourceAction(JSON.stringify(action))),
      });
      list ??= mountRoute(listSlot, {
        renderer: "relations", name: "Relaciones guardadas", errorTitle: "Lista de respaldo activa.", retry: "Reintentar lista",
        load: () => runtime().then(module => module.loadRelationsRuntime()), configuration: listData,
        createTransport: () => ({ dispatch: reviewAction }),
        recover: slot => listFallback(slot, listData, id => reviewAction(JSON.stringify({ type: "reviewRelation", id }))),
      });
      form.refresh();
      list.refresh();
    }
    const item = review;
    if (displayedToken !== (item?.token ?? "")) {
      confirmation?.dispose();
      confirmation = undefined;
      displayedToken = item?.token ?? "";
      if (item) confirmation = mountRoute(confirmationSlot, {
        renderer: "confirmation", name: "Confirmación", errorTitle: "Confirmación de respaldo activa.", retry: "Reintentar confirmación",
        load: () => runtime().then(module => module.loadConfirmationRuntime()), configuration: () => confirmData(item),
        createTransport: () => ({ dispatch: confirm }),
        recover: slot => confirmationFallback(slot, () => confirmData(item), (type, token) => confirm(JSON.stringify({ type, token }))),
      });
    }
    confirmation?.refresh();
    const text = busy ? "Comprobando fuentes…" : error || message;
    feedback.replaceChildren(...(text ? [attributes(element("p", "", text), { role: error ? "alert" : "status" })] : []));
  }

  void run(readStores);
  return {
    refresh,
    dispose() {
      active = false;
      confirmation?.dispose();
      form?.dispose();
      list?.dispose();
      section.remove();
    },
  };
}

export function mountAssociationsRecovery(host: HTMLElement, desktopApp: boolean) {
  return mountRoute(host, {
    renderer: "associations", name: "Relaciones entre recuerdos", errorTitle: "Relaciones de respaldo activas.", retry: "Reintentar relaciones",
    load: () => runtime().then(module => module.loadAssociationsRuntime()),
    configuration: () => ({ type: "configure", desktopApp }),
    createTransport(_element, reply) {
      const transport = startAssociationsTransport(invoke, reply);
      return { dispatch: transport.accept, dispose: transport.dispose };
    },
    recover: slot => mountEditor(slot, desktopApp),
  });
}
