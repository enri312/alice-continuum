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
  return <NucleusFrame code="[01]" title="Volumen cognitivo" description="Proyección 3D trazable de recuerdos persistentes y procesos cognitivos comprobados." activity={activity} activityStatus={activityStatus} footnote="Cada círculo corresponde a un registro real; cada rombo, a una recuperación actual o señal R3. Una línea violeta sólo aparece si dos fuentes siguen vigentes y vos confirmaste expresamente su relación. La posición es una distribución visual determinista, no anatomía cerebral.">
    <div className="nucleus-page-stage volume-page-stage"><NeuralVolume snapshot={effectiveSnapshot} activity={activity} associations={associations} associationStatus={associationStatus} invalidatedAssociationCount={invalidatedAssociationCount} /></div>
  </NucleusFrame>;
}
