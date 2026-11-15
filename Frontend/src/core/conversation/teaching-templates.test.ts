import { describe, expect, it } from "vitest";
import { teachingTemplates } from "./teaching-templates";

describe("teaching templates", () => {
  it("ofrece seis puntos de partida con identificadores únicos", () => {
    expect(teachingTemplates).toHaveLength(6);
    expect(new Set(teachingTemplates.map((template) => template.id)).size).toBe(6);
  });

  it("solo sugiere tipos e importancia válidos", () => {
    const types = new Set(["semantic", "procedural", "preference", "episodic"]);
    for (const template of teachingTemplates) {
      expect(types.has(template.memoryType)).toBe(true);
      expect(template.importance).toBeGreaterThanOrEqual(1);
      expect(template.importance).toBeLessThanOrEqual(5);
    }
  });

  it("utiliza ayudas y no valores personales precargados", () => {
    for (const template of teachingTemplates) {
      expect(template.titlePlaceholder.startsWith("Ej.:")).toBe(true);
      expect(template.contentPlaceholder.endsWith("…")).toBe(true);
      expect(Object.keys(template)).not.toContain("title");
      expect(Object.keys(template)).not.toContain("content");
    }
  });
});
