import { describe, expect, it } from "vitest";
import { catalogAvatarExpressions } from "./avatar-expression-catalog";

describe("catálogo de expresiones del avatar", () => {
  it("preserva el orden declarado por el VRM sin inventar canales", () => {
    expect(catalogAvatarExpressions(["happy", "blink", "aa", "happy"])).toEqual(["happy", "blink", "aa"]);
  });

  it("descarta nombres vacíos, de control o fuera del límite visible", () => {
    expect(catalogAvatarExpressions(["  ", "blink\n", "a".repeat(97), "sad"])).toEqual(["sad"]);
  });
});
