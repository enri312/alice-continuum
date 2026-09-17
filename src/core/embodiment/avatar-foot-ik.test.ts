import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { footIKTargetNeedsReanchor, solveTwoBoneFootIK } from "./avatar-foot-ik";

function legChain() {
  const root = new THREE.Object3D();
  const upperLeg = new THREE.Object3D();
  const lowerLeg = new THREE.Object3D();
  const foot = new THREE.Object3D();
  lowerLeg.position.set(0, -1, 0);
  foot.position.set(0, -1, 0);
  root.add(upperLeg);
  upperLeg.add(lowerLeg);
  lowerLeg.add(foot);
  root.updateMatrixWorld(true);
  return { root, upperLeg, lowerLeg, foot };
}

describe("two bone foot IK", () => {
  it("reduce el error del pie hacia un objetivo alcanzable", () => {
    const chain = legChain();
    const target = new THREE.Vector3(.06, -1.995, .025);
    const before = chain.foot.getWorldPosition(new THREE.Vector3()).distanceTo(target);
    const result = solveTwoBoneFootIK(chain, target);
    const after = chain.foot.getWorldPosition(new THREE.Vector3()).distanceTo(target);
    expect(result.applied).toBe(true);
    expect(after).toBeLessThan(.003);
    expect(after).toBeLessThan(before * .05);
    expect(result.residual).toBeCloseTo(after, 8);
  });

  it("conserva la orientación mundial animada del pie", () => {
    const chain = legChain();
    chain.foot.rotation.set(.2, -.1, .15);
    chain.root.updateMatrixWorld(true);
    const before = chain.foot.getWorldQuaternion(new THREE.Quaternion());
    solveTwoBoneFootIK(chain, new THREE.Vector3(-.25, -1.86, .08));
    const after = chain.foot.getWorldQuaternion(new THREE.Quaternion());
    expect(Math.abs(before.dot(after))).toBeCloseTo(1, 6);
  });

  it("rechaza objetivos no finitos sin tocar la cadena", () => {
    const chain = legChain();
    const upperBefore = chain.upperLeg.quaternion.clone();
    const result = solveTwoBoneFootIK(chain, new THREE.Vector3(Number.NaN, 0, 0));
    expect(result.applied).toBe(false);
    expect(result.iterations).toBe(0);
    expect(chain.upperLeg.quaternion.equals(upperBefore)).toBe(true);
  });

  it("renueva un anclaje lateral antes de volverlo inalcanzable", () => {
    expect(footIKTargetNeedsReanchor({ x: 0, z: 0 }, { x: .074, z: 0 })).toBe(false);
    expect(footIKTargetNeedsReanchor({ x: 0, z: 0 }, { x: .076, z: 0 })).toBe(true);
    expect(footIKTargetNeedsReanchor({ x: 0, z: 0 }, { x: Number.NaN, z: 0 })).toBe(true);
  });
});
