import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { advanceFootLockOffset, bakeFootLockOffset, computeLocomotionWeights, footGroundCorrection, locomotionCycleRate, selectAvatarAnimation, stripAccumulatedRootTranslation, stripAccumulatedRootYaw } from "./avatar-animation";

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
    expect(rightPivot.right).toBe(0);
    expect(rightPivot["turn-right"]).toBeCloseTo(0.38, 8);
    expect(rightPivot.idle).toBeCloseTo(0.62, 8);
  });

  it("separa giros en el sitio de los pasos laterales", () => {
    const leftPivot = computeLocomotionWeights(0, 0, -1);
    expect(leftPivot.left).toBe(0);
    expect(leftPivot["turn-left"]).toBeCloseTo(.38, 8);
    expect(leftPivot["turn-right"]).toBe(0);
  });

  it("calibra cada ciclo con la longitud de paso medida en sus FBX", () => {
    expect(locomotionCycleRate("forward", .68)).toBeCloseTo(.642, 3);
    expect(locomotionCycleRate("backward", .72)).toBeCloseTo(.787, 3);
    expect(locomotionCycleRate("left", .68)).toBeCloseTo(.582, 3);
    expect(locomotionCycleRate("right", .68)).toBeCloseTo(.582, 3);
    expect(locomotionCycleRate("run", 1)).toBe(1.25);
    expect(locomotionCycleRate("idle", 1)).toBe(.72);
    expect(locomotionCycleRate("turn-left", 1)).toBe(.85);
    expect(locomotionCycleRate("turn-right", 1)).toBe(.85);
  });

  it("sanea la magnitud usada para temporizar clips", () => {
    expect(locomotionCycleRate("forward", Number.NaN)).toBeCloseTo(.4125, 8);
    expect(locomotionCycleRate("forward", 10)).toBe(.75);
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

  it("incorpora la corrección terminada al movimiento raíz al cambiar de apoyo", () => {
    const motion = { x: 1.2, z: -.4, yaw: .25 };
    const baked = bakeFootLockOffset(motion, { x: -.06, z: .02 });
    expect(baked).toEqual({ x: 1.14, z: -.38, yaw: .25 });
    expect(motion).toEqual({ x: 1.2, z: -.4, yaw: .25 });
  });

  it("ignora correcciones no finitas al consolidar una pisada", () => {
    expect(bakeFootLockOffset({ x: 1, z: 2 }, { x: Number.NaN, z: Number.POSITIVE_INFINITY })).toEqual({ x: 1, z: 2 });
  });

  it("elimina el giro raíz acumulado sin borrar inclinación corporal", () => {
    const initial = new THREE.Quaternion().setFromEuler(new THREE.Euler(.08, .12, -.04, "YXZ"));
    const final = initial.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.10, Math.PI / 2, -.06, "YXZ")));
    const stripped = stripAccumulatedRootYaw([...initial.toArray(), ...final.toArray()]);
    const relative = new THREE.Quaternion().fromArray(stripped, 0).invert().multiply(new THREE.Quaternion().fromArray(stripped, 4));
    const euler = new THREE.Euler().setFromQuaternion(relative, "YXZ");
    expect(THREE.MathUtils.radToDeg(euler.y)).toBeCloseTo(0, 6);
    expect(Math.abs(euler.x)).toBeGreaterThan(.05);
    expect(Math.abs(euler.z)).toBeGreaterThan(.02);
  });

  it("elimina el desplazamiento horizontal de Start Walking conservando la altura", () => {
    expect(stripAccumulatedRootTranslation([2, .8, -3, 2.4, .83, -3.6])).toEqual([0, .8, 0, 0, .83, 0]);
  });
});
