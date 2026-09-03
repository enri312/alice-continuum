import volumeSvg from "../../icons/cognitive-neural-volume.svg?raw";
import flowSvg from "../../icons/cognitive-evidence-flow.svg?raw";
import stateSvg from "../../icons/cognitive-state-controls.svg?raw";
import plannerSvg from "../../icons/cognitive-action-planner.svg?raw";
import { InlineSvgIcon } from "./InlineSvgIcon";

export type NucleusViewIconKind = "volume" | "flow" | "state" | "planner";

type NucleusViewIconProps = {
  kind: NucleusViewIconKind;
  active: boolean;
};

const sources: Record<NucleusViewIconKind, string> = {
  volume: volumeSvg,
  flow: flowSvg,
  state: stateSvg,
  planner: plannerSvg,
};

export function NucleusViewIcon({ kind, active }: NucleusViewIconProps) {
  return <InlineSvgIcon className={`neuro-view-icon ${active ? "is-active" : ""}`} markup={sources[kind]} />;
}
