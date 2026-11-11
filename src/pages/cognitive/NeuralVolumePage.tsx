import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { NeuralVolume } from "../../components/cognitive/NeuralVolume";
import { parseKnowledgeGraphVolumeProjection } from "../../core/memory/knowledge-graph-volume";
import type { KnowledgeGraphVolumeState } from "../../core/memory/knowledge-graph-volume";
import type { ConfirmedMemoryAssociation } from "../../core/cognitive/cognitive-volume";
import type { SelfStudySnapshot } from "../../core/memory/self-study";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "../shared/nucleus-shared";

type VolumePageProps = NucleusPageProps & { learningReady?: boolean; selfStudy?: SelfStudySnapshot | null };

export function Volumen(props: VolumePageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  const [associations, setAssociations] = useState<ConfirmedMemoryAssociation[]>([]);
  const [associationStatus, setAssociationStatus] = useState<KnowledgeGraphVolumeState>(props.desktopApp ? "loading" : "unavailable");
  const [invalidatedAssociationCount, setInvalidatedAssociationCount] = useState(0);
  const studyProgress = props.selfStudy ? {
    studied: props.selfStudy.records.length,
    available: props.selfStudy.records.filter(record => record.active && record.lastPassed && record.passes > 0).length,
    attempts: props.selfStudy.records.reduce((total, record) => total + record.attempts, 0),
    passes: props.selfStudy.records.reduce((total, record) => total + record.passes, 0),
  } : null;
  // Source identity/content changes invalidate the old R8 read immediately.
  // The canvas also checks evidence versions before drawing edges or quotes.
  const associationSourceKey = JSON.stringify(effectiveSnapshot.memoryNodes
    .map(node => [node.id, node.version, node.label, node.content ?? null]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
  useEffect(() => {
    setAssociations([]);
    setInvalidatedAssociationCount(0);
    setAssociationStatus(props.desktopApp ? "loading" : "unavailable");
    if (!props.desktopApp) return;
    let active = true;
    void Promise.all([invoke<unknown>("knowledge_graph_snapshot"), invoke<unknown>("knowledge_graph_associations")])
      .then(([snapshot, status]) => { if (active) { const projection = parseKnowledgeGraphVolumeProjection(snapshot, status); setAssociations(projection.associations); setInvalidatedAssociationCount(projection.invalidatedAssociationCount); setAssociationStatus(projection.state); } })
      .catch(() => { if (active) { setAssociations([]); setInvalidatedAssociationCount(0); setAssociationStatus("error"); } });
    return () => { active = false; };
  }, [props.desktopApp, associationSourceKey]);
  return <NucleusFrame code="[01]" title="Volumen cognitivo" description="Explora los recuerdos de Alice, la evidencia de actividad y el recorrido visual de las señales." activity={activity} activityStatus={activityStatus} footnote="Los nodos permiten inspeccionar recuerdos y procesos registrados. Verde: origen compartido; violeta: asociación confirmada; ámbar: demostración explícita. El contorno cerebral es ilustrativo y no mide neuronas, emociones ni conciencia.">
    <div className="nucleus-page-stage volume-page-stage"><NeuralVolume runtimeActive={activityStatus === "ready"} snapshot={effectiveSnapshot} activity={activity} associations={associations} associationStatus={associationStatus} invalidatedAssociationCount={invalidatedAssociationCount} learningReady={props.learningReady} studyProgress={studyProgress} /></div>
  </NucleusFrame>;
}
