import { describe, expect, it } from "vitest";
import { beginMemoryRetrieval, completeMemoryRetrieval, emptyMemoryRetrieval, failMemoryRetrieval, observePreparedMemory, prepareMemoryRetrieval, projectMemoryRetrieval } from "./retrieval-observation";

const episode = { id: "episode-1", kind: "Conversación", intention: "Quiero practicar fracciones", summary: "Una respuesta antigua del modelo", source: "Conversación local", memoryStatus: "confirmed" as const };
const prepared = () => prepareMemoryRetrieval([{ memory: episode, score: 7.425 }], "lexical");

describe("observación efímera de recuperación", () => {
  it("no arrastra recuerdos desautorizados ni pierde el resultado de un envío sin contexto al recalcular el mismo borrador", () => {
    const previous = prepared();
    const sent = beginMemoryRetrieval(previous, "pausa Spotify", false);
    expect(sent).toMatchObject({ phase: "sending", queryKey: "pausa Spotify", queryPresent: true, count: 0, references: [], ids: [] });
    expect(previous.references).toHaveLength(1);
    for (const receipt of [completeMemoryRetrieval(sent, "desktop:1", "none"), completeMemoryRetrieval(sent, "legacy:1"), failMemoryRetrieval(sent)]) {
      const recalculated = prepareMemoryRetrieval([], "lexical", true, "pausa Spotify");
      expect(observePreparedMemory(receipt, recalculated)).toBe(receipt);
      const cleared = observePreparedMemory(receipt, prepareMemoryRetrieval([], "lexical", false));
      expect(cleared).toEqual({ ...receipt, queryPresent: false });
      expect(observePreparedMemory(cleared, recalculated)).toBe(recalculated);
      expect(observePreparedMemory(receipt, prepareMemoryRetrieval([], "lexical", true, "otra consulta"))).not.toBe(receipt);
      expect(projectMemoryRetrieval(receipt, [episode]).top).toBeNull();
    }
  });
  it("distingue una coincidencia preparada de contexto proporcionado y conserva puntuación léxica sin normalizar", () => {
    expect(projectMemoryRetrieval(prepared(), [episode])).toMatchObject({ phase: "prepared", contextMode: null, count: 1,
      top: { id: episode.id, layer: "episodic", typeLabel: "EPISODIC", text: "USER: Quiero practicar fracciones → Alice", source: "Conversación local", origin: "record", score: 7.425, scoreKind: "lexical" } });
    const sent = beginMemoryRetrieval(prepared());
    const completed = completeMemoryRetrieval(sent, "response-1", "full");
    expect(projectMemoryRetrieval(completed, [episode])).toMatchObject({ phase: "responded", contextMode: "full", responseId: "response-1", count: 1 });
    expect(completed).not.toBe(sent);
  });

  it("congela el envío, conserva el último recibo al limpiar el borrador y lo sustituye al preparar otra consulta", () => {
    const sent = beginMemoryRetrieval(prepared());
    const anotherQuery = prepareMemoryRetrieval([], "lexical", true);
    expect(observePreparedMemory(sent, anotherQuery)).toBe(sent);
    const completed = completeMemoryRetrieval(sent, "response-1", "full");
    expect(observePreparedMemory(completed, prepareMemoryRetrieval([], "lexical", false))).toEqual({ ...completed, queryPresent: false });
    expect(observePreparedMemory(completed, anotherQuery)).toBe(anotherQuery);
    const same = prepared();
    expect(observePreparedMemory(same, prepared())).toBe(same);
    const reviewed = prepareMemoryRetrieval([{ memory: episode, score: 7 }], "lexical", true, "Fracciones");
    const receipt = completeMemoryRetrieval(beginMemoryRetrieval(reviewed), "response-2", "full");
    // Appending the response changes recent history and can rerank the same
    // draft before it is cleared. That effect must not erase its receipt.
    expect(observePreparedMemory(receipt, prepareMemoryRetrieval([{ memory: episode, score: 9 }], "lexical", true, "Fracciones"))).toBe(receipt);
    const cleared = observePreparedMemory(receipt, prepareMemoryRetrieval([], "lexical", false));
    expect(projectMemoryRetrieval(cleared, [episode])).toMatchObject({ phase: "responded", count: 1, contextMode: "full" });
    expect(observePreparedMemory(cleared, prepareMemoryRetrieval([{ memory: episode, score: 9 }], "lexical", true, "Fracciones"))).toMatchObject({ phase: "prepared", queryKey: "Fracciones" });
    expect(observePreparedMemory(receipt, prepareMemoryRetrieval([], "lexical", true, "Otra pregunta"))).not.toBe(receipt);
  });

  it("no acredita recuerdos para rutas sin RAG, fallos o respuestas antiguas sin recibo de contexto", () => {
    const sent = beginMemoryRetrieval(prepared());
    expect(projectMemoryRetrieval(completeMemoryRetrieval(sent, "desktop:1", "none"), [episode])).toMatchObject({ phase: "bypassed", contextMode: "none", count: 0, top: null });
    expect(projectMemoryRetrieval(completeMemoryRetrieval(sent, "legacy:1"), [episode])).toMatchObject({ phase: "responded", contextMode: null, count: 0, top: null });
    expect(projectMemoryRetrieval(emptyMemoryRetrieval("failed"), [episode])).toMatchObject({ phase: "failed", count: 0, top: null });
  });

  it("mantiene limitada la evidencia visual y distingue rango de puntuación", () => {
    const ranked = prepareMemoryRetrieval([{ memory: episode, rank: 2, score: 999 }], "rank");
    const result = projectMemoryRetrieval(completeMemoryRetrieval(beginMemoryRetrieval(ranked), "vision:1", "limited"), [episode]);
    expect(result).toMatchObject({ phase: "responded", contextMode: "limited", top: { score: 2, scoreKind: "rank" } });
    expect(projectMemoryRetrieval(prepareMemoryRetrieval([{ memory: episode, score: NaN }], "lexical"), [episode]).top).toMatchObject({ score: null, scoreKind: null });
  });

  it("revalida el registro por ID y contenido y no recupera referencias retiradas o cambiadas", () => {
    const observed = completeMemoryRetrieval(beginMemoryRetrieval(prepared()), "response-1", "full");
    for (const memories of [[], [{ ...episode, intention: "Contenido corregido" }], [{ ...episode, summary: "Corregido" }],
      [{ ...episode, memoryStatus: "conflict" as const }], [{ ...episode, memoryStatus: "archived" as const }],
      [{ ...episode, accessibilityStatus: "dormant" as const }], [{ ...episode, suppressionStatus: "suppressed" as const }],
      [{ ...episode, archiveStatus: "archived" as const }], [{ ...episode, deletionStatus: "scheduled" as const }]]) {
      expect(projectMemoryRetrieval(observed, memories)).toMatchObject({ count: 0, top: null, ids: [] });
    }
  });

  it("no transforma perfil o autoestudio en un episodio del usuario y retira lecciones no disponibles", () => {
    const study = { id: "study", intention: "Fracciones equivalentes", memoryType: "semantic" as const, studyLearning: true, studyState: "available" as const, studyPasses: 1, source: "Fuente curada" };
    const observation = prepareMemoryRetrieval([{ memory: study, score: 1 }], "lexical");
    expect(projectMemoryRetrieval(observation, [study]).top).toMatchObject({ layer: "semantic", typeLabel: "SEMANTIC", text: "Fracciones equivalentes", origin: "study" });
    expect(projectMemoryRetrieval(observation, [{ ...study, studyState: "withdrawn" }]).top).toBeNull();
    const profile = { id: "profile", kind: "Perfil", intention: "Preferencia confirmada", source: "Perfil revisado" };
    expect(projectMemoryRetrieval(prepareMemoryRetrieval([{ memory: profile }], null), [profile]).top).toMatchObject({ layer: "self", typeLabel: "PERFIL", origin: "profile", score: null });
  });
});
