import { describe, expect, it } from "vitest";
import { applyMemoryRetrieval, applyMemoryReview, buildReviewQueue, reviewIntervalDays, scheduleReview, selectReinforceableMemoryIds } from "./memory-consolidation";

const baseMemory = {
  id: "memory-1",
  intention: "Arquitectura de Alice",
  kind: "Enseñanza",
  finishedAt: "2026-08-01T12:00:00.000Z",
  importance: 3,
  storageStrength: .18,
  memoryStatus: "confirmed" as const,
  successfulRecalls: 0,
  failedRecalls: 0,
  lastRecalledAt: undefined as string | undefined,
  successfulReviews: 0,
  correctionCount: 0,
  lastReviewedAt: undefined as string | undefined,
};

describe("memory consolidation", () => {
  it("programa el primer repaso un día después", () => {
    const review = scheduleReview(baseMemory, new Date("2026-08-01T18:00:00.000Z"));
    expect(review?.due).toBe(false);
    expect(review?.daysUntilDue).toBe(1);
    expect(review?.dueAt).toBe("2026-08-02T12:00:00.000Z");
  });

  it("amplía el intervalo con confirmaciones verificadas", () => {
    expect(reviewIntervalDays({ ...baseMemory, successfulReviews: 0 })).toBe(1);
    expect(reviewIntervalDays({ ...baseMemory, successfulReviews: 1 })).toBe(3);
    expect(reviewIntervalDays({ ...baseMemory, successfulReviews: 3 })).toBe(14);
  });

  it("revisa antes los recuerdos importantes", () => {
    expect(reviewIntervalDays({ ...baseMemory, importance: 5, successfulReviews: 2 })).toBe(5);
    expect(reviewIntervalDays({ ...baseMemory, importance: 1, successfulReviews: 2 })).toBe(9);
  });

  it("mantiene en la cola inmediata un recuerdo conflictivo", () => {
    const review = scheduleReview({ ...baseMemory, memoryStatus: "conflict" }, new Date("2026-08-07T12:00:00.000Z"));
    expect(review?.due).toBe(true);
    expect(review?.intervalDays).toBe(0);
  });

  it("refuerza solamente después de una confirmación", () => {
    const reviewed = applyMemoryReview(baseMemory, "confirmed", new Date("2026-08-07T12:00:00.000Z"));
    expect(reviewed.storageStrength).toBe(.316);
    expect(reviewed.successfulReviews).toBe(1);
    expect(reviewed.memoryStatus).toBe("confirmed");
    expect(reviewed.lastReviewedAt).toBe("2026-08-07T12:00:00.000Z");
  });

  it("marca para corrección sin eliminar el recuerdo", () => {
    const reviewed = applyMemoryReview(baseMemory, "needs-correction", new Date("2026-08-07T12:00:00.000Z"));
    expect(reviewed.storageStrength).toBe(.06);
    expect(reviewed.correctionCount).toBe(1);
    expect(reviewed.memoryStatus).toBe("conflict");
  });

  it("ordena la cola por vencimiento y excluye archivados", () => {
    const queue = buildReviewQueue([
      { ...baseMemory, id: "later", finishedAt: "2026-08-05T12:00:00.000Z" },
      { ...baseMemory, id: "first", finishedAt: "2026-08-01T12:00:00.000Z" },
      { ...baseMemory, id: "archived", memoryStatus: "archived" as const },
    ], new Date("2026-08-07T12:00:00.000Z"));
    expect(queue.map((review) => review.memory.id)).toEqual(["first", "later"]);
  });

  it("refuerza una enseñanza recuperada después de una respuesta correcta", () => {
    const recalled = applyMemoryRetrieval(baseMemory, new Date("2026-08-08T10:00:00.000Z"));
    expect(recalled.storageStrength).toBe(.238);
    expect(recalled.successfulRecalls).toBe(1);
    expect(recalled.lastRecalledAt).toBe("2026-08-08T10:00:00.000Z");
    expect(recalled.successfulReviews).toBe(0);
  });

  it("no refuerza conversaciones ni enseñanzas conflictivas", () => {
    const conversation = { ...baseMemory, kind: "Conversación" };
    const conflict = { ...baseMemory, memoryStatus: "conflict" as const };
    expect(applyMemoryRetrieval(conversation)).toBe(conversation);
    expect(applyMemoryRetrieval(conflict)).toBe(conflict);
  });

  it("selecciona solamente identificadores de enseñanzas confirmadas", () => {
    expect(selectReinforceableMemoryIds([
      { id: "teaching", kind: "Enseñanza", memoryStatus: "confirmed" },
      { id: "conversation", kind: "Conversación", memoryStatus: "confirmed" },
      { id: "conflict", kind: "Enseñanza", memoryStatus: "conflict" },
      { kind: "Enseñanza", memoryStatus: "confirmed" },
      { id: "teaching", kind: "Enseñanza", memoryStatus: "confirmed" },
    ])).toEqual(["teaching"]);
  });
});
