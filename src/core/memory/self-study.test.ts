import { describe, expect, it } from "vitest";
import { parseSelfStudySnapshot, selfStudyForConversation, type SelfStudyRecord, type SelfStudySnapshot } from "./self-study";
import { retrieveMemories } from "./memory-retrieval";
import { selectReinforceableMemoryIds } from "./memory-consolidation";
import { buildCloudPayload } from "../conversation/cloud-payload";

const record: SelfStudyRecord = {
  id: "study:arithmetic-fractions", lessonId: "arithmetic-fractions", domain: "mathematics", track: "arithmetic",
  title: "Fracciones equivalentes", content: "Multiplicar numerador y denominador por el mismo número distinto de cero conserva la fracción.",
  sourceUrl: "https://example.org/mathematics/fractions", sourceTitle: "Fuente sintética de matemáticas",
  lessonSha256: `sha256:${"a".repeat(64)}`, studiedAt: "2026-11-10T12:00:00Z", attempts: 2, passes: 1, lastPassed: true, active: true,
};
const snapshot: SelfStudySnapshot = {
  schemaVersion: 1, enabled: true, biblicalTradition: "catholic", phase: "partial",
  lastStartedAt: record.studiedAt, lastCompletedAt: null, lastError: null, records: [record],
};

describe("autoestudio separado y recuperable", () => {
  it("recupera una lección con fuente sin atribuirla al propietario ni reforzar registros canónicos", () => {
    const memories = selfStudyForConversation(parseSelfStudySnapshot(snapshot));
    const selected = retrieveMemories("Explícame las fracciones equivalentes", memories, 3).map(match => match.memory);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ kind: "Autoestudio", studyLearning: true, summary: record.content });
    expect(selected[0]).not.toHaveProperty("memoryStatus");
    expect(selected[0]).not.toHaveProperty("automaticLearning");
    expect(selectReinforceableMemoryIds(selected)).toEqual([]);
    const payload = buildCloudPayload({ draft: "Explícame las fracciones", includeMemory: true, memories: selected, includeHistory: false, recentHistory: [], includeWindow: false, observationEnabled: false, foregroundContext: null });
    expect(payload).toContain("AUTOESTUDIO · FUENTE CURADA");
    expect(payload).toContain("NO DECLARACIÓN DEL PROPIETARIO");
    expect(payload).toContain(record.sourceUrl);
    expect(payload).toContain(record.lessonSha256);
    expect(payload).not.toContain("HECHO ENSEÑADO Y CONFIRMADO");
    expect(payload).not.toContain("Carlos declaró");
  });

  it("excluye retirada y último ejercicio fallido aunque existan aprobaciones anteriores", () => {
    const failed = { ...record, lastPassed: false, attempts: 3 };
    expect(selfStudyForConversation({ ...snapshot, records: [failed] })).toEqual([]);
    expect(selfStudyForConversation({ ...snapshot, records: [{ ...record, active: false }] })).toEqual([]);
    expect(selfStudyForConversation({ ...snapshot, records: [{ ...record, passes: 0, lastPassed: false }] })).toEqual([]);
    expect(selfStudyForConversation(null)).toEqual([]);
    expect(snapshot.records).toEqual([record]);
  });

  it("mantiene disponibles las lecciones aprobadas al pausar futuros ciclos", () => {
    expect(selfStudyForConversation(parseSelfStudySnapshot({ ...snapshot, enabled: false, phase: "disabled" }))).toHaveLength(1);
  });

  it.each([
    { ...record, domain: "medicine" }, { ...record, track: "programming" },
    { ...record, track: "humility", domain: "mathematics" }, { ...record, id: "canonical-owner-memory" },
    { ...record, passes: 3 }, { ...record, passes: 0 }, { ...record, attempts: -1 },
    { ...record, sourceUrl: "javascript:alert(1)" }, { ...record, sourceUrl: "https://user:secret@example.org" },
    { ...record, studiedAt: "invalid-date" }, { ...record, lessonSha256: "invented" },
    { ...record, ownerReviewed: true },
  ])("rechaza materia, procedencia o resultados inválidos antes de recuperar", invalid => {
    expect(() => parseSelfStudySnapshot({ ...snapshot, records: [invalid] })).toThrow();
  });

  it("rechaza duplicados, campos extra y otra tradición bíblica", () => {
    expect(() => parseSelfStudySnapshot({ ...snapshot, records: [record, record] })).toThrow();
    expect(() => parseSelfStudySnapshot({ ...snapshot, autoExecute: true })).toThrow();
    expect(() => parseSelfStudySnapshot({ ...snapshot, biblicalTradition: "other" })).toThrow();
  });
});
