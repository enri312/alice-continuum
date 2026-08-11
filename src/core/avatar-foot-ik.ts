import * as THREE from "three";

export type FootIKChain = {
  upperLeg: THREE.Object3D;
  lowerLeg: THREE.Object3D;
  foot: THREE.Object3D;
};

export type FootIKResult = {
  applied: boolean;
  residual: number;
  iterations: number;
};

export function footIKTargetNeedsReanchor(
  foot: Pick<THREE.Vector3, "x" | "z">,
  target: Pick<THREE.Vector3, "x" | "z">,
  maximumPlanarDistance = .075,
) {
  if (![foot.x, foot.z, target.x, target.z, maximumPlanarDistance].every(Number.isFinite)) return true;
  return Math.hypot(target.x - foot.x, target.z - foot.z) > Math.max(.01, maximumPlanarDistance);
}

const jointPosition = new THREE.Vector3();
const effectorPosition = new THREE.Vector3();
const toEffector = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const parentWorldRotation = new THREE.Quaternion();
const parentWorldInverse = new THREE.Quaternion();
const worldCorrection = new THREE.Quaternion();
const localCorrection = new THREE.Quaternion();
const identityRotation = new THREE.Quaternion();
const originalFootWorldRotation = new THREE.Quaternion();

function limitedCorrection(from: THREE.Vector3, to: THREE.Vector3, maximumAngle: number) {
  worldCorrection.setFromUnitVectors(from.normalize(), to.normalize());
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(Math.abs(worldCorrection.w), -1, 1));
  if (angle > maximumAngle && angle > 1e-6) {
    worldCorrection.slerp(identityRotation, 1 - maximumAngle / angle);
  }
  return worldCorrection.normalize();
}

export function solveTwoBoneFootIK(
  chain: FootIKChain,
  target: THREE.Vector3,
  options: { iterations?: number; maximumJointAngle?: number; tolerance?: number } = {},
): FootIKResult {
  const iterations = Math.max(1, Math.min(8, Math.trunc(options.iterations ?? 4)));
  const maximumJointAngle = THREE.MathUtils.clamp(options.maximumJointAngle ?? .24, .01, .65);
  const tolerance = THREE.MathUtils.clamp(options.tolerance ?? .0025, .0001, .03);
  if (![target.x, target.y, target.z].every(Number.isFinite)) return { applied: false, residual: Number.POSITIVE_INFINITY, iterations: 0 };

  chain.foot.getWorldQuaternion(originalFootWorldRotation);
  let completedIterations = 0;
  let applied = false;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    chain.foot.getWorldPosition(effectorPosition);
    if (effectorPosition.distanceTo(target) <= tolerance) break;
    for (const joint of [chain.lowerLeg, chain.upperLeg]) {
      joint.getWorldPosition(jointPosition);
      chain.foot.getWorldPosition(effectorPosition);
      toEffector.subVectors(effectorPosition, jointPosition);
      toTarget.subVectors(target, jointPosition);
      if (toEffector.lengthSq() < 1e-8 || toTarget.lengthSq() < 1e-8) continue;

      limitedCorrection(toEffector, toTarget, maximumJointAngle);
      if (joint.parent) joint.parent.getWorldQuaternion(parentWorldRotation);
      else parentWorldRotation.identity();
      parentWorldInverse.copy(parentWorldRotation).invert();
      localCorrection.copy(parentWorldInverse).multiply(worldCorrection).multiply(parentWorldRotation);
      joint.quaternion.premultiply(localCorrection).normalize();
      joint.updateWorldMatrix(true, true);
      applied = true;
    }
    completedIterations = iteration + 1;
  }

  if (chain.foot.parent) chain.foot.parent.getWorldQuaternion(parentWorldRotation);
  else parentWorldRotation.identity();
  chain.foot.quaternion.copy(parentWorldRotation.invert().multiply(originalFootWorldRotation)).normalize();
  chain.foot.updateWorldMatrix(true, true);
  chain.foot.getWorldPosition(effectorPosition);
  return { applied, residual: effectorPosition.distanceTo(target), iterations: completedIterations };
}
