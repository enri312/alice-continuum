import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AVATAR_HEIGHT_METRES, createAvatarScale, offsetAvatarJointWorldY } from "./avatar-scale";

describe("avatar stature", () => {
  it("reaches 1.66 metres without moving the soles or distorting proportions", () => {
    const root = new THREE.Group();
    root.position.set(2, .3, -1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.4, .2));
    body.position.y = .7;
    root.add(body);
    const original = new THREE.Box3().setFromObject(root, true);
    const stature = createAvatarScale(root);
    stature.setHeight(AVATAR_HEIGHT_METRES);
    const result = new THREE.Box3().setFromObject(root, true);
    expect(result.max.y - result.min.y).toBeCloseTo(1.66);
    expect(result.min.y).toBeCloseTo(original.min.y);
    expect(root.position.x).toBe(2);
    expect(root.position.z).toBe(-1);
    expect(root.scale.x).toBe(root.scale.y);
    expect(root.scale.z).toBe(root.scale.y);
    expect(stature.scaleWorldY(original.min.y + .08)).toBeCloseTo(result.min.y + .08 * stature.factor);
    stature.setHeight(1.66);
    expect(new THREE.Box3().setFromObject(root, true).max.y).toBeCloseTo(result.max.y);
    body.geometry.dispose();
  });

  it("converts ground correction to the scaled, rotated joint parent space", () => {
    const parent = new THREE.Group();
    parent.scale.setScalar(1.66 / 1.42);
    parent.rotation.set(.1, .25, -.15);
    const hips = new THREE.Object3D();
    hips.position.set(.1, .85, -.2);
    parent.add(hips);
    const before = hips.getWorldPosition(new THREE.Vector3());
    offsetAvatarJointWorldY(hips, .035);
    const after = hips.getWorldPosition(new THREE.Vector3());
    expect(after.y - before.y).toBeCloseTo(.035);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.z).toBeCloseTo(before.z);
  });
});
