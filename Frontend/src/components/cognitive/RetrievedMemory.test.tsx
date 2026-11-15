import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { beginMemoryRetrieval, completeMemoryRetrieval, emptyMemoryRetrieval, failMemoryRetrieval, prepareMemoryRetrieval, projectMemoryRetrieval } from "../../core/memory/retrieval-observation";
import { RetrievedMemoryInspector, RetrievedMemoryPanel } from "./RetrievedMemory";

const episode = { id: "episode", kind: "Conversación", intention: "Quiero practicar fracciones", source: "Conversación local" };
const prepared = prepareMemoryRetrieval([{ memory: episode, score: 7.425 }], "lexical");

describe("fila de memoria recuperada e inspector", () => {
  it("representa un episodio recuperado y mantiene separadas la preparación y la respuesta", () => {
    for (const observation of [prepared, completeMemoryRetrieval(beginMemoryRetrieval(prepared), "response-1", "full")]) {
      const retrieval = projectMemoryRetrieval(observation, [episode]);
      const panel = renderToStaticMarkup(<RetrievedMemoryPanel retrieval={retrieval} selected onSelect={() => {}} />);
      const inspector = renderToStaticMarkup(<RetrievedMemoryInspector retrieval={retrieval} />);
      expect(panel).toContain("<span>EPISÓDICA</span><strong>USUARIO: Quiero practicar fracciones → Alice</strong>");
      expect(panel).toContain('title="Puntuación léxica, no probabilidad">7.425</em>');
      expect(panel).not.toContain("<small>");
      expect(panel).not.toContain("TEST DE PERSONALIDAD");
      expect(inspector).toContain("Fuente: Conversación local.");
      expect(inspector).toContain(observation.phase === "prepared" ? "todavía no se han enviado al modelo" : "esto no prueba que haya determinado la respuesta");
    }
  });

  it("conserva la categoría de autoestudio y muestra el rango sin convertirlo en probabilidad", () => {
    const lesson = { id: "lesson", intention: "Fracciones equivalentes", memoryType: "semantic" as const, studyLearning: true, studyState: "available" as const, studyPasses: 1 };
    const retrieval = projectMemoryRetrieval(prepareMemoryRetrieval([{ memory: lesson, rank: 2 }], "rank"), [lesson]);
    const panel = renderToStaticMarkup(<RetrievedMemoryPanel retrieval={retrieval} selected={false} onSelect={() => {}} />);
    expect(panel).toContain("<span>SEMÁNTICA</span><strong>Fracciones equivalentes</strong>");
    expect(panel).toContain('title="Rango de recuperación">#2</em>');
    expect(panel).not.toContain("USUARIO:");
    expect(panel).not.toContain("0.503");
  });

  it("conserva la ausencia de recuerdos en reposo y ante fallo", () => {
    const idleRetrieval = projectMemoryRetrieval(emptyMemoryRetrieval(), []);
    const panel = renderToStaticMarkup(<RetrievedMemoryPanel retrieval={idleRetrieval} selected={false} onSelect={() => {}} />);
    expect(panel).toContain("SIN RECUERDOS RECUPERADOS");
    expect(panel).not.toContain("TEST DE PERSONALIDAD");
    expect(panel).not.toContain("0.503");

    const failedRetrieval = projectMemoryRetrieval(failMemoryRetrieval(prepared), []);
    const failedPanel = renderToStaticMarkup(<RetrievedMemoryPanel retrieval={failedRetrieval} selected={false} onSelect={() => {}} />);
    expect(failedPanel).toContain("SIN RECUERDOS RECUPERADOS");
  });

  it("oculta el episodio completo y su puntuación cuando el recibo sólo confirma contexto limitado", () => {
    const retrieval = projectMemoryRetrieval(completeMemoryRetrieval(beginMemoryRetrieval(prepared), "vision:1", "limited"), [episode]);
    const markup = renderToStaticMarkup(<><RetrievedMemoryPanel retrieval={retrieval} selected onSelect={() => {}} /><RetrievedMemoryInspector retrieval={retrieval} /></>);
    expect(markup).toContain("CONTEXTO LIMITADO");
    expect(markup).not.toContain(episode.intention);
    expect(markup).not.toContain(episode.source);
    expect(markup).not.toContain("7.425");
  });
});
