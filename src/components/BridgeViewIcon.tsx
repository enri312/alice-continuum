import overviewSvg from "../../icons/bridge-overview.svg?raw";
import faceSvg from "../../icons/bridge-face.svg?raw";
import bodySvg from "../../icons/bridge-body.svg?raw";
import { InlineSvgIcon } from "./InlineSvgIcon";

export type BridgeViewIconKind = "overview" | "face" | "body";

type BridgeViewIconProps = {
  kind: BridgeViewIconKind;
  active: boolean;
};

const sources: Record<BridgeViewIconKind, string> = {
  overview: overviewSvg,
  face: faceSvg,
  body: bodySvg,
};

export function BridgeViewIcon({ kind, active }: BridgeViewIconProps) {
  return <InlineSvgIcon className={`bridge-view-icon ${active ? "is-active" : ""}`} markup={sources[kind]} />;
}
