import { describe, expect, it } from "vitest";
import { buildCognitiveMemoryNodes, resolveCognitiveMemoryLayer, resolveCognitiveMemoryStatus } from "./cognitive-memory";

describe("proyección cognitiva de memoria real", () => {
  it("no crea nodos cuando no existen recuerdos", () => {
    expect(buildCognitiveMemoryNodes([])).toEqual([]);
  });

  it("conserva una identidad real por nodo y descarta entradas inválidas o duplicadas", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "memory-1", intention: "Primera experiencia", memoryType: "episodic" },
      { id: "memory-1", intention: "Duplicado", memoryType: "semantic" },
      { id: "", intention: "Sin identidad" },
      { id: "memory-2", intention: "   " },
    ]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: "memory-1", label: "Primera experiencia", layer: "episodic" });
  });

  it("separa capa, estado y fuerza sin convertirlos en una única métrica", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "owner-rule",
      kind: "Perfil",
      intention: "Regla del propietario",
      source: "Carlos",
      importance: 5,
      storageStrength: 0.37,
      memoryStatus: "confirmed",
      successfulRecalls: 3,
      successfulReviews: 2,
    }]);
    expect(node).toMatchObject({ layer: "self", status: "confirmed", accessibility: "notAssessed", source: "Carlos", importance: 5, storageStrength: 0.37, successfulRecalls: 3, successfulReviews: 2 });
  });

  it("conserva el nodo dormido pero no lo presenta como recuperación activa", () => {
    const [node] = buildCognitiveMemoryNodes([{ id: "dormant", intention: "Recuerdo en reposo", memoryStatus: "confirmed", accessibilityStatus: "dormant" }], ["dormant"]);
    expect(node).toMatchObject({ status: "confirmed", accessibility: "dormant", retrieved: false });
  });

  it("conserva visible un recuerdo suprimido sin presentarlo como recuperado", () => {
    const [node] = buildCognitiveMemoryNodes([{ id: "suppressed", intention: "Recuerdo suprimido", memoryStatus: "confirmed", suppressionStatus: "suppressed" }], ["suppressed"]);
    expect(node).toMatchObject({ status: "confirmed", suppressed: true, retrieved: false });
  });

  it("conserva visible un archivo reversible sin destruir su vigencia", () => {
    const [node] = buildCognitiveMemoryNodes([{ id: "archived-v2", intention: "Recuerdo archivado", memoryStatus: "confirmed", archiveStatus: "archived" }], ["archived-v2"]);
    expect(node).toMatchObject({ status: "confirmed", archived: true, retrieved: false });
  });

  it("proyecta la versión real sin inventar nodos históricos", () => {
    const [node] = buildCognitiveMemoryNodes([{ id: "versioned", intention: "Recuerdo actualizado", memoryStatus: "confirmed", memoryVersion: 3 }], []);
    expect(node).toMatchObject({ id: "versioned", version: 3, retrieved: false });
  });

  it("no presenta un conflicto o archivo como recuerdo recuperado", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "confirmed", intention: "Vigente", memoryStatus: "confirmed" },
      { id: "conflict", intention: "En conflicto", memoryStatus: "conflict" },
      { id: "archived", intention: "Archivado", memoryStatus: "archived" },
    ], ["confirmed", "conflict", "archived"]);
    expect(nodes.map((node) => [node.id, node.retrieved])).toEqual([["confirmed", true], ["conflict", false], ["archived", false]]);
  });

  it("produce coordenadas estables sin inventar asociaciones", () => {
    const memory = { id: "stable", intention: "Registro estable", memoryType: "procedural" as const };
    expect(buildCognitiveMemoryNodes([memory])).toEqual(buildCognitiveMemoryNodes([memory]));
    expect(Object.keys(buildCognitiveMemoryNodes([memory])[0])).not.toContain("edges");
  });

  it("mantiene los registros heredados como históricos y no los llama consolidados", () => {
    expect(resolveCognitiveMemoryStatus({ id: "legacy", intention: "Legado" })).toBe("historical");
    expect(resolveCognitiveMemoryLayer({ id: "chat", intention: "Diálogo", kind: "Conversación" })).toBe("episodic");
  });
});
