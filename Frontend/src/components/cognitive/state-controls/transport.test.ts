import { describe, expect, it, vi } from "vitest";
import { buildBrainSnapshot } from "../../../core/cognitive/brain";
import { buildStateControlsPayload } from "./bridge";
import { startStateControlsTransport } from "./transport";

const inputs = { conversationCount: 0, memories: [], retrievedMemoryCount: 0, retrievedMemoryTop: "", retrievedMemoryIds: [], observerEnabled: false, foregroundContext: null, cloudConfigured: false, cloudPending: false };
const payload = (busy = false) => buildStateControlsPayload(buildBrainSnapshot(inputs), "state-memory", { settings: { creativity: 0.4, empathy: 0.5 }, supported: true, busy });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe("transporte de la sesión Estado Dioxus", () => {
  it("serializa lecturas y descarta la respuesta al desmontar", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn(() => new Promise<unknown>(done => { resolve = done; }));
    const complete = vi.fn();
    const transport = startStateControlsTransport({ invoke, complete, payload, onAction: vi.fn() });
    transport.accept('{"scope":"activity","id":1}');
    transport.accept('{"scope":"activity","id":1}');
    transport.accept('{"scope":"activity","id":2}');
    await flush();
    expect(invoke).toHaveBeenCalledExactlyOnceWith("core_activity_snapshot");
    transport.dispose(); resolve({ private: "not delivered" }); await flush();
    expect(complete).not.toHaveBeenCalled();
  });
  it("comunica errores y sólo admite la lectura cerrada", async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ fixture: true });
    const complete = vi.fn();
    const transport = startStateControlsTransport({ invoke, complete, payload, onAction: vi.fn() });
    for (const raw of ['null', '[]', 'bad', '{"scope":"activity","id":0}', '{"scope":"activity","id":1,"command":"delete"}']) transport.accept(raw);
    expect(invoke).not.toHaveBeenCalled();
    transport.accept('{"scope":"activity","id":1}'); await flush();
    expect(complete).toHaveBeenLastCalledWith({ type: "activityFailure", id: 1 });
    transport.accept('{"scope":"activity","id":1}');
    transport.accept('{"scope":"activity","id":2}'); await flush();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenLastCalledWith({ type: "activitySuccess", id: 2, value: { fixture: true } });
  });
  it("revalida ajustes con el bloqueo actual sin escribir al seleccionar", () => {
    let busy = false;
    const invoke = vi.fn(); const onAction = vi.fn();
    const transport = startStateControlsTransport({ invoke, complete: vi.fn(), payload: () => payload(busy), onAction });
    transport.accept('{"type":"select","id":"state-memory"}');
    transport.accept('{"type":"changeBehavior","id":"control-creativity","value":0.73}');
    busy = true;
    transport.accept('{"type":"changeBehavior","id":"control-creativity","value":0.9}');
    transport.accept('{"type":"changeBehavior","id":"control-autonomy","value":0.9}');
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("espera una lectura anterior al reconfigurar sin perder la nueva solicitud", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValueOnce("new");
    const complete = vi.fn();
    const transport = startStateControlsTransport({ invoke, complete, payload, onAction: vi.fn() });
    transport.accept('{"scope":"activity","id":1}'); await flush();
    transport.accept('{"scope":"activity","id":2}');
    expect(invoke).toHaveBeenCalledTimes(1);
    resolve("old"); await flush();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls.map(call => call[0])).toEqual([
      { type: "activitySuccess", id: 1, value: "old" }, { type: "activitySuccess", id: 2, value: "new" },
    ]);
  });
});
