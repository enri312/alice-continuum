import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { instrument } from "./shared/instrument.mjs";
import { cameraScenes } from "./scenes/camera-controls.mjs";
import capabilities from "./scenes/governance-capability-registry.mjs";
import face from "./scenes/embodiment-face-calibration.mjs";
import body from "./scenes/embodiment-body-solver.mjs";
import activity from "./scenes/cognitive-activity-timeline.mjs";
import audit from "./scenes/governance-audit-diagnostics.mjs";
import avatar from "./scenes/embodiment-avatar-vrm.mjs";
import gateway from "./scenes/governance-permissions-gateway.mjs";
import identification from "./scenes/cognitive-conversation-channel.mjs";
import memory from "./scenes/cognitive-memory-vault.mjs";
import procedures from "./scenes/governance-procedure-observer.mjs";
import settings from "./scenes/governance-system-settings.mjs";
import skills from "./scenes/governance-skill-workshop.mjs";
import flow from "./scenes/cognitive-evidence-flow.mjs";
import planner from "./scenes/cognitive-action-planner.mjs";
import state from "./scenes/cognitive-state-controls.mjs";
import volume from "./scenes/cognitive-neural-volume.mjs";

const definitions = [
  ["governance-capability-registry.svg", "capabilities", "Registro de capacidades", "capability-registry domain-inventory maturity-state-health read-only-inspection", "#22d3ee", "#34d399"],
  ["embodiment-face-calibration.svg", "face", "Rostro", "face-calibration camera-off landmarks-reserved", "#22d3ee", "#f472b6"],
  ["embodiment-body-solver.svg", "body", "Cuerpo", "body-solver rig inverse-kinematics no-sensor-data", "#facc15", "#4ade80"],
  ["cognitive-activity-timeline.svg", "activity", "Actividad", "live-timeline cognitive-events", "#84cc16", "#22d3ee"],
  ["governance-audit-diagnostics.svg", "audit", "Auditoría y diagnóstico", "audit integrity diagnostic evidence", "#fb7185", "#60a5fa"],
  ["embodiment-avatar-vrm.svg", "avatar", "Avatar", "local-vrm-inspection rig manual-motor read-only-boundaries", "#f472b6", "#38bdf8"],
  ["governance-permissions-gateway.svg", "gateway", "Capacidades y permisos", "permission-gateway grants leases revocation", "#38bdf8", "#fb923c"],
  ["cognitive-conversation-channel.svg", "identification", "Conversación con Alice", "conversation-channel text-dialogue filtered-voice-session contextual-vision speech-output", "#22d3ee", "#8b5cf6"],
  ["cognitive-memory-vault.svg", "memory", "Memoria", "layered-memory rag lifecycle archive backup", "#60a5fa", "#a78bfa"],
  ["governance-procedure-observer.svg", "procedures", "Procedimientos", "observed-repetition evidence owner-decision", "#10b981", "#f59e0b"],
  ["governance-system-settings.svg", "settings", "Configuración", "settings inference privacy hardware fiber-optic-bus", "#22d3ee", "#fb923c"],
  ["governance-skill-workshop.svg", "skills", "Taller de habilidades", "skill-workshop draft simulation approval", "#a78bfa", "#22d3ee"],
  ["cognitive-evidence-flow.svg", "flow", "Flujo cognitivo", "cognitive-flow evidenced-links input-memory-output", "#8b5cf6", "#ec4899"],
  ["cognitive-action-planner.svg", "planner", "Planificador", "governed-arbitration empty-planning-bench uncalculated-metrics no-selection no-execution owner-temporal-dock", "#f59e0b", "#38bdf8"],
  ["cognitive-state-controls.svg", "state", "Estado y controles", "observable-internal-state technical-signals session-controls retrieved-memory", "#10b981", "#f59e0b"],
  ["cognitive-neural-volume.svg", "volume", "Volumen cognitivo", "organic-neural-volume cortex dendrites memories provenance", "#22d3ee", "#8b5cf6"],
  ["camera-pan-control.svg", "pan", "Desplazar vista", "camera pan tactile-control", "#38bdf8", "#22d3ee"],
  ["camera-reset-control.svg", "reset", "Restablecer vista", "camera reset home-dock", "#a78bfa", "#f472b6"],
  ["camera-orbit-control.svg", "rotate", "Rotar vista", "camera three-axis orbit", "#22d3ee", "#fb923c"],
  ["camera-zoom-in-control.svg", "zoom-in", "Acercar vista", "camera optical zoom-in", "#34d399", "#22d3ee"],
  ["camera-zoom-out-control.svg", "zoom-out", "Alejar vista", "camera optical zoom-out", "#fb923c", "#ef4444"],
];

const scenes = { capabilities, face, body, activity, audit, avatar, gateway, identification, memory, procedures, settings, skills, flow, planner, state, volume, ...cameraScenes };
const requested = new Set(process.argv.slice(2));
const selected = requested.size ? definitions.filter(([file]) => requested.has(file)) : definitions;
if (requested.size && selected.length !== requested.size) {
  throw new Error("Nombre desconocido. Usá el nombre de un SVG funcional de Frontend/icons/.");
}
for (const [file, id, title, semantic, accent, secondary] of selected) {
  const art = scenes[id](accent, secondary);
  const svg = instrument({ id, title, semantic, accent, secondary, art });
  writeFileSync(fileURLToPath(new URL(`../../Frontend/icons/${file}`, import.meta.url)), svg, "utf8");
}
console.log(`Iconos funcionales generados: ${selected.length}`);
