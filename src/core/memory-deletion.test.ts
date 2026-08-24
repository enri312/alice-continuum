import { describe, expect, it } from "vitest";
import { parseMemoryDeletionPreview, parseMemoryDeletionSchedulePreview } from "./memory-deletion";

const sha = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`;

describe("memory deletion contract", () => {
  it("accepts a seven-day, read-only scheduling preview", () => {
    const preview = parseMemoryDeletionSchedulePreview({
      schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-23T12:00:00Z",
      eligibleAt: "2026-08-30T12:00:00Z", recordId: "memory-1", action: "schedule",
      reason: "ownerRequest", noteSha256: sha("b"), sourceSha256: sha("c"),
      recordSha256Before: sha("d"), projectedRecordSha256: sha("e"),
      previousScheduled: false, projectedScheduled: true, waitSeconds: 604800,
      recordsModified: false, automaticAction: false,
    });
    expect(preview.waitSeconds).toBe(604800);
    expect(preview.projectedScheduled).toBe(true);
  });

  it("rejects a final preview that omits the mandatory safeguard", () => {
    expect(() => parseMemoryDeletionPreview({
      schemaVersion: 1, planId: sha("a"), plannedAt: "2026-08-30T12:00:00Z",
      recordId: "memory-1", reason: "ownerRequest", noteSha256: sha("b"),
      sourceSha256: sha("c"), recordSha256: sha("d"), requestedAt: "2026-08-23T12:00:00Z",
      eligibleAt: "2026-08-30T12:00:00Z", safeguardRequired: false,
      tombstoneContainsContent: false, recordsModified: false, automaticAction: false,
    })).toThrow(/resguardo|seguridad/i);
  });
});
