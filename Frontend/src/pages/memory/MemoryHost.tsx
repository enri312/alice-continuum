import { lazy, Suspense, useCallback, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { createMemoryPageTransport, type MaintenanceView } from "../../core/memory/memory-page-transport";
import {
  clearWorkingMemory, discardMemory, exportMemory, memorySessionSnapshot, openMemoryDirectory,
  reloadMemoryFromDisk, restoreMemory, reviewMemory, subscribeToMemory, updateMemory,
} from "../../core/memory/memory-session";
import "../../styles/memory-navigation.css";
import "../../styles/automatic-memory.css";

const load = () => import("../../components/cognitive/state-controls/runtime").then(module => module.loadMemoryPageRuntime());
const Maintenance = lazy(() => import("../../Legacy/pages/memory/MemoryVaultPage").then(module => ({ default: module.Memoria })));
const initialViews = new Set(["learning", "records", "working", "profile", "review", "layers", "consolidate", "safety"]);

export function Memoria({ desktopApp }: { desktopApp: boolean }) {
  const slot = `alice-memory-maintenance-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const [view] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("memoryView");
    return value && initialViews.has(value) ? value : "learning";
  });
  const [maintenance, setMaintenance] = useState<MaintenanceView | null>(null);
  const transport = useRef<ReturnType<typeof createMemoryPageTransport> | null>(null);
  const createTransport = useCallback(() => {
    const controller = createMemoryPageTransport(setMaintenance);
    transport.current = controller;
    return { ...controller, dispose() {
      transport.current = null;
      controller.dispose();
      setMaintenance(null);
    } };
  }, []);
  const editRecord = useCallback((id: string) => transport.current?.openEditor(id), []);
  const maintenanceStatus = useCallback((section: MaintenanceView, count: number | null, busy: boolean) => transport.current?.reportMaintenance(section, count, busy), []);
  const target = maintenance ? document.getElementById(slot) : null;
  return <>
    <DioxusRouteHost renderer="memory" name="Memoria" load={load} createTransport={createTransport}
      configuration={JSON.stringify({ type: "configure", setup: { slot, view, desktop: desktopApp } })} />
    {maintenance && target && createPortal(
      <Suspense fallback={<p className="memory-operation-message" role="status">Preparando mantenimiento…</p>}>
        <MaintenanceSlot view={maintenance} onEditRecord={editRecord} onStatus={maintenanceStatus} />
      </Suspense>, target,
    )}
  </>;
}

function MaintenanceSlot({ view, onEditRecord, onStatus }: { view: MaintenanceView; onEditRecord: (id: string) => void; onStatus: (view: MaintenanceView, count: number | null, busy: boolean) => void }) {
  const { sessions, ownerProfile, workingMemory, memoryStatus, memoryPath } = useSyncExternalStore(subscribeToMemory, memorySessionSnapshot);
  const report = useCallback((count: number | null, busy: boolean) => onStatus(view, count, busy), [view, onStatus]);
  return <Maintenance maintenanceView={view} onOpenRecordEditor={onEditRecord} onMaintenanceStatus={report}
    sessions={sessions} ownerProfile={ownerProfile} workingMemory={workingMemory} onClearWorkingMemory={clearWorkingMemory}
    onUpdate={updateMemory} onDelete={discardMemory} onReview={reviewMemory} onExport={exportMemory} onRestore={restoreMemory}
    onReloadMemory={reloadMemoryFromDisk} onOpenDirectory={openMemoryDirectory} storageStatus={memoryStatus} storagePath={memoryPath} />;
}
