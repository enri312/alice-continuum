import memorySvg from "../../../icons/cognitive-memory-vault.svg?raw";
import activitySvg from "../../../icons/cognitive-activity-timeline.svg?raw";
import auditSvg from "../../../icons/governance-audit-diagnostics.svg?raw";
import bridgesSvg from "../../../icons/governance-permissions-gateway.svg?raw";
import avatarSvg from "../../../icons/embodiment-avatar-vrm.svg?raw";
import identificationSvg from "../../../icons/cognitive-input-identification.svg?raw";
import settingsSvg from "../../../icons/governance-system-settings.svg?raw";
import skillsSvg from "../../../icons/governance-skill-workshop.svg?raw";
import proceduresSvg from "../../../icons/governance-procedure-observer.svg?raw";
import faceSvg from "../../../icons/embodiment-face-calibration.svg?raw";
import bodySvg from "../../../icons/embodiment-body-solver.svg?raw";
import volumeSvg from "../../../icons/cognitive-neural-volume.svg?raw";
import flowSvg from "../../../icons/cognitive-evidence-flow.svg?raw";
import stateSvg from "../../../icons/cognitive-state-controls.svg?raw";
import plannerSvg from "../../../icons/cognitive-action-planner.svg?raw";
import { InlineSvgIcon } from "./InlineSvgIcon";

export type NavigationIconKind = "memory" | "activity" | "audit" | "bridges" | "avatar" | "identification" | "settings" | "skills" | "procedures" | "face" | "body" | "volume" | "flow" | "state" | "planner";

type NavigationIconProps = {
  kind: NavigationIconKind;
  active: boolean;
};

const sources: Record<NavigationIconKind, string> = {
  memory: memorySvg,
  activity: activitySvg,
  audit: auditSvg,
  bridges: bridgesSvg,
  avatar: avatarSvg,
  identification: identificationSvg,
  settings: settingsSvg,
  skills: skillsSvg,
  procedures: proceduresSvg,
  face: faceSvg,
  body: bodySvg,
  volume: volumeSvg,
  flow: flowSvg,
  state: stateSvg,
  planner: plannerSvg,
};

export function NavigationIcon({ kind, active }: NavigationIconProps) {
  return <InlineSvgIcon className={`screen-tab-icon icon-${kind} ${active ? "is-active" : ""}`} markup={sources[kind]} />;
}
