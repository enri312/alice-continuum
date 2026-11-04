import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NeuralVolume } from "../../components/cognitive/NeuralVolume";
import { parseKnowledgeGraphVolumeProjection } from "../../core/memory/knowledge-graph-volume";
import type { KnowledgeGraphVolumeState } from "../../core/memory/knowledge-graph-volume";
import type { ConfirmedMemoryAssociation } from "../../core/cognitive/cognitive-volume";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "../shared/nucleus-shared";

export function Volumen(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [associations, setAssociations] = useState<ConfirmedMemoryAssociation[]>([]);
  const [associationStatus, setAssociationStatus] = useState<KnowledgeGraphVolumeState>(props.desktopApp ? "loading" : "unavailable");
  const [invalidatedAssociationCount, setInvalidatedAssociationCount] = useState(0);
  useEffect(() => {
    if (!props.desktopApp) { setAssociations([]); setInvalidatedAssociationCount(0); setAssociationStatus("unavailable"); return; }
    let active = true;
    void Promise.all([invoke<unknown>("knowledge_graph_snapshot"), invoke<unknown>("knowledge_graph_associations")])
      .then(([snapshot, status]) => { if (active) { const projection = parseKnowledgeGraphVolumeProjection(snapshot, status); setAssociations(projection.associations); setInvalidatedAssociationCount(projection.invalidatedAssociationCount); setAssociationStatus(projection.state); } })
      .catch(() => { if (active) { setAssociations([]); setInvalidatedAssociationCount(0); setAssociationStatus("error"); } });
    return () => { active = false; };
  }, [props.desktopApp]);
  return <NucleusFrame code="[01]" title="Volumen cognitivo" description="Una red viva de recuerdos guardados, aprendizaje automático y procesos observables de Alice." activity={activity} activityStatus={activityStatus} footnote="Cada nodo abre un recuerdo real. Verde: recuerdos del mismo intercambio; violeta: asociación confirmada. El contorno cerebral y las ramificaciones son ilustrativos.">
    <div className="nucleus-page-stage volume-page-stage"><NeuralVolume runtimeActive={activityStatus === "ready"} snapshot={effectiveSnapshot} activity={activity} associations={associations} associationStatus={associationStatus} invalidatedAssociationCount={invalidatedAssociationCount} /></div>
  </NucleusFrame>;
}
