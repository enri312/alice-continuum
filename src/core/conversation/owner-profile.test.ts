import { describe, expect, it } from "vitest";
import { parseOwnerProfileSnapshot } from "./owner-profile";

describe("owner profile contract", () => {
  it("accepts confirmed, traceable local knowledge", () => {
    const snapshot = parseOwnerProfileSnapshot({
      state: "available",
      storagePath: "E:\\Alice Cognitive Core\\data\\memory\\owner-profile.json",
      ownerName: "Carlos",
      confirmedBy: "Carlos",
      confirmedAt: "2026-08-17T21:30:00-03:00",
      sourceFiles: [{ file: "source.md", sha256: `sha256:${"a".repeat(64)}` }],
      records: [{ id: "owner.identity", kind: "Perfil", intention: "Identidad", summary: "Carlos", source: "source.md", memoryStatus: "confirmed" }],
    });
    expect(snapshot.state).toBe("available");
    expect(snapshot.records).toHaveLength(1);
  });

  it("rejects records that are not explicitly confirmed", () => {
    expect(() => parseOwnerProfileSnapshot({
      state: "available",
      storagePath: "profile.json",
      ownerName: "Carlos",
      confirmedBy: "Carlos",
      confirmedAt: "2026-08-17T21:30:00-03:00",
      sourceFiles: [{ file: "source.md", sha256: `sha256:${"b".repeat(64)}` }],
      records: [{ id: "owner.identity", kind: "Perfil", intention: "Identidad", summary: "Carlos", source: "source.md", memoryStatus: "draft" }],
    })).toThrow("Recuerdo de perfil inválido");
  });
});
