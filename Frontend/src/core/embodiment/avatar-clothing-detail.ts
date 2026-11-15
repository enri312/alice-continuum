import * as THREE from "three";
import { avatarClothingFinish, type AvatarClothingRole } from "./avatar-appearance";

type ClothingMaterial = THREE.Material & {
  isMToonMaterial?: boolean;
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  normalScale: THREE.Vector2;
};

const surfaceProfiles: Record<AvatarClothingRole, { relief: number; weave: number; ribbed: boolean }> = {
  outerwear: { relief: 2.4, weave: .055, ribbed: false },
  innerwear: { relief: 1.6, weave: .045, ribbed: false },
  harness: { relief: 2.6, weave: .065, ribbed: true },
  onepiece: { relief: 2.0, weave: .04, ribbed: false },
  shoes: { relief: 2.6, weave: .025, ribbed: true },
  accent: { relief: 2.0, weave: .02, ribbed: false },
};

/** Bounded shading relief from painted seams, with a fine weave. This adds no geometry. */
export function clothingNormalPixels(pixels: Uint8ClampedArray, width: number, height: number, role: AvatarClothingRole) {
  const profile = surfaceProfiles[role];
  const luminance = new Float32Array(width * height);
  const output = new Uint8Array(width * height * 4);
  for (let i = 0; i < luminance.length; i += 1) {
    const p = i * 4;
    luminance[i] = (.2126 * pixels[p] + .7152 * pixels[p + 1] + .0722 * pixels[p + 2]) / 255;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const p = index * 4;
      const left = y * width + Math.max(0, x - 1);
      const right = y * width + Math.min(width - 1, x + 1);
      const up = Math.max(0, y - 1) * width + x;
      const down = Math.min(height - 1, y + 1) * width + x;
      // A transparent UV island must not create an artificial raised border.
      const coverage = Math.min(pixels[p + 3], pixels[left * 4 + 3], pixels[right * 4 + 3], pixels[up * 4 + 3], pixels[down * 4 + 3]) / 255;
      const fibre = profile.weave * (1 - luminance[index] * .65);
      const warp = Math.sin(x * Math.PI / 2) * (profile.ribbed ? 1 : Math.cos(y * Math.PI / 4));
      const weft = profile.ribbed ? 0 : Math.sin(y * Math.PI / 2) * Math.cos(x * Math.PI / 4);
      const dx = THREE.MathUtils.clamp((luminance[right] - luminance[left]) * profile.relief + warp * fibre, -.45, .45) * coverage;
      const dy = THREE.MathUtils.clamp((luminance[down] - luminance[up]) * profile.relief + weft * fibre, -.45, .45) * coverage;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      output[p] = Math.round((-dx * inverseLength * .5 + .5) * 255);
      output[p + 1] = Math.round((-dy * inverseLength * .5 + .5) * 255);
      output[p + 2] = Math.round((inverseLength * .5 + .5) * 255);
      output[p + 3] = 255;
    }
  }
  return output;
}

function makeClothingNormal(map: THREE.Texture, role: AvatarClothingRole, maximumAnisotropy: number) {
  const image = map.image as CanvasImageSource & { width?: number; height?: number };
  if (!image?.width || !image?.height) return null;
  const ratio = Math.min(1, 1024 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const normal = new THREE.DataTexture(clothingNormalPixels(pixels, width, height, role), width, height);
  normal.name = `Alice clothing relief: ${role}`;
  normal.colorSpace = THREE.NoColorSpace;
  normal.flipY = map.flipY;
  normal.wrapS = map.wrapS;
  normal.wrapT = map.wrapT;
  normal.offset.copy(map.offset);
  normal.repeat.copy(map.repeat);
  normal.center.copy(map.center);
  normal.rotation = map.rotation;
  normal.channel = map.channel;
  normal.matrixAutoUpdate = map.matrixAutoUpdate;
  normal.matrix.copy(map.matrix);
  normal.minFilter = THREE.LinearMipmapLinearFilter;
  normal.magFilter = THREE.LinearFilter;
  normal.generateMipmaps = true;
  normal.anisotropy = Math.max(1, Math.min(maximumAnisotropy, 12));
  normal.needsUpdate = true;
  return normal;
}

export function createAvatarClothingDetail(root: THREE.Object3D, maximumAnisotropy: number) {
  const originals = new Map<ClothingMaterial, { map: THREE.Texture | null; scale: THREE.Vector2; detail: THREE.Texture | null }>();
  const generated = new Map<string, THREE.Texture | null>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const candidate of Array.isArray(object.material) ? object.material : [object.material]) {
      const material = candidate as ClothingMaterial;
      const finish = avatarClothingFinish(material.name);
      if (!material.isMToonMaterial || !finish || originals.has(material)) continue;
      let detail: THREE.Texture | null = null;
      // Preserve authored normal maps. Alice currently uses VRoid's flat placeholder.
      const placeholder = !material.normalMap || material.normalMap.name === "Shader_NoneNormal";
      if (placeholder && material.map) {
        const key = `${material.map.uuid}:${finish.role}`;
        if (!generated.has(key)) {
          try { generated.set(key, makeClothingNormal(material.map, finish.role, maximumAnisotropy)); }
          catch (cause) {
            console.warn("No se pudo crear el relieve de una prenda", cause);
            generated.set(key, null);
          }
        }
        detail = generated.get(key) ?? null;
      }
      if (detail || (material.normalMap && !placeholder)) {
        originals.set(material, { map: material.normalMap, scale: material.normalScale.clone(), detail });
      }
    }
  });
  return {
    materialCount: originals.size,
    setStrength(value: number) {
      const strength = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
      for (const [material, original] of originals) {
        const nextMap = strength > 0 && original.detail ? original.detail : original.map;
        if (material.normalMap !== nextMap) {
          material.normalMap = nextMap;
          material.needsUpdate = true;
        }
        if (original.detail && strength > 0) material.normalScale.set(strength, strength);
        else material.normalScale.copy(original.scale).multiplyScalar(original.detail ? 1 : 1 + strength * .35);
      }
    },
    dispose() {
      for (const [material, original] of originals) {
        material.normalMap = original.map;
        material.normalScale.copy(original.scale);
      }
      for (const texture of generated.values()) texture?.dispose();
      originals.clear();
      generated.clear();
    },
  };
}
