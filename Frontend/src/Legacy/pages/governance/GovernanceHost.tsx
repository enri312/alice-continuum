import { useCallback, useRef } from "react";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { createProcedureTransport } from "../../../core/governance/procedure-transport";
import { createRegistryTransport } from "../../../core/governance/registry-transport";
import { createSkillTransport } from "../../../core/governance/skill-transport";

const load = () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadGovernanceRuntime());
const names = { registry: "Capacidades y permisos", procedures: "Procedimientos", skills: "Taller de habilidades" };
type View = keyof typeof names;

export function GovernanceHost({ view, desktopApp, onOpenAudit }: {
  view: View;
  desktopApp: boolean;
  onOpenAudit?: (capability?: string) => void;
}) {
  const audit = useRef(onOpenAudit);
  audit.current = onOpenAudit;
  const createTransport = useCallback(() => {
    if (view === "procedures") return createProcedureTransport(desktopApp);
    if (view === "skills") return createSkillTransport(desktopApp);
    return createRegistryTransport(capability => audit.current?.(capability));
  }, [view, desktopApp]);
  return <DioxusRouteHost renderer={view} name={names[view]} load={load} createTransport={createTransport}
    configuration={JSON.stringify({ type: "configure", view, desktop: desktopApp })} />;
}
