import { describe, expect, it } from "vitest";
import { isLegacyMemoryDiscardable } from "./memory-discard";

describe("legacy memory discard policy", () => {
  it("allows only a record that never entered durable governance", () => {
    expect(isLegacyMemoryDiscardable({})).toBe(true);
    expect(isLegacyMemoryDiscardable({ memoryStatus: null, memoryVersion: null })).toBe(true);
  });

  it.each([
    { memoryStatus: "confirmed" },
    { memoryStatus: "conflict" },
    { memoryVersion: 1 },
    { archiveStatus: "archived" },
    { deletionStatus: "scheduled" },
  ])("rejects durable state %#", (memory) => {
    expect(isLegacyMemoryDiscardable(memory)).toBe(false);
  });

  it("rejects a missing record", () => {
    expect(isLegacyMemoryDiscardable(null)).toBe(false);
    expect(isLegacyMemoryDiscardable(undefined)).toBe(false);
  });
});
