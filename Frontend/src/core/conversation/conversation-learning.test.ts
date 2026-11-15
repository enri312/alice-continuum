import { describe, expect, it } from "vitest";
import { parseConversationLearningPreview } from "./conversation-learning";

const digest = `sha256:${"a".repeat(64)}`;

describe("propuesta de recuerdo desde conversación", () => {
  it("acepta una vista explícitamente no persistida y revisable", () => {
    const preview = parseConversationLearningPreview({
      exchangeId: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7",
      sourceSha256: digest,
      memorySha256: digest,
      model: "gemma-4-E2B-it-Q4_K_M",
      candidates: [{
        candidateId: digest,
        candidateKind: "preference",
        memoryType: "preference",
        intention: "Alegría por la confirmación humana",
        summary: "Se siente feliz al confirmar recuerdos.",
        evidence: "Estoy feliz de confirmar recuerdos.",
        confidence: 0.9,
        affects: [{ emotion: "joy", intensity: .8, evidence: "Estoy feliz" }],
      }],
      rejectedCandidateCount: 0,
      persisted: false,
      truthVerified: false,
      requiresOwnerReview: true,
    });
    expect(preview.candidates).toHaveLength(1);
    expect(preview.candidates[0].affects).toEqual([{ emotion: "joy", intensity: .8, evidence: "Estoy feliz" }]);
    expect(preview.persisted).toBe(false);
  });

  it("rechaza interpretación emocional cuya cita no pertenece a la evidencia revisada", () => {
    const value = {
      exchangeId: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7", sourceSha256: digest, memorySha256: digest,
      model: "gemma", rejectedCandidateCount: 0, persisted: false, truthVerified: false, requiresOwnerReview: true,
      candidates: [{ candidateId: digest, candidateKind: "experience", memoryType: "episodic", intention: "Un momento", summary: "Descripción", evidence: "Hoy terminé el proyecto.", confidence: .8, affects: [{ emotion: "joy", intensity: .7, evidence: "Estoy muy feliz" }] }],
    };
    expect(() => parseConversationLearningPreview(value)).toThrow("evidencia");
  });

  it("rechaza una vista que intente presentarse como verdad o escritura", () => {
    expect(() => parseConversationLearningPreview({
      exchangeId: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7",
      sourceSha256: digest,
      memorySha256: digest,
      model: "gemma",
      candidates: [],
      rejectedCandidateCount: 0,
      persisted: true,
      truthVerified: true,
      requiresOwnerReview: false,
    })).toThrow("garantías");
  });
});
