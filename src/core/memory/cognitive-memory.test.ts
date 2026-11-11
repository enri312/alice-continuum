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

  it("distingue una espera de eliminación sin inventar que el nodo desapareció", () => {
    const [node] = buildCognitiveMemoryNodes([{ id: "scheduled", intention: "Recuerdo en espera", memoryStatus: "confirmed", archiveStatus: "archived", deletionStatus: "scheduled" }]);
    expect(node).toMatchObject({ archived: true, deletionScheduled: true, retrieved: false });
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

  it("muestra el autoestudio con su fuente sin atribuir confirmación al propietario", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "study:arithmetic-01", kind: "Autoestudio", studyLearning: true, studyPasses: 1, studyState: "available",
      intention: "Fracciones equivalentes", summary: "Una fracción mantiene su valor al multiplicar numerador y denominador por el mismo número distinto de cero.",
      memoryType: "semantic", source: "OpenStax · lección con comprensión comprobada",
    }]);
    expect(node).toMatchObject({ layer: "semantic", status: "learned", source: "OpenStax · lección con comprensión comprobada" });
  });

  it("identifica la fecha de estudio como último estudio y nunca como nacimiento del nodo", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "study", intention: "Lección", studyLearning: true,
      startedAt: "2026-11-10T10:00:00Z", finishedAt: "2026-11-11T14:30:00.123Z",
    }]);
    expect(node).toMatchObject({ origin: "study", recordedAt: "2026-11-11T14:30:00.123Z", recordedAtKind: "study" });
  });

  it("conserva la creación declarada de un recuerdo automático aunque su revisión sea posterior", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "automatic", intention: "Declaración", automaticLearning: true,
      startedAt: "2026-11-10T10:00:00-03:00", finishedAt: "2026-11-11T14:30:00Z",
    }]);
    expect(node).toMatchObject({ origin: "automatic", recordedAt: "2026-11-10T10:00:00-03:00", recordedAtKind: "created" });
  });

  it("no fabrica fecha de creación para el perfil a partir de una fecha de sesión", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "profile", intention: "Dato de perfil", kind: "Perfil", startedAt: "2026-11-10T10:00:00Z",
    }]);
    expect(node).toMatchObject({ origin: "profile", recordedAt: null, recordedAtKind: null, layer: "self" });
  });

  it("usa una fecha de sesión válida y permite recuperar el inicio si el cierre no está disponible", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "finished", intention: "Sesión terminada", startedAt: "2026-11-10T10:00:00Z", finishedAt: "2026-11-10T11:00:00Z" },
      { id: "started", intention: "Sesión", startedAt: "2026-11-10T10:00:00Z", finishedAt: "inválida" },
    ]);
    expect(nodes.map(node => [node.origin, node.recordedAt, node.recordedAtKind])).toEqual([
      ["record", "2026-11-10T11:00:00Z", "session"], ["record", "2026-11-10T10:00:00Z", "session"],
    ]);
  });

  it.each(["mañana", "11/11/2026", "2026-11-11", "2026-02-30T10:00:00Z", "2026-11-11T25:00:00Z", "2026-11-11T10:00:00+25:00"])("deja sin fecha los valores que no son marcas ISO válidas: %s", date => {
    const [node] = buildCognitiveMemoryNodes([{ id: "invalid", intention: "Sin fecha verificable", finishedAt: date }]);
    expect(node).toMatchObject({ origin: "record", recordedAt: null, recordedAtKind: null });
  });

  it("no adivina creación automática ni fecha de estudio a partir de otra marca temporal", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "study", intention: "Lección", studyLearning: true, startedAt: "2026-11-10T10:00:00Z" },
      { id: "automatic", intention: "Declaración", automaticLearning: true, finishedAt: "2026-11-10T10:00:00Z" },
    ]);
    expect(nodes.map(node => [node.origin, node.recordedAt, node.recordedAtKind])).toEqual([
      ["study", null, null], ["automatic", null, null],
    ]);
  });

  it("conserva el intento sin aprobación como registro histórico y no como aprendizaje demostrado", () => {
    const [node] = buildCognitiveMemoryNodes([{
      id: "study:pending", intention: "Ejercicio pendiente", studyLearning: true, studyPasses: 0, studyState: "review",
    }], ["study:pending"]);
    expect(node).toMatchObject({ origin: "study", studyState: "review", studyPasses: 0, status: "historical", retrieved: false, accessibility: "notAssessed", archived: false });
  });

  it("no activa recuperación de un estudio en revisión o retirado aunque existan aprobaciones anteriores", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "available", intention: "Disponible", studyLearning: true, studyState: "available", studyPasses: 1 },
      { id: "review", intention: "Requiere repaso", studyLearning: true, studyState: "review", studyPasses: 1 },
      { id: "withdrawn", intention: "Retirado", studyLearning: true, studyState: "withdrawn", studyPasses: 2 },
    ], ["available", "review", "withdrawn"]);
    expect(nodes.map(node => [node.id, node.retrieved, node.status])).toEqual([
      ["available", true, "learned"], ["review", false, "learned"], ["withdrawn", false, "learned"],
    ]);
    expect(nodes.every(node => node.accessibility === "notAssessed" && !node.archived)).toBe(true);
  });

  it("conserva el contrato antiguo aprobado pero rechaza un estado disponible explícito sin aprobaciones", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "unknown", intention: "Sin resultado", studyLearning: true },
      { id: "inconsistent", intention: "Sin aprobación", studyLearning: true, studyState: "available", studyPasses: 0 },
    ], ["unknown", "inconsistent"]);
    expect(nodes.map(node => [node.studyState, node.studyPasses, node.status, node.retrieved])).toEqual([
      ["available", null, "learned", true], ["review", 0, "historical", false],
    ]);
  });
});
