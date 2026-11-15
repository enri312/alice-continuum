import { describe, expect, it } from "vitest";
import { parseLayeredMemorySnapshot } from "./layered-memory";

function validSnapshot() {
  return {
    schemaVersion: 2,
    state: "ready",
    storagePath: "E:\\Alice Cognitive Core\\data\\memory\\layer-index-v3.json",
    sourceSha256: `sha256:${"a".repeat(64)}`,
    activeRevisionId: null,
    revisionCount: 0,
    preview: {
      sourceSha256: `sha256:${"a".repeat(64)}`,
      recordCount: 10,
      workingCount: 0,
      episodicCount: 9,
      taughtFactCount: 0,
      proceduralCount: 1,
      unclassifiedCount: 0,
      proceduralPendingCount: 1,
      preferencePendingCount: 0,
      contentCopied: false,
      automaticClassification: false,
    },
    blockedReason: null,
    migrationRequiresConfirmation: true,
    automaticMigration: false,
    contentCopied: false,
  };
}

describe("contrato de memoria por capas R6.1", () => {
  it("acepta una vista previa cerrada y explicable", () => {
    const parsed = parseLayeredMemorySnapshot(validSnapshot());
    expect(parsed.state).toBe("ready");
    expect(parsed.preview?.episodicCount).toBe(9);
    expect(parsed.preview?.proceduralCount).toBe(1);
    expect(parsed.preview?.proceduralPendingCount).toBe(1);
  });

  it("rechaza contenido copiado, automatización y conteos incoherentes", () => {
    expect(() => parseLayeredMemorySnapshot({ ...validSnapshot(), contentCopied: true })).toThrow();
    const automatic = validSnapshot();
    automatic.preview.automaticClassification = true;
    expect(() => parseLayeredMemorySnapshot(automatic)).toThrow();
    const incoherent = validSnapshot();
    incoherent.preview.episodicCount = 8;
    expect(() => parseLayeredMemorySnapshot(incoherent)).toThrow();
  });

  it("exige revisión activa o razón de bloqueo según el estado", () => {
    expect(() => parseLayeredMemorySnapshot({ ...validSnapshot(), state: "active" })).toThrow();
    expect(() => parseLayeredMemorySnapshot({ ...validSnapshot(), state: "blocked" })).toThrow();
    const blocked = parseLayeredMemorySnapshot({ ...validSnapshot(), state: "blocked", blockedReason: "Índice inválido", preview: null });
    expect(blocked.blockedReason).toBe("Índice inválido");
  });
});
