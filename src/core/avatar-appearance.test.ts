import { describe, expect, it } from "vitest";
import { avatarClothingFinish } from "./avatar-appearance";

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
});
