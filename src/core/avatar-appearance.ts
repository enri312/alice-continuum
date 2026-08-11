export type AvatarClothingRole = "outerwear" | "innerwear" | "harness" | "onepiece" | "shoes" | "accent";

export type AvatarClothingFinish = {
  role: AvatarClothingRole;
  tint: number;
  shade: number;
  rim: number;
  tintMix: number;
  shadeMix: number;
  rimMix: number;
  rimPower: number;
  toonFactor: number;
  emissive?: number;
  emissiveIntensity?: number;
};

const finishes: Record<AvatarClothingRole, AvatarClothingFinish> = {
  outerwear: { role: "outerwear", tint: 0xdbeafe, shade: 0x172033, rim: 0x164e63, tintMix: .16, shadeMix: .42, rimMix: .30, rimPower: 4.8, toonFactor: .78 },
  innerwear: { role: "innerwear", tint: 0xf1f5f9, shade: 0x334155, rim: 0x155e75, tintMix: .10, shadeMix: .30, rimMix: .22, rimPower: 5.2, toonFactor: .72 },
  harness: { role: "harness", tint: 0xcbd5e1, shade: 0x0f172a, rim: 0x0e7490, tintMix: .14, shadeMix: .48, rimMix: .34, rimPower: 4.2, toonFactor: .84 },
  onepiece: { role: "onepiece", tint: 0xd8e2f0, shade: 0x1e293b, rim: 0x155e75, tintMix: .12, shadeMix: .38, rimMix: .26, rimPower: 4.7, toonFactor: .76 },
  shoes: { role: "shoes", tint: 0xb8c5d6, shade: 0x111827, rim: 0x0e7490, tintMix: .18, shadeMix: .50, rimMix: .28, rimPower: 4.0, toonFactor: .88 },
  accent: { role: "accent", tint: 0xb6f3ff, shade: 0x164e63, rim: 0x22d3ee, tintMix: .24, shadeMix: .34, rimMix: .52, rimPower: 3.8, toonFactor: .80, emissive: 0x083344, emissiveIntensity: .08 },
};

export function avatarClothingFinish(materialName: string): AvatarClothingFinish | null {
  const name = materialName.toUpperCase();
  if (!name.includes("_CLOTH")) return null;
  if (name.includes("ACCESSORY_TIE")) return finishes.accent;
  if (name.includes("SHOES")) return finishes.shoes;
  if (name.includes("ONEPIECE")) return finishes.onepiece;
  if (name.includes("N00_002_04_TOPS")) return finishes.harness;
  if (name.includes("N00_005_01_TOPS")) return finishes.innerwear;
  return finishes.outerwear;
}
