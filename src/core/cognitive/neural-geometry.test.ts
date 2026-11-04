import { describe, expect, it } from "vitest";
import { cortexPaths, neuralMemoryPosition } from "./neural-geometry";

describe("geometría neuronal ilustrativa", () => {
  it("mantiene estable un recuerdo al volver a abrir o añadir otros registros", () => {
    const first=neuralMemoryPosition("recuerdo-estable");
    Array.from({length:50},(_,i)=>neuralMemoryPosition(`otro-${i}`));
    expect(neuralMemoryPosition("recuerdo-estable")).toEqual(first);
  });
  it("distribuye registros dentro de los dos hemisferios sin coordenadas inválidas", () => {
    const points=Array.from({length:500},(_,i)=>neuralMemoryPosition(`recuerdo-${i}`));
    expect(points.some(p=>p.x<0)).toBe(true);
    expect(points.some(p=>p.x>0)).toBe(true);
    for(const p of points){expect(Number.isFinite(p.x+p.y+p.z)).toBe(true);expect(Math.abs(p.x)).toBeLessThan(.9);expect(Math.abs(p.y)).toBeLessThan(.8);expect(Math.abs(p.z)).toBeLessThan(.6);}
    expect(cortexPaths.every(path=>path.every(p=>Number.isFinite(p.x+p.y+p.z)))).toBe(true);
  });
});
