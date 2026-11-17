import registry from "../../../icons/governance-capability-registry.svg?url";
import permissions from "../../../icons/governance-permissions-gateway.svg?url";

export function BridgeViewIcon({ kind }: { kind: "registry" | "permissions" }) {
  return <img src={kind === "registry" ? registry : permissions} width="34" height="34" alt="" />;
}
