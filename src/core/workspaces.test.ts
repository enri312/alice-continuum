import { describe, expect, it } from "vitest";
import { workspaceForScreen, workspaceScreens } from "./workspaces";

describe("separación de espacios de Alice", () => {
  it("mantiene siete accesos cognitivos y no duplica Conversación", () => {
    expect(workspaceScreens.cognitive).toEqual([
      "identificacion",
      "nucleo",
      "flujo",
      "estado",
      "planificador",
      "memoria",
      "actividad",
    ]);
    expect(workspaceScreens.cognitive).toHaveLength(7);
    expect(workspaceScreens.cognitive).not.toContain("conversacion");
  });

  it("no mezcla mente, cuerpo y gobierno local", () => {
    const all = Object.values(workspaceScreens).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(workspaceForScreen("memoria")).toBe("cognitive");
    expect(workspaceForScreen("flujo")).toBe("cognitive");
    expect(workspaceForScreen("estado")).toBe("cognitive");
    expect(workspaceForScreen("planificador")).toBe("cognitive");
    expect(workspaceForScreen("identificacion")).toBe("cognitive");
    expect(workspaceForScreen("cuerpo")).toBe("body");
    expect(workspaceForScreen("rostro")).toBe("body");
    expect(workspaceForScreen("avatar")).toBe("body");
    expect(workspaceForScreen("habilidades")).toBe("governance");
    expect(workspaceForScreen("procedimientos")).toBe("governance");
    expect(workspaceForScreen("configuracion")).toBe("governance");
    expect(workspaceForScreen("puentes")).toBe("governance");
    expect(workspaceForScreen("auditoria")).toBe("governance");
  });
});
