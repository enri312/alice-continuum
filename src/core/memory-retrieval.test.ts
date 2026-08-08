import { describe, expect, it } from "vitest";
import { retrieveMemories } from "./memory-retrieval";

const memories = [
  { id: "facultad", intention: "Horario de Programación", summary: "La clase de programación es el lunes por la noche.", nextStep: "Preparar el práctico." },
  { id: "juego", intention: "World of Warcraft", summary: "Carlos Nuñez juega cuando termina sus tareas.", nextStep: "No desplazar el estudio." },
  { id: "familia", intention: "Cuidado de los abuelos", summary: "Carlos Nuñez ayuda a su madre con el cuidado familiar." },
];

describe("recuperación local de memoria", () => {
  it("no recupera recuerdos sin una consulta significativa", () => {
    expect(retrieveMemories("", memories)).toEqual([]);
    expect(retrieveMemories("de la y", memories)).toEqual([]);
  });

  it("prioriza coincidencias del tema y explica por qué", () => {
    const matches = retrieveMemories("¿Cuándo tengo programación?", memories);
    expect(matches[0].memory.id).toBe("facultad");
    expect(matches[0].reason).toContain("tema");
    expect(matches[0].matchedTerms).toContain("programacion");
  });

  it("normaliza acentos y respeta el límite solicitado", () => {
    const matches = retrieveMemories("programacion tareas cuidado", memories, 2);
    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.score > 0)).toBe(true);
  });

  it("no devuelve recuerdos sin evidencia lexical", () => {
    expect(retrieveMemories("astronomía cuántica", memories)).toEqual([]);
  });
});
