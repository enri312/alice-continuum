import { describe, expect, it, vi } from "vitest";
import { parseAssociationsRequest, startAssociationsTransport } from "./associations-transport";

const evidence = ["a", "b"].map((id, index) => ({ recordId: id, recordVersion: index + 2, recordSha256: `sha256:${id.repeat(64)}`, quote: `Entrada ${id}` }));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("transporte del controlador Rust de asociaciones", () => {
  it("rechaza comandos libres, campos adicionales, evidencia y revisiones inválidas", () => {
    for (const value of [
      { type: "invoke", id: 1, command: "delete_memory" },
      { type: "refresh", id: 1, confirmed: true },
      { type: "create", id: 1, evidence, expectedRevision: -1 },
      { type: "create", id: 1, evidence: [evidence[0], evidence[0]], expectedRevision: 7 },
      { type: "preview", id: 1, evidence: [{ ...evidence[0], recordSha256: "bad" }, evidence[1]] },
      { type: "preview", id: 1, evidence: [{ ...evidence[0], recordSha256: "a".repeat(64) }, evidence[1]] },
      { type: "preview", id: 1, evidence: [{ ...evidence[0], quote: "😀".repeat(1025) }, evidence[1]] },
      { type: "change", id: 1, relationId: "r", withdrawn: true, expectedRevision: 7, confirmed: true },
      { type: "refresh", id: 0 },
    ]) expect(parseAssociationsRequest(JSON.stringify(value))).toBeNull();
  });

  it("carga las tres fuentes, limita cada solicitud a una ejecución y no repite escrituras", async () => {
    const invoke = vi.fn(async (command: string) => command);
    const complete = vi.fn();
    const transport = startAssociationsTransport(invoke, complete);
    const refresh = JSON.stringify({ type: "refresh", id: 1 });
    transport.accept(refresh); transport.accept(refresh);
    await flush();
    expect(invoke.mock.calls.map(call => call[0])).toEqual(["knowledge_graph_snapshot", "load_memory", "knowledge_graph_associations"]);
    expect(complete).toHaveBeenLastCalledWith({ type: "success", id: 1, value: {
      graph: "knowledge_graph_snapshot", memory: "load_memory", relations: "knowledge_graph_associations",
    } });
    const create = JSON.stringify({ type: "create", id: 2, evidence, expectedRevision: 7 });
    transport.accept(create); transport.accept(create);
    await flush(); transport.accept(create); await flush();
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(invoke).toHaveBeenLastCalledWith("confirm_knowledge_graph_association", { evidence, expectedRevision: 7, confirmed: true });
  });

  it("mantiene una operación en curso, comunica errores y nunca reintenta una escritura", async () => {
    let reject!: (error: Error) => void;
    const invoke = vi.fn(() => new Promise((_resolve, fail) => { reject = fail; }));
    const complete = vi.fn(); const transport = startAssociationsTransport(invoke, complete);
    const change = JSON.stringify({ type: "change", id: 1, relationId: "r", withdrawn: false, expectedRevision: 8 });
    transport.accept(change); await flush(); transport.accept(JSON.stringify({ type: "refresh", id: 2 }));
    expect(invoke).toHaveBeenCalledTimes(1);
    reject(Error("No se confirmó el guardado")); await flush();
    expect(complete).toHaveBeenCalledWith({ type: "failure", id: 1, error: "Error: No se confirmó el guardado" });
    transport.accept(change); await flush(); expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("al desmontar ignora respuestas tardías e impide nuevas solicitudes", async () => {
    let resolve!: (value: unknown) => void;
    const invoke = vi.fn(() => new Promise(done => { resolve = done; }));
    const complete = vi.fn(); const transport = startAssociationsTransport(invoke, complete);
    transport.accept(JSON.stringify({ type: "preview", id: 1, evidence })); await flush();
    transport.dispose(); resolve(null); await flush();
    transport.accept(JSON.stringify({ type: "refresh", id: 2 })); await flush();
    expect(complete).not.toHaveBeenCalled(); expect(invoke).toHaveBeenCalledTimes(1);
    const immediate = startAssociationsTransport(invoke, complete);
    immediate.accept(JSON.stringify({ type: "create", id: 1, evidence, expectedRevision: 7 }));
    immediate.dispose(); await flush(); expect(invoke).toHaveBeenCalledTimes(1);
  });
});
