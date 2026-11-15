import * as THREE from "three";

export const AVATAR_HEIGHT_METRES = 1.66;

/** Measures the standing model once, including hair and shoes, in glTF metres. */
export function createAvatarScale(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root, true);
  const originalHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(originalHeight) || originalHeight <= 0) {
    throw new Error("No se pudo medir la altura del avatar");
  }
  const originalScale = root.scale.clone();
  const originalY = root.position.y;
  const floorY = bounds.min.y;
  let factor = 1;
  return {
    originalHeight,
    floorY,
    get factor() { return factor; },
    scaleWorldY(y: number) { return floorY + (y - floorY) * factor; },
    setHeight(metres: number) {
      if (!Number.isFinite(metres) || metres <= 0) throw new Error("Altura de avatar inválida");
      factor = metres / originalHeight;
      root.scale.copy(originalScale).multiplyScalar(factor);
      // Keep the soles at the same floor height even when the model origin is offset.
      root.position.y = floorY + (originalY - floorY) * factor;
      root.updateMatrixWorld(true);
      return root.position.y;
    },
  };
}

const correctedWorldPosition = new THREE.Vector3();

/** Ground correction is measured in world metres; joint translation is in parent space. */
export function offsetAvatarJointWorldY(joint: THREE.Object3D, metres: number) {
  if (!Number.isFinite(metres)) return;
  joint.getWorldPosition(correctedWorldPosition);
  correctedWorldPosition.y += metres;
  if (joint.parent) joint.parent.worldToLocal(correctedWorldPosition);
  joint.position.copy(correctedWorldPosition);
  joint.updateWorldMatrix(false, true);
}
