import conversationSvg from "../../icons/nav-conversation.svg?raw";
import nucleusSvg from "../../icons/nav-nucleus.svg?raw";
import memorySvg from "../../icons/nav-memory.svg?raw";
import activitySvg from "../../icons/nav-activity.svg?raw";
import auditSvg from "../../icons/nav-audit.svg?raw";
import bridgesSvg from "../../icons/nav-bridges.svg?raw";
import avatarSvg from "../../icons/nav-avatar.svg?raw";
import identificationSvg from "../../icons/nav-identification.svg?raw";
import settingsSvg from "../../icons/nav-settings.svg?raw";
import skillsSvg from "../../icons/nav-skills.svg?raw";
import proceduresSvg from "../../icons/nav-procedures.svg?raw";
import faceSvg from "../../icons/bridge-face.svg?raw";
import bodySvg from "../../icons/bridge-body.svg?raw";
import volumeSvg from "../../icons/nucleus-volume.svg?raw";
import flowSvg from "../../icons/nucleus-flow.svg?raw";
import stateSvg from "../../icons/nucleus-state.svg?raw";
import plannerSvg from "../../icons/nucleus-planner.svg?raw";
import { InlineSvgIcon } from "./InlineSvgIcon";

export type NavigationIconKind = "conversation" | "nucleus" | "memory" | "activity" | "audit" | "bridges" | "avatar" | "identification" | "settings" | "skills" | "procedures" | "face" | "body" | "volume" | "flow" | "state" | "planner";

type NavigationIconProps = {
  kind: NavigationIconKind;
  active: boolean;
};

const sources: Record<NavigationIconKind, string> = {
  conversation: conversationSvg,
  nucleus: nucleusSvg,
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
