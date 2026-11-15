import { lazy, Suspense, useEffect, useId, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startStateControlsView, type ViewStatus } from "../cognitive/state-controls/lifecycle";
import { startAssociationsTransport } from "./associations-transport";
import "../documents/DocumentPreview.css";

const Recovery = lazy(() => import("./MemoryAssociationsFallback").then(module => ({ default: module.MemoryAssociationsFallback })));

function Preparing({ desktopApp }: { desktopApp: boolean }) {
  return <section className="perception-vector document-preview memory-associations" aria-labelledby="associations-title">
    <header><h3 id="associations-title">RELACIONES ENTRE RECUERDOS</h3></header>
    <p>Relacioná dos experiencias por decisión tuya. Una relación confirmada expresa tu criterio; no demuestra causalidad ni convierte respuestas del modelo en hechos.</p>
    {desktopApp ? <><button type="button" disabled>Actualizar relaciones</button><p role="status">Preparando relaciones…</p></>
      : <p>Disponible en la aplicación de escritorio.</p>}
  </section>;
}

// Mount/IPC adapter only; normal drafts, operations and confirmation state live in Rust.
export function MemoryAssociations({ desktopApp }: { desktopApp: boolean }) {
  const root = `alice-associations-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [status, setStatus] = useState<ViewStatus>("loading");
  useEffect(() => {
    setStatus("loading");
    const transport = startAssociationsTransport(invoke, response => view.update(JSON.stringify(response)));
    const view = startStateControlsView({
      root, initial: JSON.stringify({ type: "configure", desktopApp }),
      load: () => import("../cognitive/state-controls/runtime").then(module => module.loadAssociationsRuntime()),
      onAction: transport.accept,
      onStatus: next => { if (next === "error") transport.dispose(); setStatus(next); },
    });
    return () => { transport.dispose(); view.dispose(); };
  }, [root, desktopApp]);
  return <div data-associations-renderer={status === "ready" ? "dioxus" : status === "error" ? "react" : "loading"}>
    {status === "loading" && <Preparing desktopApp={desktopApp} />}
    {status === "error" && <>
      <p role="status">Relaciones de respaldo activas.</p>
      <Suspense fallback={<Preparing desktopApp={desktopApp} />}><Recovery desktopApp={desktopApp} /></Suspense>
    </>}
    <div id={root} hidden={status !== "ready"} />
  </div>;
}
