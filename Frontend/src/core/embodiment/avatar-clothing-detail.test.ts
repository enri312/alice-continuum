import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MToonMaterial } from "@pixiv/three-vrm";
import { clothingNormalPixels, createAvatarClothingDetail } from "./avatar-clothing-detail";

function fabric(width: number, height: number) {
  return new Uint8ClampedArray(Array.from({ length: width * height }, () => [70, 70, 70, 255]).flat());
}

describe("clothing relief", () => {
  it("preserves authored normal maps and leaves skin alone, restoring on disposal", () => {
    const root = new THREE.Group();
    const normal = new THREE.Texture();
    normal.name = "Authored folds";
    const clothing = new MToonMaterial({ normalMap: normal, normalScale: new THREE.Vector2(.8, .6) });
    clothing.name = "N00_007_03_Tops_01_CLOTH_01 (Instance)";
    const skin = new MToonMaterial({ normalMap: normal });
    skin.name = "N00_000_00_Body_00_SKIN (Instance)";
    const geometry = new THREE.BoxGeometry();
    root.add(new THREE.Mesh(geometry, [clothing, skin]));
    const detail = createAvatarClothingDetail(root, 16);
    detail.setStrength(.7);
    expect(clothing.normalMap).toBe(normal);
    expect(clothing.normalScale.x).toBeGreaterThan(.8);
    expect(skin.normalScale.toArray()).toEqual([1, 1]);
    detail.dispose();
    expect(clothing.normalMap).toBe(normal);
    expect(clothing.normalScale.toArray()).toEqual([.8, .6]);
    geometry.dispose();
    clothing.dispose();
    skin.dispose();
    normal.dispose();
  });

  it("creates finite, normalized relief without rewriting the colour texture", () => {
    const pixels = fabric(16, 16);
    const before = pixels.slice();
    const normals = clothingNormalPixels(pixels, 16, 16, "outerwear");
    expect(pixels).toEqual(before);
    let variedNormals = 0;
    for (let i = 0; i < normals.length; i += 4) {
      const length = Math.hypot(normals[i] / 127.5 - 1, normals[i + 1] / 127.5 - 1, normals[i + 2] / 127.5 - 1);
      expect(length).toBeCloseTo(1, 2);
      expect(normals[i + 2]).toBeGreaterThan(230);
      if (Math.abs(normals[i] - 128) > 2 || Math.abs(normals[i + 1] - 128) > 2) variedNormals += 1;
    }
    expect(variedNormals).toBeGreaterThan(50);
  });

  it("keeps transparent UV edges flat instead of generating a raised halo", () => {
    const pixels = fabric(5, 5);
    const center = (2 * 5 + 2) * 4;
    pixels[center + 3] = 0;
    pixels[center] = pixels[center + 1] = pixels[center + 2] = 255;
    const normals = clothingNormalPixels(pixels, 5, 5, "outerwear");
    for (const p of [center, center - 4, center + 4, center - 20, center + 20]) {
      expect(Array.from(normals.slice(p, p + 4))).toEqual([128, 128, 255, 255]);
    }
  });

  it("reacts to an existing painted seam more strongly than to flat fabric", () => {
    const pixels = fabric(8, 8);
    for (let y = 0; y < 8; y += 1) {
      const p = (y * 8 + 4) * 4;
      pixels[p] = pixels[p + 1] = pixels[p + 2] = 180;
    }
    const normals = clothingNormalPixels(pixels, 8, 8, "harness");
    const beforeSeam = (3 * 8 + 3) * 4;
    const afterSeam = (3 * 8 + 5) * 4;
    expect(normals[beforeSeam]).toBeLessThan(95);
    expect(normals[afterSeam]).toBeGreaterThan(160);
  });
});
