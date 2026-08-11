import { describe, expect, it } from "vitest";
import { computeLocomotionWeights, footGroundCorrection, selectAvatarAnimation } from "./avatar-animation";

describe("avatar animation selection", () => {
  it("mantiene reposo dentro del umbral", () => {
    expect(selectAvatarAnimation(0, 0)).toBe("idle");
    expect(selectAvatarAnimation(0.04, -0.04)).toBe("idle");
  });

  it("elige los cuatro clips según el eje dominante", () => {
    expect(selectAvatarAnimation(0.2, -0.8)).toBe("forward");
    expect(selectAvatarAnimation(-0.2, 0.8)).toBe("backward");
    expect(selectAvatarAnimation(-0.9, -0.2)).toBe("left");
    expect(selectAvatarAnimation(0.9, 0.2)).toBe("right");
  });

  it("mezcla diagonales sin superar una suma de peso unitaria", () => {
    const weights = computeLocomotionWeights(0.5, -0.5);
    expect(weights.forward).toBeGreaterThan(0);
    expect(weights.right).toBeGreaterThan(0);
    expect(weights.left).toBe(0);
    expect(weights.backward).toBe(0);
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
  });

  it("usa un paso lateral moderado para evitar un giro rígido en el sitio", () => {
    const rightPivot = computeLocomotionWeights(0, 0, 1);
    expect(rightPivot.right).toBeCloseTo(0.38, 8);
    expect(rightPivot.idle).toBeCloseTo(0.62, 8);
  });

  it("corrige sólo la penetración del pie y limita la elevación", () => {
    expect(footGroundCorrection(0.01, 0.02, 0.01)).toBe(0);
    expect(footGroundCorrection(-0.02, 0.02, 0.01)).toBeCloseTo(0.03, 8);
    expect(footGroundCorrection(-1, 0, 0.01)).toBe(0.08);
    expect(footGroundCorrection(Number.NaN, 0, 0)).toBe(0);
  });
});
