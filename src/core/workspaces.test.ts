import { describe, expect, it } from "vitest";
import { workspaceForScreen, workspaceScreens } from "./workspaces";

describe("separación de espacios de Alice", () => {
  it("no mezcla mente, cuerpo y gobierno local", () => {
    const all = Object.values(workspaceScreens).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(workspaceForScreen("memoria")).toBe("cognitive");
    expect(workspaceForScreen("flujo")).toBe("cognitive");
    expect(workspaceForScreen("estado")).toBe("cognitive");
    expect(workspaceForScreen("planificador")).toBe("cognitive");
    expect(workspaceForScreen("cuerpo")).toBe("body");
    expect(workspaceForScreen("habilidades")).toBe("governance");
    expect(workspaceForScreen("procedimientos")).toBe("governance");
    expect(workspaceForScreen("configuracion")).toBe("governance");
    expect(workspaceForScreen("puentes")).toBe("governance");
    expect(workspaceForScreen("auditoria")).toBe("governance");
  });
});
