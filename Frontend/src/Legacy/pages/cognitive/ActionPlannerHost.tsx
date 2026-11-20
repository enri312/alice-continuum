import { useState } from "react";
import { DioxusRouteHost } from "../../components/cognitive/state-controls/DioxusRouteHost";
import { createPlannerTransport, localReminderMinimum } from "../../../core/governance/planner-transport";
import type { NucleusPageProps } from "../shared/nucleus-shared";
import "../../../styles/task-registry.css";
import "../../../styles/task-engine.css";

const loadPlanner = () => import("../../../components/cognitive/state-controls/runtime").then(module => module.loadPlannerPageRuntime());

export function Planificador({ snapshot, desktopApp }: NucleusPageProps) {
  const [minimum] = useState(localReminderMinimum);
  return <DioxusRouteHost renderer="planner" name="Planificador" load={loadPlanner} createTransport={createPlannerTransport}
    configuration={JSON.stringify({
      type: "configure", desktopApp, focus: snapshot.focus, persistentMemoryCount: snapshot.persistentMemoryCount, minimum,
    })} />;
}
