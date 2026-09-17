import { describe, expect, it } from "vitest";
import { parseFaceReadinessStatus } from "./face-readiness";

const valid = {
  schemaVersion: 1,
  capabilityId: "perception.face.landmarks",
  model: {
    fileName: "face_landmarker_float16_v1.task",
    state: "verified",
    sizeBytes: 3758596,
    sha256: "A".repeat(64),
    detail: "Modelo verificado sin abrir cámara.",
  },
  runtime: { available: true, detail: "Python local disponible." },
  sensorOpened: false,
};

describe("face readiness contract", () => {
  it("acepta preparación local verificable sin señal de cámara", () => {
    expect(parseFaceReadinessStatus(valid)).toEqual(valid);
  });

  it("rechaza que una comprobación pasiva declare un sensor abierto", () => {
    expect(() => parseFaceReadinessStatus({ ...valid, sensorOpened: true })).toThrow(/no puede abrir un sensor/);
  });

  it("rechaza huellas o campos no reconocidos", () => {
    expect(() => parseFaceReadinessStatus({ ...valid, model: { ...valid.model, sha256: "wrong" } })).toThrow(/sha256/);
    expect(() => parseFaceReadinessStatus({ ...valid, unexpected: true })).toThrow(/campos desconocidos/);
  });
});
