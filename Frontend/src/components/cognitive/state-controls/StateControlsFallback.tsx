import type { BrainSnapshot } from "../../../core/cognitive/brain";
import type { CoreActivitySnapshot } from "../../../core/cognitive/core-activity";
import { NucleusFrame, type NucleusActivityStatus } from "../../../pages/shared/nucleus-shared";
import { InternalState } from "../InternalState";
import { RetrievedMemoryInspector } from "../RetrievedMemory";

// Recovery only: keeps the same data and controls available if WASM cannot mount.
export function StateControlsFallback({ snapshot, activity, activityStatus, selectedId, onSelect, onControlChange }: {
  snapshot: BrainSnapshot; activity: CoreActivitySnapshot | null; activityStatus: NucleusActivityStatus;
  selectedId: string; onSelect: (id: string) => void; onControlChange?: (id: string, value: number) => void;
}) {
  const selected = snapshot.stateMetrics.find(item => item.id === selectedId)
    ?? snapshot.behaviorControls.find(item => item.id === selectedId) ?? snapshot.stateMetrics[0];
  return <NucleusFrame code="[03]" title="Estado y controles" description="Señales verificables, memoria recuperada y ajustes disponibles para el próximo envío." activity={activity} activityStatus={activityStatus} footnote="Los ajustes de estilo no conceden permisos. Las señales técnicas no representan emociones ni conciencia; los módulos pendientes conservan su bloqueo.">
    <div className="neuro-layout">
      <div className="neuro-stage"><InternalState snapshot={snapshot} selectedId={selectedId} onSelect={onSelect} onControlChange={onControlChange} /></div>
      <aside className="neuro-inspector">
        <p className="eyebrow">INSPECTOR</p>
        {selectedId === "retrieved-memory" ? <RetrievedMemoryInspector retrieval={snapshot.retrievedMemory} /> : <>
          <h3>{selected.label}</h3><span className="inspector-value">{selected.value.toFixed(3)}</span><p>{selected.detail}</p>
          <small>Creatividad y estilo empático se aplican a la conversación local. Los controles bloqueados conservan sus límites.</small>
        </>}
      </aside>
    </div>
  </NucleusFrame>;
}
