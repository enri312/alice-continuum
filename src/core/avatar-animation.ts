import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { VRMHumanBoneName } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

export type LocomotionAnimationId = "idle" | "forward" | "backward" | "left" | "right" | "run" | "turn-left" | "turn-right";
export type AvatarAnimationId = LocomotionAnimationId | "jump" | "start-walking" | "sitting-idle" | "standing-up";
export type AvatarAnimationUrls = Partial<Record<AvatarAnimationId, string>>;
export type LocomotionWeights = Record<LocomotionAnimationId, number>;

const locomotionBaseCycles: Record<Exclude<LocomotionAnimationId, "idle">, number> = {
  forward: .75,
  backward: .90,
  left: .68,
  right: .68,
  run: 1.25,
  "turn-left": .85,
  "turn-right": .85,
};

const mixamoVRMRigMap: Record<string, VRMHumanBoneName> = {
  mixamorigHips: VRMHumanBoneName.Hips,
  mixamorigSpine: VRMHumanBoneName.Spine,
  mixamorigSpine1: VRMHumanBoneName.Chest,
  mixamorigSpine2: VRMHumanBoneName.UpperChest,
  mixamorigNeck: VRMHumanBoneName.Neck,
  mixamorigHead: VRMHumanBoneName.Head,
  mixamorigLeftShoulder: VRMHumanBoneName.LeftShoulder,
  mixamorigLeftArm: VRMHumanBoneName.LeftUpperArm,
  mixamorigLeftForeArm: VRMHumanBoneName.LeftLowerArm,
  mixamorigLeftHand: VRMHumanBoneName.LeftHand,
  mixamorigLeftHandThumb1: VRMHumanBoneName.LeftThumbMetacarpal,
  mixamorigLeftHandThumb2: VRMHumanBoneName.LeftThumbProximal,
  mixamorigLeftHandThumb3: VRMHumanBoneName.LeftThumbDistal,
  mixamorigLeftHandIndex1: VRMHumanBoneName.LeftIndexProximal,
  mixamorigLeftHandIndex2: VRMHumanBoneName.LeftIndexIntermediate,
  mixamorigLeftHandIndex3: VRMHumanBoneName.LeftIndexDistal,
  mixamorigLeftHandMiddle1: VRMHumanBoneName.LeftMiddleProximal,
  mixamorigLeftHandMiddle2: VRMHumanBoneName.LeftMiddleIntermediate,
  mixamorigLeftHandMiddle3: VRMHumanBoneName.LeftMiddleDistal,
  mixamorigLeftHandRing1: VRMHumanBoneName.LeftRingProximal,
  mixamorigLeftHandRing2: VRMHumanBoneName.LeftRingIntermediate,
  mixamorigLeftHandRing3: VRMHumanBoneName.LeftRingDistal,
  mixamorigLeftHandPinky1: VRMHumanBoneName.LeftLittleProximal,
  mixamorigLeftHandPinky2: VRMHumanBoneName.LeftLittleIntermediate,
  mixamorigLeftHandPinky3: VRMHumanBoneName.LeftLittleDistal,
  mixamorigRightShoulder: VRMHumanBoneName.RightShoulder,
  mixamorigRightArm: VRMHumanBoneName.RightUpperArm,
  mixamorigRightForeArm: VRMHumanBoneName.RightLowerArm,
  mixamorigRightHand: VRMHumanBoneName.RightHand,
  mixamorigRightHandThumb1: VRMHumanBoneName.RightThumbMetacarpal,
  mixamorigRightHandThumb2: VRMHumanBoneName.RightThumbProximal,
  mixamorigRightHandThumb3: VRMHumanBoneName.RightThumbDistal,
  mixamorigRightHandIndex1: VRMHumanBoneName.RightIndexProximal,
  mixamorigRightHandIndex2: VRMHumanBoneName.RightIndexIntermediate,
  mixamorigRightHandIndex3: VRMHumanBoneName.RightIndexDistal,
  mixamorigRightHandMiddle1: VRMHumanBoneName.RightMiddleProximal,
  mixamorigRightHandMiddle2: VRMHumanBoneName.RightMiddleIntermediate,
  mixamorigRightHandMiddle3: VRMHumanBoneName.RightMiddleDistal,
  mixamorigRightHandRing1: VRMHumanBoneName.RightRingProximal,
  mixamorigRightHandRing2: VRMHumanBoneName.RightRingIntermediate,
  mixamorigRightHandRing3: VRMHumanBoneName.RightRingDistal,
  mixamorigRightHandPinky1: VRMHumanBoneName.RightLittleProximal,
  mixamorigRightHandPinky2: VRMHumanBoneName.RightLittleIntermediate,
  mixamorigRightHandPinky3: VRMHumanBoneName.RightLittleDistal,
  mixamorigLeftUpLeg: VRMHumanBoneName.LeftUpperLeg,
  mixamorigLeftLeg: VRMHumanBoneName.LeftLowerLeg,
  mixamorigLeftFoot: VRMHumanBoneName.LeftFoot,
  mixamorigLeftToeBase: VRMHumanBoneName.LeftToes,
  mixamorigRightUpLeg: VRMHumanBoneName.RightUpperLeg,
  mixamorigRightLeg: VRMHumanBoneName.RightLowerLeg,
  mixamorigRightFoot: VRMHumanBoneName.RightFoot,
  mixamorigRightToeBase: VRMHumanBoneName.RightToes,
};

export function selectAvatarAnimation(moveX: number, moveZ: number): AvatarAnimationId {
  if (Math.hypot(moveX, moveZ) < 0.08) return "idle";
  if (Math.abs(moveX) > Math.abs(moveZ)) return moveX < 0 ? "left" : "right";
  return moveZ < 0 ? "forward" : "backward";
}

export function computeLocomotionWeights(moveX: number, moveZ: number, turn = 0): LocomotionWeights {
  const safeX = Number.isFinite(moveX) ? THREE.MathUtils.clamp(moveX, -1, 1) : 0;
  const safeZ = Number.isFinite(moveZ) ? THREE.MathUtils.clamp(moveZ, -1, 1) : 0;
  const safeTurn = Number.isFinite(turn) ? THREE.MathUtils.clamp(turn, -1, 1) : 0;
  const planarMagnitude = Math.min(1, Math.hypot(safeX, safeZ));
  const pivotMagnitude = planarMagnitude < 0.08 ? Math.abs(safeTurn) * 0.38 : 0;
  const movingWeight = Math.max(planarMagnitude, pivotMagnitude);
  const axisTotal = Math.abs(safeX) + Math.abs(safeZ);
  const directionalScale = axisTotal > 1e-6 ? planarMagnitude / axisTotal : 0;
  const forwardBase = Math.max(0, -safeZ) * directionalScale;
  const forwardBias = axisTotal > 1e-6 ? Math.max(0, -safeZ) / axisTotal : 0;
  const runProgress = THREE.MathUtils.clamp((planarMagnitude - 0.72) / 0.24, 0, 1);
  const smoothRunProgress = runProgress * runProgress * (3 - 2 * runProgress);
  const run = forwardBase * smoothRunProgress * forwardBias;
  const left = Math.max(0, -safeX) * directionalScale;
  const right = Math.max(0, safeX) * directionalScale;

  return {
    idle: Math.max(0, 1 - movingWeight),
    forward: forwardBase - run,
    backward: Math.max(0, safeZ) * directionalScale,
    left,
    right,
    run,
    "turn-left": safeTurn < 0 ? pivotMagnitude : 0,
    "turn-right": safeTurn > 0 ? pivotMagnitude : 0,
  };
}

export function locomotionCycleRate(
  animation: LocomotionAnimationId,
  movement: number,
) {
  if (animation === "idle") return .72;
  const safeMovement = THREE.MathUtils.clamp(Number.isFinite(movement) ? movement : 0, 0, 1);
  return locomotionBaseCycles[animation] * (.55 + safeMovement * .45);
}

export function stripAccumulatedRootTranslation(values: ArrayLike<number>) {
  const output = Array.from(values);
  if (output.length < 3 || output.length % 3 !== 0) return output;
  for (let index = 0; index < output.length; index += 3) {
    output[index] = 0;
    output[index + 2] = 0;
  }
  return output;
}

export function footGroundCorrection(
  leftFootY: number,
  rightFootY: number,
  referenceFootY: number,
  maximumCorrection = 0.08,
) {
  if (![leftFootY, rightFootY, referenceFootY, maximumCorrection].every(Number.isFinite)) return 0;
  const penetration = referenceFootY - Math.min(leftFootY, rightFootY);
  return THREE.MathUtils.clamp(penetration, 0, Math.max(0, maximumCorrection));
}

export function advanceFootLockOffset(
  current: { x: number; z: number },
  drift: { x: number; z: number },
  deltaSeconds: number,
  contact: boolean,
  maximumOffset = 0.065,
) {
  const delta = THREE.MathUtils.clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
  const factor = 1 - Math.exp(-delta * (contact ? 24 : 10));
  let x = contact ? current.x + drift.x * factor : current.x * (1 - factor);
  let z = contact ? current.z + drift.z * factor : current.z * (1 - factor);
  const magnitude = Math.hypot(x, z);
  if (magnitude > maximumOffset && magnitude > 0) {
    const scale = maximumOffset / magnitude;
    x *= scale;
    z *= scale;
  }
  return { x, z };
}

export function bakeFootLockOffset<T extends { x: number; z: number }>(
  motion: T,
  offset: { x: number; z: number },
): T {
  const offsetX = Number.isFinite(offset.x) ? offset.x : 0;
  const offsetZ = Number.isFinite(offset.z) ? offset.z : 0;
  return { ...motion, x: motion.x + offsetX, z: motion.z + offsetZ };
}

export function stripAccumulatedRootYaw(values: ArrayLike<number>) {
  const output = Array.from(values);
  if (output.length < 4 || output.length % 4 !== 0) return output;
  const initial = new THREE.Quaternion().fromArray(output, 0).normalize();
  const initialInverse = initial.clone().invert();
  const rotation = new THREE.Quaternion();
  const relative = new THREE.Quaternion();
  const yawless = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  for (let index = 0; index < output.length; index += 4) {
    rotation.fromArray(output, index).normalize();
    relative.copy(initialInverse).multiply(rotation);
    euler.setFromQuaternion(relative, "YXZ");
    euler.y = 0;
    yawless.setFromEuler(euler);
    initial.clone().multiply(yawless).toArray(output, index);
  }
  return output;
}

/** Retargeting basado en el ejemplo humanoidAnimation oficial de pixiv/three-vrm. */
export async function loadMixamoAnimation(url: string, vrm: VRM, name: string) {
  const asset = await new FBXLoader().loadAsync(url);
  const sourceClip = THREE.AnimationClip.findByName(asset.animations, "mixamo.com") ?? asset.animations[0];
  const motionHips = asset.getObjectByName("mixamorigHips");
  if (!sourceClip || !motionHips) throw new Error(`FBX Mixamo inválido: ${name}`);

  const motionHipsHeight = motionHips.position.y;
  if (!Number.isFinite(motionHipsHeight) || Math.abs(motionHipsHeight) < 1e-6) {
    throw new Error(`Altura de cadera inválida: ${name}`);
  }
  const normalizedHipsPosition = vrm.humanoid.normalizedRestPose.hips?.position;
  if (!normalizedHipsPosition) throw new Error(`El VRM no declara una cadera normalizada: ${name}`);
  const hipsPositionScale = normalizedHipsPosition[1] / motionHipsHeight;
  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const rotation = new THREE.Quaternion();

  for (const track of sourceClip.tracks) {
    const [mixamoRigName, propertyName] = track.name.split(".");
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    const vrmNodeName = vrmBoneName ? vrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name : undefined;
    const mixamoRigNode = asset.getObjectByName(mixamoRigName);
    if (!vrmNodeName || !mixamoRigNode || !mixamoRigNode.parent) continue;

    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = vrmBoneName === VRMHumanBoneName.Hips && (name === "turn-left" || name === "turn-right")
        ? stripAccumulatedRootYaw(track.values)
        : Array.from(track.values);
      for (let index = 0; index < values.length; index += 4) {
        rotation.fromArray(values, index).premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        rotation.toArray(values, index);
      }
      if (vrm.meta.metaVersion === "0") {
        for (let index = 0; index < values.length; index += 2) values[index] *= -1;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, values));
    } else if (track instanceof THREE.VectorKeyframeTrack) {
      const sourceValues = vrmBoneName === VRMHumanBoneName.Hips && name === "start-walking"
        ? stripAccumulatedRootTranslation(track.values)
        : Array.from(track.values);
      const values = Array.from(sourceValues, (value, index) => {
        const vrm0Sign = vrm.meta.metaVersion === "0" && index % 3 !== 1 ? -1 : 1;
        return value * hipsPositionScale * vrm0Sign;
      });
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, values));
    }
  }

  if (tracks.length === 0) throw new Error(`No se pudieron retargetear pistas: ${name}`);
  return new THREE.AnimationClip(name, sourceClip.duration, tracks);
}
