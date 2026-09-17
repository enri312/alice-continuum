import { describe, expect, it } from "vitest";
import { loadCompatibleArray } from "./storage-migration";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    value(key: string) { return values.get(key); },
  };
}

describe("loadCompatibleArray", () => {
  it("prefiere la identidad vigente", () => {
    const storage = memoryStorage({ current: '[{"id":"new"}]', legacy: '[{"id":"old"}]' });
    expect(loadCompatibleArray<{ id: string }>(storage, "current", ["legacy"])).toEqual([{ id: "new" }]);
  });

  it("copia la fuente histórica sin borrarla", () => {
    const storage = memoryStorage({ legacy: '[{"id":"old"}]' });
    expect(loadCompatibleArray<{ id: string }>(storage, "current", ["legacy"])).toEqual([{ id: "old" }]);
    expect(storage.value("current")).toBe('[{"id":"old"}]');
    expect(storage.value("legacy")).toBe('[{"id":"old"}]');
  });

  it("continúa con una fuente histórica cuando la vigente está corrupta", () => {
    const storage = memoryStorage({ current: "{invalid", legacy: '[{"id":"safe"}]' });
    expect(loadCompatibleArray<{ id: string }>(storage, "current", ["legacy"])).toEqual([{ id: "safe" }]);
  });
});
