import { describe, expect, it, vi } from "vitest";
import { startFlowPageTransport } from "./flow-page-transport";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("transporte de Flujo Dioxus", () => {
  it("sólo lee R3 por solicitud Rust, sin aceptar comandos ni lecturas duplicadas", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn(() => new Promise(done => { resolve = done; }));
    const complete = vi.fn();
    const transport = startFlowPageTransport({ invoke, complete, nodeIds: () => [], onSelect: vi.fn() });
    for (const raw of ['{', '{}', '{"scope":"activity","id":1,"command":"delete_memory"}', '{"scope":"activity","id":-1}', '{"scope":"other","id":1}']) transport.accept(raw);
    expect(invoke).not.toHaveBeenCalled();
    transport.accept('{"scope":"activity","id":1}'); transport.accept('{"scope":"activity","id":2}');
    await flush(); expect(invoke).toHaveBeenCalledExactlyOnceWith("core_activity_snapshot");
    resolve({ schemaVersion: 2 }); await flush();
    expect(complete).toHaveBeenLastCalledWith({ type: "activitySuccess", id: 1, value: { schemaVersion: 2 } });
    transport.accept('{"scope":"activity","id":1}'); await flush(); expect(invoke).toHaveBeenCalledTimes(1);
    transport.dispose();
  });
  it("comunica fallo para quitar la señal y permite la siguiente lectura explícita", async () => {
    const invoke = vi.fn().mockRejectedValueOnce(Error("sin señal")).mockResolvedValueOnce({ valid: "handled by Rust" });
    const complete = vi.fn(); const transport = startFlowPageTransport({ invoke, complete, nodeIds: () => [], onSelect: vi.fn() });
    transport.accept('{"scope":"activity","id":1}'); await flush();
    expect(complete).toHaveBeenLastCalledWith({ type: "activityFailure", id: 1 });
    transport.accept('{"scope":"activity","id":2}'); await flush(); expect(invoke).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenLastCalledWith({ type: "activitySuccess", id: 2, value: { valid: "handled by Rust" } });
    transport.dispose();
  });
  it("desmontar bloquea lecturas encoladas y descarta resultados de la sesión anterior", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn(() => new Promise(done => { resolve = done; }));
    const complete = vi.fn(); const transport = startFlowPageTransport({ invoke, complete, nodeIds: () => [], onSelect: vi.fn() });
    transport.accept('{"scope":"activity","id":1}'); await flush(); transport.dispose();
    resolve(null); await flush(); transport.accept('{"scope":"activity","id":2}');
    expect(complete).not.toHaveBeenCalled(); expect(invoke).toHaveBeenCalledTimes(1);
    const immediate = startFlowPageTransport({ invoke, complete, nodeIds: () => [], onSelect: vi.fn() });
    immediate.accept('{"scope":"activity","id":1}'); immediate.dispose(); await flush(); expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("separa selección y asociaciones de R3 y conserva el transporte cerrado existente", async () => {
    const invoke = vi.fn(async (command: string) => command);
    const complete = vi.fn(), onSelect = vi.fn(); let ids = ["flow-input"];
    const transport = startFlowPageTransport({ invoke, complete, nodeIds: () => ids, onSelect });
    transport.accept('{"scope":"selection","id":"flow-input"}'); ids = [];
    transport.accept('{"scope":"selection","id":"flow-input"}');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("flow-input"); expect(invoke).not.toHaveBeenCalled();
    transport.accept('{"scope":"associations","request":{"type":"refresh","id":1}}'); await flush();
    expect(invoke.mock.calls.map(call => call[0])).toEqual(["knowledge_graph_snapshot", "load_memory", "knowledge_graph_associations"]);
    expect(complete).toHaveBeenCalledWith({ type: "associations", response: { type: "success", id: 1, value: {
      graph: "knowledge_graph_snapshot", memory: "load_memory", relations: "knowledge_graph_associations",
    } } });
    transport.dispose();
  });
});
