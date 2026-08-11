import conversationSvg from "../../icons/nav-conversation.svg?raw";
import nucleusSvg from "../../icons/nav-nucleus.svg?raw";
import memorySvg from "../../icons/nav-memory.svg?raw";
import activitySvg from "../../icons/nav-activity.svg?raw";
import bridgesSvg from "../../icons/nav-bridges.svg?raw";
import avatarSvg from "../../icons/nav-avatar.svg?raw";
import identificationSvg from "../../icons/nav-identification.svg?raw";
import settingsSvg from "../../icons/nav-settings.svg?raw";
import skillsSvg from "../../icons/nav-skills.svg?raw";
import { InlineSvgIcon } from "./InlineSvgIcon";

export type NavigationIconKind = "conversation" | "nucleus" | "memory" | "activity" | "bridges" | "avatar" | "identification" | "settings" | "skills";

type NavigationIconProps = {
  kind: NavigationIconKind;
  active: boolean;
};

const sources: Record<NavigationIconKind, string> = {
  conversation: conversationSvg,
  nucleus: nucleusSvg,
  memory: memorySvg,
  activity: activitySvg,
  bridges: bridgesSvg,
  avatar: avatarSvg,
  identification: identificationSvg,
  settings: settingsSvg,
  skills: skillsSvg,
};

export function NavigationIcon({ kind, active }: NavigationIconProps) {
  return <InlineSvgIcon className={`screen-tab-icon icon-${kind} ${active ? "is-active" : ""}`} markup={sources[kind]} />;
}
