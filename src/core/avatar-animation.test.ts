import { describe, expect, it } from "vitest";
import { selectAvatarAnimation } from "./avatar-animation";

describe("avatar animation selection", () => {
  it("mantiene reposo dentro del umbral", () => {
    expect(selectAvatarAnimation(0, 0)).toBe("idle");
    expect(selectAvatarAnimation(0.04, -0.04)).toBe("idle");
  });

  it("elige los cuatro clips según el eje dominante", () => {
    expect(selectAvatarAnimation(0.2, -0.8)).toBe("forward");
    expect(selectAvatarAnimation(-0.2, 0.8)).toBe("backward");
    expect(selectAvatarAnimation(-0.9, -0.2)).toBe("left");
    expect(selectAvatarAnimation(0.9, 0.2)).toBe("right");
  });
});
