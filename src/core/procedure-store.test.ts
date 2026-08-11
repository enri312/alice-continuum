import { describe, expect, it } from "vitest";
import { parseProcedureCandidateStoreSnapshot, parseProcedureDraftConversionSnapshot, parseProcedurePatternDecisionResult } from "./procedure-store";

const fingerprint = `sha256:${"a".repeat(64)}`;
const candidateSha256 = `sha256:${"b".repeat(64)}`;

function retainedDecision() {
  return {
    decisionId: "11111111-1111-4111-8111-111111111111",
    fingerprint,
    action: "retain",
    decidedAt: "2026-08-11T12:00:00Z",
    candidateId: "22222222-2222-4222-8222-222222222222",
    title: "Procedimiento observado",
    suggestedSkillId: "local.alice.procedure-a1",
    declaredRisk: "low",
    stepCount: 2,
    occurrenceCount: 3,
    candidateSha256,
    executionEnabled: false,
  };
}

describe("almacén separado de decisiones R5", () => {
  it("acepta una decisión retain cerrada y sin ejecución", () => {
    const parsed = parseProcedureCandidateStoreSnapshot({
      schemaVersion: 1,
      storagePath: "E:\\AliceData\\procedures\\candidate-decisions-v1.json",
      existed: true,
      decisions: [retainedDecision()],
      executionEnabled: false,
      skillDraftCreated: false,
    });
    expect(parsed.decisions[0].candidateSha256).toBe(candidateSha256);
    expect(parsed.executionEnabled).toBe(false);
    expect(parsed.skillDraftCreated).toBe(false);
  });

  it("acepta dismiss sólo cuando no filtra metadatos del candidato", () => {
    const dismissed = { ...retainedDecision(), action: "dismiss", candidateId: null, title: null, suggestedSkillId: null, declaredRisk: null, stepCount: 0, occurrenceCount: 0, candidateSha256: null };
    const parsed = parseProcedurePatternDecisionResult({
      operationId: "33333333-3333-4333-8333-333333333333",
      decision: dismissed,
      storagePath: "E:\\AliceData\\procedures\\candidate-decisions-v1.json",
      executionEnabled: false,
      skillDraftCreated: false,
    });
    expect(parsed.decision.action).toBe("dismiss");
    expect(parsed.decision.title).toBeNull();
  });

  it("rechaza campos desconocidos, ejecución o decisiones duplicadas", () => {
    expect(() => parseProcedureCandidateStoreSnapshot({ schemaVersion: 1, storagePath: "x", existed: false, decisions: [], executionEnabled: true, skillDraftCreated: false })).toThrow(/política/i);
    expect(() => parseProcedureCandidateStoreSnapshot({ schemaVersion: 1, storagePath: "x", existed: true, decisions: [retainedDecision(), retainedDecision()], executionEnabled: false, skillDraftCreated: false })).toThrow(/repetidas/i);
    expect(() => parseProcedureCandidateStoreSnapshot({ schemaVersion: 1, storagePath: "x", existed: false, decisions: [], executionEnabled: false, skillDraftCreated: false, hidden: true })).toThrow(/desconocidos/i);
  });

  it("valida conversiones R5→R4 sin aprobación ni ejecución", () => {
    const parsed = parseProcedureDraftConversionSnapshot({
      schemaVersion: 1,
      conversions: [{
        fingerprint,
        decisionId: "11111111-1111-4111-8111-111111111111",
        candidateId: "22222222-2222-4222-8222-222222222222",
        candidateSha256,
        skillId: "local.alice.procedure-a1",
        revisionId: "33333333-3333-4333-8333-333333333333",
        draftSha256: "c".repeat(64),
        updatedAt: "2026-08-11T14:00:00Z",
        executionEnabled: false,
        approved: false,
      }],
      executionEnabled: false,
      automaticApproval: false,
    });
    expect(parsed.conversions[0].skillId).toBe("local.alice.procedure-a1");
    expect(() => parseProcedureDraftConversionSnapshot({ ...parsed, automaticApproval: true })).toThrow(/no admitido/i);
  });
});
