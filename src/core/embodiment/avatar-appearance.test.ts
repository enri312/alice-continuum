import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyAvatarClothingSurfaceDetail, avatarClothingFinish } from "./avatar-appearance";

describe("avatar clothing finish", () => {
  it("clasifica las capas reales de la ropa de Alice", () => {
    expect(avatarClothingFinish("N00_007_03_Tops_01_CLOTH_01 (Instance)")?.role).toBe("outerwear");
    expect(avatarClothingFinish("N00_005_01_Tops_01_CLOTH (Instance)")?.role).toBe("innerwear");
    expect(avatarClothingFinish("N00_002_04_Tops_01_CLOTH (Instance)")?.role).toBe("harness");
    expect(avatarClothingFinish("N00_010_01_Onepiece_00_CLOTH_01 (Instance)")?.role).toBe("onepiece");
    expect(avatarClothingFinish("N00_008_01_Shoes_01_CLOTH (Instance)")?.role).toBe("shoes");
    expect(avatarClothingFinish("N00_007_01_Accessory_Tie_01_CLOTH_01 (Instance)")?.role).toBe("accent");
  });

  it("no modifica materiales de piel, ojos ni cabello", () => {
    expect(avatarClothingFinish("N00_000_00_Body_00_SKIN (Instance)")).toBeNull();
    expect(avatarClothingFinish("N00_000_Hair_00_HAIR (Instance)")).toBeNull();
    expect(avatarClothingFinish("N00_000_00_EyeIris_00_EYE (Instance)")).toBeNull();
  });

  it("aumenta muestreo y relieve sin tocar ningún parámetro de color", () => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const material = {
      name: "N00_007_03_Tops_01_CLOTH_01 (Instance)",
      map,
      normalMap,
      normalScale: new THREE.Vector2(1, 1),
      alphaToCoverage: false,
      userData: {} as Record<string, unknown>,
      needsUpdate: false,
      color: new THREE.Color(0x334455),
      shadeColorFactor: new THREE.Color(0x112233),
      parametricRimColorFactor: new THREE.Color(0x445566),
      emissive: new THREE.Color(0x010203),
    };
    const colorsBefore = [material.color, material.shadeColorFactor, material.parametricRimColorFactor, material.emissive].map((color) => color.getHex());

    expect(applyAvatarClothingSurfaceDetail(material, 16)).toBe(true);
    expect(map.anisotropy).toBe(12);
    expect(normalMap.anisotropy).toBe(12);
    expect(normalMap.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(material.normalScale.x).toBeCloseTo(1.16);
    expect(material.alphaToCoverage).toBe(true);
    expect([material.color, material.shadeColorFactor, material.parametricRimColorFactor, material.emissive].map((color) => color.getHex())).toEqual(colorsBefore);

    expect(applyAvatarClothingSurfaceDetail(material, 16)).toBe(false);
    expect(material.normalScale.x).toBeCloseTo(1.16);
  });
});
