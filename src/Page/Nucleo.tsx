import { NeuralVolume } from "../components/NeuralVolume";
import { NucleusFrame, type NucleusPageProps, useNucleusSnapshot } from "./nucleus-shared";

export function Nucleo(props: NucleusPageProps) {
  const { activity, activityStatus, effectiveSnapshot } = useNucleusSnapshot(props);
  return <NucleusFrame code="[01]" title="Volumen cognitivo" description="Estructura persistente y señal técnica reciente de Alice." activity={activity} activityStatus={activityStatus} footnote="La estructura persistente crece únicamente con recuerdos locales autorizados. La señal efímera usa eventos R3 de los últimos cinco minutos y decae hasta cero; su porcentaje es una heurística técnica reproducible.">
    <div className="nucleus-page-stage"><NeuralVolume snapshot={effectiveSnapshot} activity={activity} /></div>
  </NucleusFrame>;
}
