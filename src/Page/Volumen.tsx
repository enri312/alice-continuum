import { NeuralVolume } from "../components/NeuralVolume";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Volumen(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  return <NucleusFrame code="[01]" title="Volumen cognitivo" description="Proyección 3D trazable de recuerdos persistentes y procesos cognitivos comprobados." activity={activity} activityStatus={activityStatus} footnote="Cada círculo corresponde a un registro real; cada rombo, a una recuperación actual o señal R3. La posición es una distribución visual determinista, no anatomía cerebral. Sin evidencia de asociación no se dibujan aristas persistentes.">
    <div className="nucleus-page-stage volume-page-stage"><NeuralVolume snapshot={effectiveSnapshot} activity={activity} /></div>
  </NucleusFrame>;
}
