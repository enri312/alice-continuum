import { useState } from "react";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { createMemoryPageTransport } from "../../core/memory/memory-page-transport";
import "../../styles/memory-navigation.css";
import "../../styles/automatic-memory.css";

const load = () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadMemoryPageRuntime());
const initialViews = new Set(["learning", "records", "working", "profile", "review", "layers", "consolidate", "safety"]);

export function Memoria({ desktopApp }: { desktopApp: boolean }) {
  const [view] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("memoryView");
    return value && initialViews.has(value) ? value : "learning";
  });
  return <DioxusRouteHost renderer="memory" name="Memoria" load={load} createTransport={createMemoryPageTransport}
    configuration={JSON.stringify({ type: "configure", setup: { view, desktop: desktopApp } })} />;
}
