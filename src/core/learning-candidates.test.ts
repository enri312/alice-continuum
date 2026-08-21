import { describe, expect, it } from "vitest";
import { parseLearningCandidatePreview } from "./learning-candidates";

const valid = {
  sourceRecordId: "record-1",
  sourceTitle: "Proyecto Alice",
  sourceSha256: `sha256:${"a".repeat(64)}`,
  model: "qwen3.5:4b",
  inputTokens: 120,
  outputTokens: 40,
  persisted: false,
  candidates: [{
    candidateId: `sha256:${"b".repeat(64)}`,
    candidateKind: "fact",
    memoryType: "semantic",
    intention: "Tecnología",
    summary: "Alice usa TypeScript.",
    evidence: "usa TypeScript",
    confidence: 0.9,
  }],
};

describe("learning candidate preview", () => {
  it("accepts a bounded read-only preview", () => {
    expect(parseLearningCandidatePreview(valid)).toEqual(valid);
  });

  it("rejects an automatically persisted result", () => {
    expect(() => parseLearningCandidatePreview({ ...valid, persisted: true })).toThrow();
  });

  it("rejects unknown candidate kinds and excessive output", () => {
    expect(() => parseLearningCandidatePreview({ ...valid, candidates: [{ ...valid.candidates[0], candidateKind: "personality" }] })).toThrow();
    expect(() => parseLearningCandidatePreview({ ...valid, candidates: Array.from({ length: 5 }, () => valid.candidates[0]) })).toThrow();
  });
});
