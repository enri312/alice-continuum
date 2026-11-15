import { describe, expect, it } from "vitest";
import { buildCognitiveMemoryNodes } from "../memory/cognitive-memory";
import type { CognitiveMemoryNode } from "../memory/cognitive-memory";
import { buildVolumeLearningSnapshot, createVolumeLearningCheckpoint, diffVolumeLearningCheckpoints, volumeLearningScale } from "./volume-learning";
import { selfStudyForCognitiveVolume, type SelfStudySnapshot } from "../memory/self-study";

const checkpoint = createVolumeLearningCheckpoint;

function record(id: string, content = "Contenido comprobable"): CognitiveMemoryNode {
  return buildCognitiveMemoryNodes([{ id, intention: `Registro ${id}`, summary: content, memoryType: "semantic", memoryStatus: "confirmed", source: "Fuente original" }])[0];
}

describe("evolución observable de conocimiento en el volumen", () => {
  it("muestra cero estructura sin inventar un historial anterior", () => {
    expect(buildVolumeLearningSnapshot([])).toEqual({
      total: 0,
      byOrigin: { study: 0, automatic: 0, profile: 0, record: 0 },
      byLayer: { episodic: 0, semantic: 0, procedural: 0, preference: 0, self: 0, unclassified: 0 },
    });
    expect(diffVolumeLearningCheckpoints(null, checkpoint([record("existing")]))).toEqual({ addedIds: [], changedIds: [], removedIds: [] });
  });

  it("separa origen y capa sin confundir autoestudio, perfil y registros personales", () => {
    const nodes = buildCognitiveMemoryNodes([
      { id: "study", intention: "Lección", studyLearning: true, memoryType: "semantic" },
      { id: "automatic", intention: "Preferencia", automaticLearning: true, memoryType: "preference" },
      { id: "profile", intention: "Perfil", kind: "Perfil", memoryStatus: "confirmed" },
      { id: "episode", intention: "Experiencia", memoryType: "episodic" },
      { id: "procedure", intention: "Procedimiento", memoryType: "procedural" },
      { id: "unclassified", intention: "Registro heredado" },
    ]);
    expect(buildVolumeLearningSnapshot(nodes)).toEqual({
      total: 6,
      byOrigin: { study: 1, automatic: 1, profile: 1, record: 3 },
      byLayer: { episodic: 1, semantic: 1, procedural: 1, preference: 1, self: 1, unclassified: 1 },
    });
  });

  it("distingue altas, correcciones y retiros posteriores a la línea base", () => {
    const before = checkpoint([record("old"), record("corrected"), record("kept")]);
    const after = checkpoint([record("new"), record("corrected", "Corrección con evidencia"), record("kept")]);
    expect(diffVolumeLearningCheckpoints(before, after)).toEqual({
      addedIds: ["new"], changedIds: ["corrected"], removedIds: ["old"],
    });
    expect(buildVolumeLearningSnapshot([record("corrected", "Corrección con evidencia")]).total).toBe(1);
  });

  it("recuperar un recuerdo, mover la cámara o incrementar repasos no crea evolución de conocimiento", () => {
    const before = record("same");
    const after = {
      ...before, retrieved: true, x: before.x + 1, y: before.y - 1, z: before.z + .2,
      successfulRecalls: 12, successfulReviews: 5, storageStrength: .9,
      recordedAt: "2026-11-11T14:00:00Z", recordedAtKind: "session" as const,
    };
    expect(diffVolumeLearningCheckpoints(checkpoint([before]), checkpoint([after]))).toEqual({ addedIds: [], changedIds: [], removedIds: [] });
  });

  it("no presenta el último repaso de una lección como otro aprendizaje o nacimiento", () => {
    const study = (date: string) => buildCognitiveMemoryNodes([{
      id: "study:fractions", intention: "Fracciones equivalentes", summary: "La misma lección curada.",
      studyLearning: true, memoryType: "semantic", finishedAt: date,
      source: `OpenStax · https://example.com/math · sha256:abc · estudiado ${date}`,
    }])[0];
    const before = study("2026-11-10T10:00:00Z"), after = study("2026-11-11T11:30:00.123Z");
    expect(before.recordedAt).not.toBe(after.recordedAt);
    expect(diffVolumeLearningCheckpoints(checkpoint([before]), checkpoint([after]))).toEqual({ addedIds: [], changedIds: [], removedIds: [] });
  });

  it("ignora la fecha técnica de revisión automática pero conserva una corrección del contenido", () => {
    const automatic = (date: string, summary = "Declaración conservada") => buildCognitiveMemoryNodes([{
      id: "automatic", intention: "Declaración", summary, automaticLearning: true, memoryType: "semantic",
      startedAt: "2026-11-10T10:00:00Z",
      source: `Selección automática de Alice · declaración literal de Carlos · ${date} · intercambio abc123`,
    }])[0];
    const before = checkpoint([automatic("2026-11-10T10:00:00Z")]);
    expect(diffVolumeLearningCheckpoints(before, checkpoint([automatic("2026-11-11T11:00:00Z")])).changedIds).toEqual([]);
    expect(diffVolumeLearningCheckpoints(before, checkpoint([automatic("2026-11-11T11:00:00Z", "Declaración corregida")])).changedIds).toEqual(["automatic"]);
  });

  it.each([
    (node: CognitiveMemoryNode) => ({ ...node, version: 2 }),
    (node: CognitiveMemoryNode) => ({ ...node, status: "conflict" as const }),
    (node: CognitiveMemoryNode) => ({ ...node, source: "Otra fuente comprobable" }),
    (node: CognitiveMemoryNode) => ({ ...node, archived: true }),
    (node: CognitiveMemoryNode) => ({ ...node, suppressed: true }),
  ])("registra cambios de versión, estado y procedencia como actualización del mismo nodo", change => {
    const node = record("updated");
    expect(diffVolumeLearningCheckpoints(checkpoint([node]), checkpoint([change(node)]))).toEqual({ addedIds: [], changedIds: ["updated"], removedIds: [] });
  });

  it("mantiene el orden de entrada independiente de la evolución y evita contar identidades duplicadas", () => {
    const first = record("a"), second = record("b");
    const duplicates = [first, { ...first, label: "Duplicado que no sustituye la primera fuente" }, second];
    expect(buildVolumeLearningSnapshot(duplicates).total).toBe(2);
    expect(checkpoint(duplicates)).toEqual(checkpoint([first, second]));
    expect(diffVolumeLearningCheckpoints(checkpoint([first, second]), checkpoint([second, first]))).toEqual({ addedIds: [], changedIds: [], removedIds: [] });
  });

  it("no copia contenido ni etiquetas al checkpoint y no modifica los nodos originales", () => {
    const nodes = [record("private-id", "Contenido privado de la memoria")];
    const original = structuredClone(nodes);
    const result = checkpoint(nodes);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).toEqual(["private-id"]);
    expect(result["private-id"]).toMatch(/^visual-v1:\d+:[0-9a-f]{16}$/);
    expect(JSON.stringify(result)).not.toContain("Contenido privado");
    expect(JSON.stringify(result)).not.toContain("Registro private-id");
    expect(nodes).toEqual(original);
  });

  it("trata nombres especiales como identidades de datos, sin heredar propiedades como registros", () => {
    const special = checkpoint([record("__proto__"), record("constructor")]);
    expect(Object.keys(special).sort()).toEqual(["__proto__", "constructor"]);
    expect(diffVolumeLearningCheckpoints(checkpoint([]), special)).toEqual({ addedIds: ["__proto__", "constructor"], changedIds: [], removedIds: [] });
    expect({}.toString).toBe(Object.prototype.toString);
  });

  it("el resultado de estudio modifica el nodo existente y conserva su volumen al fallar o retirarse", () => {
    const snapshot: SelfStudySnapshot = {
      schemaVersion: 1, enabled: true, biblicalTradition: "catholic", phase: "partial",
      lastStartedAt: null, lastCompletedAt: null, lastError: null,
      records: [{
        id: "study:fractions", lessonId: "fractions", track: "arithmetic", domain: "mathematics", title: "Fracciones",
        content: "Lección curada", sourceTitle: "Fuente", sourceUrl: "https://example.org/math", lessonSha256: `sha256:${"a".repeat(64)}`,
        studiedAt: "2026-11-10T10:00:00Z", attempts: 1, passes: 0, lastPassed: false, active: true,
      }],
    };
    const project = (value: SelfStudySnapshot) => buildCognitiveMemoryNodes(selfStudyForCognitiveVolume(value));
    const pending = project(snapshot);
    const approvedSnapshot = { ...snapshot, records: snapshot.records.map(study => ({ ...study, attempts: 2, passes: 1, lastPassed: true })) };
    const approved = project(approvedSnapshot);
    const reviewed = project({ ...approvedSnapshot, records: approvedSnapshot.records.map(study => ({ ...study, attempts: 3, lastPassed: false })) });
    const withdrawn = project({ ...approvedSnapshot, records: approvedSnapshot.records.map(study => ({ ...study, active: false })) });
    for (const [before, after] of [[pending, approved], [approved, reviewed], [approved, withdrawn]]) {
      expect(buildVolumeLearningSnapshot(before).total).toBe(1);
      expect(buildVolumeLearningSnapshot(after).total).toBe(1);
      expect(diffVolumeLearningCheckpoints(checkpoint(before), checkpoint(after))).toEqual({ addedIds: [], changedIds: ["study:fractions"], removedIds: [] });
      expect(volumeLearningScale(before.length)).toBe(volumeLearningScale(after.length));
    }
    const repassed = project({ ...approvedSnapshot, records: approvedSnapshot.records.map(study => ({ ...study, attempts: 4, passes: 3, studiedAt: "2026-11-11T10:00:00Z" })) });
    expect(diffVolumeLearningCheckpoints(checkpoint(approved), checkpoint(repassed))).toEqual({ addedIds: [], changedIds: [], removedIds: [] });
  });

  it("la escala visual crece lentamente con registros reales, permanece acotada y no usa los repasos", () => {
    const counts = [0, 1, 5, 42, 180, 1_000, 100_000, Number.MAX_SAFE_INTEGER];
    const scales = counts.map(volumeLearningScale);
    expect(scales[0]).toBe(.76);
    expect(scales.every(scale => scale >= .76 && scale <= 1)).toBe(true);
    expect(scales.every((scale, index) => index === 0 || scale >= scales[index - 1])).toBe(true);
    expect(scales[1] - scales[0]).toBeLessThan(.005);
    expect(volumeLearningScale(42)).toBeLessThan(.85);
    expect(volumeLearningScale(100_000)).toBeGreaterThan(.99);
    for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(volumeLearningScale(count)).toBe(.76);
  });
});
