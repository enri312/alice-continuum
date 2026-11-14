import { describe, expect, it } from "vitest";
import { buildBrainSnapshot } from "../../../core/cognitive/brain";
import { applyConversationBehavior } from "../../../core/conversation/behavior-settings";
import { beginMemoryRetrieval, completeMemoryRetrieval, prepareMemoryRetrieval } from "../../../core/memory/retrieval-observation";
import { buildStateControlsPayload, parseStateControlsAction } from "./bridge";

const inputs = { conversationCount: 0, memories: [], retrievedMemoryCount: 0, retrievedMemoryTop: "", retrievedMemoryIds: [], observerEnabled: false, foregroundContext: null, cloudConfigured: false, cloudPending: false };
const payload = (supported = true, busy = false) => buildStateControlsPayload(applyConversationBehavior(buildBrainSnapshot(inputs), { creativity: 0, empathy: 0.5 }, supported, busy), "state-memory", supported && !busy);

describe("contrato de Estado y controles Dioxus", () => {
  it("conserva ceros, bloqueos y ausencia de datos sin usar presets", () => {
    const value = payload();
    expect(value.controls.filter(control => !control.locked).map(control => control.id)).toEqual(["control-creativity", "control-empathy"]);
    expect(value.controls.find(control => control.id === "control-creativity")?.value).toBe(0);
    expect(value.retrieval).toMatchObject({ top: null, count: 0 });
    expect(value.selectedId).toBe("state-memory");
    expect(JSON.stringify(value)).not.toContain("TEST DE PERSONALIDAD");
  });
  it("mantiene la recuperación semántica real y su puntuación sin normalizar", () => {
    const memory = { id: "lesson", intention: "Fracciones equivalentes", memoryType: "semantic" as const, source: "Fuente revisada" };
    const observation = completeMemoryRetrieval(beginMemoryRetrieval(prepareMemoryRetrieval([{ memory, score: 8.75 }], "lexical")), "response:1", "full");
    const value = buildStateControlsPayload(buildBrainSnapshot({ ...inputs, memories: [memory], memoryRetrievalObservation: observation }), "retrieved-memory", false);
    expect(value.retrieval).toMatchObject({ phase: "responded", contextMode: "full", top: { typeLabel: "SEMÁNTICA", text: memory.intention, score: 8.75, source: memory.source } });
  });
  it("autoriza sólo acciones conocidas y controles disponibles en el estado más reciente", () => {
    const event = JSON.stringify({ type: "changeBehavior", id: "control-creativity", value: 0.73 });
    expect(parseStateControlsAction(event, payload())).toEqual(JSON.parse(event));
    expect(parseStateControlsAction(event, payload(true, true))).toBeNull();
    expect(parseStateControlsAction(event, payload(false))).toBeNull();
    for (const raw of ["{}", "null", "[]", "invalid", JSON.stringify({ type: "changeBehavior", id: "control-autonomy", value: 0.9 }), JSON.stringify({ type: "changeBehavior", id: "control-creativity", value: 2 }), JSON.stringify({ type: "select", id: "missing" }), JSON.stringify({ type: "select", id: "state-memory", extra: true })]) expect(parseStateControlsAction(raw, payload())).toBeNull();
    expect(parseStateControlsAction('{"type":"select","id":"retrieved-memory"}', payload())).toEqual({ type: "select", id: "retrieved-memory" });
    expect(parseStateControlsAction('{"type":"select","id":"state-memory"}', payload())).toEqual({ type: "select", id: "state-memory" });
  });
});
