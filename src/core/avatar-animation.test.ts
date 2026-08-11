import { describe, expect, it } from "vitest";
import { advanceFootLockOffset, computeLocomotionWeights, footGroundCorrection, selectAvatarAnimation } from "./avatar-animation";

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
    expect(weights.run).toBe(0);
    expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
  });

  it("funde la marcha hacia carrera sólo al empujar hacia delante", () => {
    const walking = computeLocomotionWeights(0, -0.5);
    const running = computeLocomotionWeights(0, -1);
    const backward = computeLocomotionWeights(0, 1);
    expect(walking.run).toBe(0);
    expect(running.run).toBe(1);
    expect(running.forward).toBe(0);
    expect(backward.run).toBe(0);
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

  it("limita el bloqueo horizontal y lo libera suavemente sin contacto", () => {
    const locked = advanceFootLockOffset({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.05, true);
    expect(locked.x).toBeCloseTo(0.065, 8);
    const released = advanceFootLockOffset(locked, { x: 0, z: 0 }, 0.05, false);
    expect(released.x).toBeGreaterThan(0);
    expect(released.x).toBeLessThan(locked.x);
  });
});
