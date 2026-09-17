import { describe, expect, it } from "vitest";
import bridgeBody from "../../../icons/embodiment-body-solver.svg?raw";
import bridgeFace from "../../../icons/embodiment-face-calibration.svg?raw";
import bridgeOverview from "../../../icons/governance-capability-registry.svg?raw";
import navActivity from "../../../icons/cognitive-activity-timeline.svg?raw";
import navAudit from "../../../icons/governance-audit-diagnostics.svg?raw";
import navAvatar from "../../../icons/embodiment-avatar-vrm.svg?raw";
import navBridges from "../../../icons/governance-permissions-gateway.svg?raw";
import navIdentification from "../../../icons/cognitive-input-identification.svg?raw";
import navMemory from "../../../icons/cognitive-memory-vault.svg?raw";
import navProcedures from "../../../icons/governance-procedure-observer.svg?raw";
import navSettings from "../../../icons/governance-system-settings.svg?raw";
import navSkills from "../../../icons/governance-skill-workshop.svg?raw";
import nucleusFlow from "../../../icons/cognitive-evidence-flow.svg?raw";
import nucleusPlanner from "../../../icons/cognitive-action-planner.svg?raw";
import nucleusState from "../../../icons/cognitive-state-controls.svg?raw";
import nucleusVolume from "../../../icons/cognitive-neural-volume.svg?raw";
import viewPan from "../../../icons/camera-pan-control.svg?raw";
import viewReset from "../../../icons/camera-reset-control.svg?raw";
import viewRotate from "../../../icons/camera-orbit-control.svg?raw";
import viewZoomIn from "../../../icons/camera-zoom-in-control.svg?raw";
import viewZoomOut from "../../../icons/camera-zoom-out-control.svg?raw";
import appAlice from "../../../icons/app-alice.svg?raw";

const iconFileNames = Object.keys(import.meta.glob("../../../icons/*.svg", { query: "?raw", import: "default" }))
  .map((path) => path.split("/").at(-1))
  .sort();

const expectedIconFileNames = [
  "app-alice.svg",
  "camera-orbit-control.svg",
  "camera-pan-control.svg",
  "camera-reset-control.svg",
  "camera-zoom-in-control.svg",
  "camera-zoom-out-control.svg",
  "cognitive-action-planner.svg",
  "cognitive-activity-timeline.svg",
  "cognitive-evidence-flow.svg",
  "cognitive-input-identification.svg",
  "cognitive-memory-vault.svg",
  "cognitive-neural-volume.svg",
  "cognitive-state-controls.svg",
  "embodiment-avatar-vrm.svg",
  "embodiment-body-solver.svg",
  "embodiment-face-calibration.svg",
  "governance-audit-diagnostics.svg",
  "governance-capability-registry.svg",
  "governance-permissions-gateway.svg",
  "governance-procedure-observer.svg",
  "governance-skill-workshop.svg",
  "governance-system-settings.svg",
].sort();

const functionalIcons = {
  bridgeBody, bridgeFace, bridgeOverview, navActivity, navAudit, navAvatar,
  navBridges, navIdentification, navMemory, navProcedures, navSettings, navSkills,
  nucleusFlow, nucleusPlanner, nucleusState, nucleusVolume, viewPan, viewReset,
  viewRotate, viewZoomIn, viewZoomOut,
};

const expectedSemantics: Record<keyof typeof functionalIcons, string> = {
  bridgeBody: "body-solver rig inverse-kinematics no-sensor-data",
  bridgeFace: "face-calibration camera-off landmarks-reserved",
  bridgeOverview: "capability-registry domain-inventory maturity-state-health read-only-inspection",
  navActivity: "live-timeline cognitive-events",
  navAudit: "audit integrity diagnostic evidence",
  navAvatar: "local-vrm-inspection rig manual-motor read-only-boundaries",
  navBridges: "permission-gateway grants leases revocation",
  navIdentification: "local-perception-diagnostic real-input tokenization provenance heuristic-intent",
  navMemory: "layered-memory rag lifecycle archive backup",
  navProcedures: "observed-repetition evidence owner-decision",
  navSettings: "settings inference privacy hardware fiber-optic-bus",
  navSkills: "skill-workshop draft simulation approval",
  nucleusFlow: "cognitive-flow evidenced-links input-memory-output",
  nucleusPlanner: "governed-arbitration empty-planning-bench uncalculated-metrics no-selection no-execution owner-temporal-dock",
  nucleusState: "observable-internal-state readiness controls",
  nucleusVolume: "stereoscopic-neural-volume memories processes associations routes",
  viewPan: "camera pan tactile-control",
  viewReset: "camera reset home-dock",
  viewRotate: "camera three-axis orbit",
  viewZoomIn: "camera optical zoom-in",
  viewZoomOut: "camera optical zoom-out",
};

describe("sistema de iconos funcionales", () => {
  it("usa nombres descriptivos por dominio y función", () => {
    expect(iconFileNames).toEqual(expectedIconFileNames);
  });

  it("mantiene el catálogo utilizado y con diseños distintos", () => {
    const sources = Object.values(functionalIcons);
    expect(sources).toHaveLength(21);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("distingue actividad temporal de auditoría forense", () => {
    expect(navActivity).toContain('data-semantic="live-timeline cognitive-events"');
    expect(navAudit).toContain('data-semantic="audit integrity diagnostic evidence"');
    expect(navAudit).not.toBe(navActivity);
  });

  it.each(Object.entries(expectedSemantics))(
    "%s representa el contenido real de su pantalla",
    (name, semantic) => {
      const source = functionalIcons[name as keyof typeof functionalIcons];
      expect(source).toContain(`data-semantic="${semantic}"`);
      expect(source).toContain(`data-symbol="${semantic}"`);
    },
  );

  it.each(Object.entries(functionalIcons))("%s declara una fuente SVG utilizable", (_name, source) => {
    expect(source).toMatch(/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/);
    expect(source).toContain('viewBox="0 0 200 200"');
    expect(source).toContain('role="img"');
    expect(source).toMatch(/aria-label="[^"]+"/);
    expect(source).toMatch(/<title>[^<]+<\/title>/);
    expect(source).toContain("<defs>");
    expect(source).toMatch(/<(?:linearGradient|radialGradient)\b/);
    expect(source).toMatch(/<(?:path|circle|rect|polygon|ellipse)\b/);
  });

  it.each(Object.entries(functionalIcons))("%s es local y no ejecutable", (_name, source) => {
    expect(source).not.toMatch(/<script\b/i);
    expect(source).not.toMatch(/\son[a-z]+\s*=/i);
    expect(source).not.toMatch(/@import\b/i);
    expect(source).not.toMatch(/(?:href|src)=["'](?:https?:|data:|\/\/)/i);
    expect(source).not.toMatch(/<foreignObject\b/i);
  });

  it.each(Object.entries(functionalIcons))("%s mantiene accesibilidad de movimiento", (_name, source) => {
    expect(source).toMatch(/animation:/);
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain('class="alive"');
    expect(source).toContain('data-motion="semantic-micro-motion"');
  });

  it.each(Object.entries(functionalIcons))("%s no dibuja texto dentro del icono", (_name, source) => {
    expect(source).not.toMatch(/<text\b/i);
    expect(source).not.toMatch(/font-family\s*=/i);
    expect(source).not.toMatch(/<pattern\b/i);
    expect(source).not.toContain("M45 62V47");
    expect(source).toMatch(/data-semantic="[^"]+"/);
    expect(source).toContain('data-detail-scale="navigation-readable"');
    expect(source).toContain('data-detail-pass="precision-finish-v15"');
    expect(source).toContain('data-component-refinement="precision-components-v15"');
    expect(source).toContain('data-material-finish="micro-etched-v15"');
    expect(source).toContain('data-mounting-grammar="equipment-mounted-controls-independent"');
    expect(source).toContain('data-detail="micro-surface-finish"');
    expect(source).toContain('data-line-treatment="refined"');
    expect(source).toContain('data-screw-style="layered-hex-socket"');
    expect(source).toContain('data-detail="hex-socket-screw"');
    expect(source).toContain('data-detail="screw-machining-index"');
  });

  it.each(Object.entries(functionalIcons))("%s mantiene calibrados todos sus nodos estratificados", (_name, source) => {
    const nodes = source.match(/data-detail="layered-signal-node"/g) ?? [];
    const indexes = source.match(/data-detail="node-calibration-index"/g) ?? [];
    const contacts = source.match(/data-detail="node-contact-points"/g) ?? [];
    expect(indexes).toHaveLength(nodes.length);
    expect(contacts).toHaveLength(nodes.length);
    const sockets = source.match(/data-detail="keyed-interface-socket"/g) ?? [];
    const lockTabs = source.match(/data-detail="interface-lock-tabs"/g) ?? [];
    expect(lockTabs).toHaveLength(sockets.length);
    const bearings = source.match(/data-detail="articulated-bearing"/g) ?? [];
    const retainers = source.match(/data-detail="bearing-retainer-ring"/g) ?? [];
    expect(retainers).toHaveLength(bearings.length);
    const statusCells = source.match(/data-detail="precision-status-cell"/g) ?? [];
    const statusContacts = source.match(/data-detail="status-cell-contacts"/g) ?? [];
    expect(statusContacts).toHaveLength(statusCells.length);
  });

  it.each(Object.entries(functionalIcons))("%s limita los trazos gruesos después del acabado de precisión", (_name, source) => {
    const widths = [...source.matchAll(/stroke-width="([0-9.]+)"/g)].map((match) => Number(match[1]));
    expect(Math.max(...widths)).toBeLessThanOrEqual(4.2);
  });

  it("representa Avatar como banco VRM local con control manual y fronteras explícitas", () => {
    expect(navAvatar).toContain('data-semantic="local-vrm-inspection rig manual-motor read-only-boundaries"');
    expect(navAvatar).toContain('data-symbol="local-vrm-inspection rig manual-motor read-only-boundaries"');
    expect(navAvatar).toContain('data-detail="local-vrm-inspection-gantry"');
    expect(navAvatar).toContain('data-detail="vrm-local-render-stage"');
    expect(navAvatar).toContain('data-detail="alice-vrm-miniature"');
    expect(navAvatar).toContain('data-reference="local-vrm-thumbnail"');
    expect(navAvatar).toContain('data-portrait="decorative-animated"');
    expect(navAvatar).toContain('class="avatar-preview-eyes"');
    expect(navAvatar).toContain('class="avatar-panel-sweep"');
    expect(navAvatar).toContain('@keyframes avatar-preview-blink');
    expect(navAvatar).toContain('.avatar-preview-portrait,.avatar-preview-eyes,.avatar-panel-sweep{animation:none}');
    expect(navAvatar).toContain('[data-icon="avatar"] .alive{animation:none}');
    expect(navAvatar).toContain('data-detail="ash-brown-twin-tails"');
    expect(navAvatar).toContain('data-detail="lavender-grey-eyes"');
    expect(navAvatar).toContain('data-detail="layered-fringe-and-ahoge"');
    expect(navAvatar).toContain('data-detail="dark-techwear-bust"');
    expect(navAvatar).toContain('data-detail="humanoid-rig-inspection"');
    expect(navAvatar).toContain('data-detail="vrm-read-only-inspector"');
    expect(navAvatar.match(/data-detail="recessed-inspector-panel"/g)).toHaveLength(3);
    expect(navAvatar.match(/data-detail="rig-inspection-joint"/g)).toHaveLength(6);
    expect(navAvatar).toContain('data-detail="expression-contour-guides"');
    expect(navAvatar).toContain('data-detail="spring-coil-windings"');
    expect(navAvatar).toContain('data-detail="gamepad-machined-controls"');
    expect(navAvatar).toContain('data-detail="viewer-bezel-machining"');
    expect(navAvatar).toContain('data-detail="read-only-expression-catalog"');
    expect(navAvatar).toContain('data-detail="spring-joint-chain"');
    expect(navAvatar).toContain('data-detail="manual-gamepad-dock"');
    expect(navAvatar).toContain('data-control="manual-only"');
    expect(navAvatar).toContain('data-state="not-driven"');
    expect(navAvatar).not.toContain('<image');
    expect(navAvatar).not.toContain('data-detail="faceted-techwear-avatar"');
    expect(navAvatar).toContain('data-detail="connection-boundary-rail"');
    expect(navAvatar.match(/data-detail="avatar-boundary-port"/g)).toHaveLength(4);
    expect(navAvatar).toContain('data-boundary="render" data-connected="true"');
    expect(navAvatar).toContain('data-boundary="expression" data-connected="false"');
    expect(navAvatar).toContain('data-boundary="voice" data-connected="false"');
    expect(navAvatar).toContain('data-boundary="cognition" data-connected="false"');
    expect(navAvatar).not.toContain('data-detail="render-status-orbit"');
  });

  it("mantiene Rostro como calibrador con cámara apagada", () => {
    expect(bridgeFace).toContain('data-semantic="face-calibration camera-off landmarks-reserved"');
    expect(bridgeFace).toContain('data-detail="face-calibration-bay"');
    expect(bridgeFace).toContain('data-detail="reserved-landmark-lattice"');
    expect(bridgeFace).toContain('data-detail="sculpted-neutral-face"');
    expect(bridgeFace).toContain('data-detail="facial-topology-guides"');
    expect(bridgeFace).toContain('data-detail="reference-mask-cradle"');
    expect(bridgeFace).toContain('data-input="reference-only" data-tracking="false"');
    expect(bridgeFace.match(/data-detail="reference-landmark"/g)).toHaveLength(20);
    expect(bridgeFace).toContain('data-detail="expression-reserve-bank"');
    expect(bridgeFace.match(/data-detail="reserved-facial-channel"/g)).toHaveLength(8);
    for (const channel of ['eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'browInnerUp', 'gazeX', 'gazeY']) {
      expect(bridgeFace).toContain(`data-channel="${channel}" data-state="unread"`);
    }
    expect(bridgeFace).toContain('data-detail="camera-off-shutter"');
    expect(bridgeFace).toContain('data-sensor="closed"');
    expect(bridgeFace).toContain('data-detail="closed-privacy-blades"');
    expect(bridgeFace).toContain('data-detail="r2-permission-interlock" data-activation="blocked"');
    expect(bridgeFace).toContain('data-detail="passive-readiness-cartridges" data-state="unmeasured"');
    expect(bridgeFace).toContain('data-detail="disconnected-retarget"');
    expect(bridgeFace).toContain('class="face-bezel-glint"');
    expect(bridgeFace).toContain('@media(prefers-reduced-motion:reduce){.face-bezel-glint{animation:none}}');
    expect(bridgeFace).not.toContain('class="mechanical"');
    expect(bridgeFace).not.toContain('class="scan"');
  });

  it("representa Cuerpo como solver IK articulado sin inventar sensores", () => {
    expect(bridgeBody).toContain('data-detail="ik-solver-gantry"');
    expect(bridgeBody).toContain('data-detail="orientation-solver"');
    expect(bridgeBody).toContain('data-detail="articulated-body-rig"');
    expect(bridgeBody.match(/data-detail="articulated-bearing"/g)?.length).toBeGreaterThanOrEqual(8);
    expect(bridgeBody).toContain('data-detail="inverse-kinematics-constraints"');
    expect(bridgeBody).toContain('data-detail="floor-contact-targets"');
    expect(bridgeBody).toContain('data-detail="solver-telemetry"');
    expect(bridgeBody).toContain('data-detail="sealed-sensor-input"');
    expect(bridgeBody).toContain('data-detail="reserved-solver-pipeline" data-state="disconnected"');
    expect(bridgeBody).toContain('data-detail="inactive-retarget-output" data-state="blocked"');
    expect(bridgeBody.match(/data-detail="unmeasured-solver-metric"/g)).toHaveLength(15);
    expect(bridgeBody).not.toContain('class="breath"');
  });

  it("representa el Taller como mesa gobernada, simulación estática y ejecución aislada", () => {
    expect(navSkills).toContain('data-detail="governed-workbench-chassis"');
    expect(navSkills).toContain('data-detail="local-skill-library"');
    expect(navSkills.match(/data-detail="versioned-skill-cartridge"/g)).toHaveLength(3);
    expect(navSkills).toContain('data-detail="manifest-revision-cartridge"');
    expect(navSkills).toContain('data-detail="manifest-contract-chip"');
    expect(navSkills).toContain('data-detail="manifest-hash-strip"');
    expect(navSkills).toContain('data-detail="static-simulation-chamber"');
    expect(navSkills).toContain('data-mode="simulation-only"');
    expect(navSkills).toContain('data-state="execution-disabled"');
    for (const status of ['draft', 'inReview', 'approved', 'disabled', 'retired']) {
      expect(navSkills).toContain(`data-status="${status}"`);
    }
    expect(navSkills).toContain('data-detail="zero-effect-indicators"');
    expect(navSkills).toContain('data-detail="capability-contract-bus"');
    expect(navSkills).toContain('data-detail="immutable-lifecycle-column"');
    expect(navSkills).toContain('data-detail="owner-confirmation-key"');
    expect(navSkills).toContain('data-detail="execution-isolator"');
    expect(navSkills).toContain('data-detail="workshop-revision-rail"');
    expect(navSkills).not.toContain('data-detail="skill-workshop-chassis"');
  });

  it("representa Procedimientos como observación y decisión sin ejecución", () => {
    expect(navProcedures).toContain('data-detail="procedure-observation-chassis"');
    expect(navProcedures).toContain('data-detail="repetition-evidence-tapes"');
    expect(navProcedures).toContain('data-detail="pattern-correlator"');
    expect(navProcedures).toContain('data-detail="procedure-candidate-capsule"');
    expect(navProcedures).toContain('data-detail="owner-decision-gate"');
    expect(navProcedures).toContain('data-detail="execution-isolator"');
    expect(navProcedures.match(/data-detail="correlated-occurrence"/g)).toHaveLength(3);
    expect(navProcedures.match(/data-detail="repeated-step-sequence"/g)).toHaveLength(3);
    expect(navProcedures).toContain('data-result="draft-only"');
    expect(navProcedures).toContain('data-state="no-execution"');
    for (const state of ['current', 'stale', 'dismissed', 'converted', 'blocked']) {
      expect(navProcedures).toContain(`data-evidence-state="${state}"`);
    }
  });

  it("representa Memoria como bóveda estratificada con recuperación y gobierno", () => {
    expect(navMemory).toContain('data-detail="layered-memory-vault"');
    expect(navMemory.match(/data-detail="memory-layer"/g)).toHaveLength(3);
    expect(navMemory).toContain('data-detail="rag-index"');
    expect(navMemory).toContain('data-detail="archive-channel"');
    expect(navMemory).toContain('data-detail="backup-rail"');
    expect(navMemory).toContain('data-detail="retention-gates"');
    expect(navMemory).toContain('data-detail="governed-record-core"');
    expect(navMemory).not.toContain('data-detail="encrypted-memory-core"');
    expect(navMemory).toContain('data-storage="ram-only"');
    expect(navMemory).toContain('data-detail="retrieval-lens"');
    expect(navMemory).toContain('data-detail="archive-cartridges"');
    expect(navMemory.match(/data-detail="layer-machined-cap"/g)).toHaveLength(3);
    expect(navMemory.match(/data-detail="layer-data-window"/g)).toHaveLength(3);
    expect(navMemory.match(/data-detail="layer-address-index"/g)).toHaveLength(3);
    expect(navMemory.match(/data-detail="retention-gate"/g)).toHaveLength(6);
    expect(navMemory).toContain('data-detail="memory-lifecycle-bus"');
    expect(navMemory).toContain('data-authority="owner-decision"');
    expect(navMemory).toContain('data-detail="owner-confirmed-record-association"');
    expect(navMemory).toContain('data-detail="retrieval-focus-reticle"');
    expect(navMemory.match(/data-detail="archive-cartridge"/g)).toHaveLength(2);
    expect(navMemory.match(/data-detail="archive-media-window"/g)).toHaveLength(2);
    expect(navMemory.match(/data-detail="cartridge-contact-bank"/g)).toHaveLength(2);
    expect(navMemory).toContain('data-detail="archive-egress"');
    expect(navMemory).toContain('data-detail="backup-mirror-channel"');
    expect(navMemory).toContain('data-detail="backup-checkpoints"');
    expect(navMemory).toContain('data-base="memory-service-chassis"');
    expect(navMemory).toContain('data-detail="base-service-panels"');
    expect(navMemory).toContain('data-detail="backup-module-latches"');
    expect(navMemory.match(/data-detail="retention-policy-glyph"/g)).toHaveLength(6);
    expect(navMemory.match(/data-detail="drawer-read-head"/g)).toHaveLength(3);
    expect(navMemory).toContain('class="memory-query-ring"');
    expect(navMemory).toContain('class="memory-base-reflection"');
    expect(navMemory).toContain('[data-icon="memory"] .alive{animation:none}');
    expect(navMemory).toContain('.memory-drawer-reflection,.memory-query-ring,.memory-base-reflection{animation:none}');
  });

  it("representa Actividad como una consola temporal multicanal legible", () => {
    expect(navActivity).toContain('data-detail="temporal-event-console"');
    expect(navActivity.match(/data-detail="temporal-event-lane"/g)).toHaveLength(3);
    expect(navActivity).toContain('data-detail="event-playhead"');
    expect(navActivity).toContain('data-detail="playhead-index-ring"');
    expect(navActivity).not.toContain('d="m109 56-6 8h12Z"');
    expect(navActivity).toContain('data-detail="event-ingress"');
    expect(navActivity).not.toContain('data-detail="durable-event-output"');
    expect(navActivity).toContain('data-detail="selected-event-inspector"');
    expect(navActivity).toContain('data-detail="temporal-retention-buffer"');
    for (const module of ['system', 'perception', 'memory', 'workspace', 'output', 'security']) {
      expect(navActivity).toContain(`data-module="${module}"`);
    }
    expect(navActivity).toContain('data-detail="event-severity-stack"');
    expect(navActivity).toContain('data-detail="elapsed-time-ruler"');
    expect(navActivity).toContain('data-detail="local-event-filter-deck"');
    expect(navActivity).toContain('data-visible-limit="24"');
    expect(navActivity.match(/data-detail="retention-slot"/g)).toHaveLength(24);
    expect(navActivity.match(/data-detail="event-inspector-field"/g)).toHaveLength(4);
    expect(navActivity).toContain('data-retention="temporary"');
    expect(navActivity).toContain('class="timeline-optical-index"');
    expect(navActivity).toContain('.timeline-optical-index{animation:none}');
  });

  it("representa Identificación como diagnóstico local trazable sin biometría ficticia", () => {
    expect(navIdentification).toContain('data-detail="local-perception-diagnostic-chassis"');
    expect(navIdentification).toContain('data-detail="real-local-input-ingress"');
    expect(navIdentification).toContain('data-detail="active-input-inspection-cassette"');
    expect(navIdentification).toContain('data-detail="local-source-multiplexer"');
    expect(navIdentification).toContain('data-source="draft"');
    expect(navIdentification).toContain('data-source="last-user-message"');
    expect(navIdentification).toContain('data-detail="token-inspection-optic"');
    expect(navIdentification).toContain('data-detail="optic-calibration-index"');
    expect(navIdentification).toContain('data-detail="tokenized-message-window"');
    expect(navIdentification).toContain('data-detail="real-input-token-cells"');
    expect(navIdentification.match(/data-token-index=/g)).toHaveLength(8);
    expect(navIdentification).toContain('data-detail="isolated-document-preview" data-flow="preview-only" data-memory-write="false"');
    expect(navIdentification).toContain('data-detail="perception-provenance-vector"');
    expect(navIdentification.match(/data-detail="provenance-field-cell"/g)).toHaveLength(4);
    expect(navIdentification).toContain('data-field="source" data-evidence="observed"');
    expect(navIdentification).toContain('data-field="speaker" data-evidence="observed"');
    expect(navIdentification).toContain('data-field="intent" data-evidence="heuristic"');
    expect(navIdentification).toContain('data-field="confidence" data-evidence="heuristic"');
    expect(navIdentification).toContain('data-detail="diagnostic-mode-deck"');
    expect(navIdentification.match(/data-detail="diagnostic-mode-cell"/g)).toHaveLength(4);
    expect(navIdentification).toContain('data-detail="affect-simulation-off"');
    expect(navIdentification).toContain('data-detail="local-failsafe-isolator"');
    expect(navIdentification).toContain('class="input-lens-glint"');
    expect(navIdentification).toContain('class="input-reader-index"');
    expect(navIdentification).toContain('.input-lens-glint,.input-reader-index{animation:none}');
    expect(navIdentification).not.toContain('data-detail="biometric-owner-print"');
    expect(navIdentification).not.toContain('data-detail="owner-verification-seal"');
    expect(navIdentification).not.toContain('data-detail="context-window"');
  });

  it("representa Capacidades con siete dominios, madurez y estado separados", () => {
    expect(bridgeOverview).toContain('data-detail="capability-registry-chassis"');
    expect(bridgeOverview.match(/data-detail="capability-domain-cartridge"/g)).toHaveLength(7);
    for (const domain of ['cloud', 'context', 'perception', 'memory', 'avatar', 'output', 'task']) {
      expect(bridgeOverview).toContain(`data-domain="${domain}"`);
    }
    for (const maturity of ['implemented', 'partial', 'planned']) {
      expect(bridgeOverview).toContain(`data-maturity="${maturity}"`);
    }
    for (const state of ['unavailable', 'disabled', 'idle', 'active', 'degraded', 'error']) {
      expect(bridgeOverview).toContain(`data-state="${state}"`);
    }
    expect(bridgeOverview).toContain('data-detail="registry-query-port"');
    expect(bridgeOverview).toContain('data-detail="registry-input-port"');
    expect(bridgeOverview).toContain('data-detail="registry-backplane"');
    expect(bridgeOverview).not.toContain('data-detail="registry-bus"');
    expect(bridgeOverview).toContain('data-detail="selected-capability-inspector"');
    expect(bridgeOverview).toContain('data-detail="permission-risk-health-strip"');
    expect(bridgeOverview).not.toContain('data-detail="registry-sync-rail"');
  });

  it("representa el Planificador como banco vacío sin cálculos ni selección ficticia", () => {
    expect(nucleusPlanner).toContain('data-detail="empty-planning-bench"');
    expect(nucleusPlanner).toContain('data-detail="planner-input-checkpoint"');
    expect(nucleusPlanner).toContain('data-detail="sealed-candidate-generator"');
    expect(nucleusPlanner).toContain('data-detail="empty-candidate-queue"');
    expect(nucleusPlanner).toContain('data-detail="uncalculated-metric-bank"');
    expect(nucleusPlanner.match(/data-detail="uncalculated-metric"/g)).toHaveLength(4);
    expect(nucleusPlanner).toContain('data-metric="intention"');
    expect(nucleusPlanner).toContain('data-metric="utility"');
    expect(nucleusPlanner).toContain('data-metric="risk"');
    expect(nucleusPlanner).toContain('data-metric="novelty"');
    expect(nucleusPlanner).toContain('data-detail="empty-response-cradle"');
    expect(nucleusPlanner).toContain('data-detail="dormant-decision-trace"');
    expect(nucleusPlanner.match(/data-detail="future-planner-stage"/g)).toHaveLength(4);
    expect(nucleusPlanner).toContain('data-detail="planner-execution-isolator"');
    expect(nucleusPlanner).toContain('data-detail="governed-arbitration-chamber"');
    expect(nucleusPlanner).toContain('data-detail="arbitration-core-empty"');
    expect(nucleusPlanner).toContain('data-detail="owner-temporal-dock"');
    expect(nucleusPlanner).toContain('data-electrical-state="isolated"');
    expect(nucleusPlanner).toContain('data-detail="owner-preview-tray"');
    expect(nucleusPlanner).toContain('data-detail="owner-confirmation-interlock"');
    expect(nucleusPlanner).toContain('data-detail="temporal-reservation-ledger"');
    expect(nucleusPlanner).toContain('data-detail="closed-output-shutter"');
    expect(nucleusPlanner).toContain('data-detail="dual-physical-interlock"');
    expect(nucleusPlanner).toContain('data-detail="owner-calendar-module"');
    expect(nucleusPlanner).toContain('data-mode="review-before-write"');
    expect(nucleusPlanner).toContain('data-detail="manual-notification-port" data-delivery="separate-owner-confirmation"');
    expect(nucleusPlanner).toContain('data-state="cognitive-execution-blocked"');
    expect(nucleusPlanner.match(/data-state="uncalculated"/g)).toHaveLength(4);
    expect(nucleusPlanner.match(/data-detail="empty-candidate-slot"/g)).toHaveLength(3);
    expect(nucleusPlanner).toContain('class="planner-bezel-reflection"');
    expect(nucleusPlanner).toContain('.planner-bezel-reflection{animation:none}');
    expect(nucleusPlanner).toContain('[data-icon="planner"] .alive{animation:none}');
    expect(nucleusPlanner).not.toContain('data-detail="action-candidate"');
    expect(nucleusPlanner).not.toContain('data-selected="true"');
    expect(nucleusPlanner).not.toContain('data-detail="risk-meter"');
    expect(nucleusPlanner).not.toContain('data-detail="utility-meter"');
  });

  it("representa el Volumen como proyección trazable, sin anatomía cerebral", () => {
    expect(nucleusVolume).toContain('data-detail="stereoscopic-volume-chamber"');
    expect(nucleusVolume).not.toContain('data-detail="left-memory-lobe"');
    expect(nucleusVolume).not.toContain('data-detail="right-process-lobe"');
    expect(nucleusVolume).toContain('data-detail="confirmed-memory-associations"');
    expect(nucleusVolume).toContain('data-authority="owner-confirmed"');
    expect(nucleusVolume).toContain('data-detail="persistent-memory-anchors"');
    expect(nucleusVolume.match(/data-node-kind="memory"/g)).toHaveLength(12);
    expect(nucleusVolume.match(/data-node-kind="process"/g)).toHaveLength(3);
    expect(nucleusVolume).toContain('data-detail="r3-temporal-pulse-cluster"');
    expect(nucleusVolume).toContain('data-detail="volume-provenance-inspector"');
    expect(nucleusVolume.match(/data-layer=/g)).toHaveLength(6);
    expect(nucleusVolume).toContain('data-detail="volume-navigation-deck"');
    expect(nucleusVolume).toContain('data-detail="inactive-affect-reserve"');
    expect(nucleusVolume).toContain('data-detail="volume-orientation-cradle"');
    expect(nucleusVolume).not.toContain('data-detail="central-neural-core"');
    expect(nucleusVolume).not.toContain('class="orbit"');
  });

  it("representa el Flujo cognitivo como grafo funcional del espacio de trabajo global", () => {
    expect(nucleusFlow).toContain('data-detail="functional-flow-console"');
    expect(nucleusFlow).toContain('data-detail="r3-evidence-monitor"');
    expect(nucleusFlow).toContain('data-detail="evidenced-functional-links"');
    expect(nucleusFlow).toContain('data-detail="global-workspace-hub"');
    expect(nucleusFlow).toContain('data-detail="workspace-evidence-aperture"');
    expect(nucleusFlow).toContain('data-detail="perception-inhibition-gate"');
    expect(nucleusFlow).toContain('data-detail="perception-input-node"');
    expect(nucleusFlow).toContain('data-detail="memory-context-node"');
    expect(nucleusFlow).toContain('data-detail="language-process-node"');
    expect(nucleusFlow).toContain('data-detail="governed-response-port"');
    expect(nucleusFlow).toContain('data-detail="planned-function-satellites"');
    expect(nucleusFlow).not.toContain('data-detail="traceability-ledger"');
    expect(nucleusFlow.match(/data-detail="functional-route"/g)).toHaveLength(5);
    expect(nucleusFlow.match(/data-detail="workspace-layer"/g)).toHaveLength(3);
    expect(nucleusFlow.match(/data-planned-function=/g)).toHaveLength(5);
    expect(nucleusFlow).toContain('data-representation="illustrative-not-live"');
    expect(nucleusFlow).toContain('data-detail="owner-confirmed-memory-association" data-relation="not-causal"');
    expect(nucleusFlow).toContain('class="flow-optical-sheen"');
    expect(nucleusFlow).toContain('.flow-optical-sheen{animation:none}');
    expect(nucleusFlow).not.toContain('class="mechanical"');
  });

  it("representa Estado con ocho controles bloqueados en lugar de placeholders", () => {
    expect(nucleusState).toContain('data-detail="locked-behavior-control-deck"');
    expect(nucleusState).toContain('data-control-count="8"');
    expect(nucleusState.match(/data-detail="locked-control-pair"/g)).toHaveLength(4);
    expect(nucleusState.match(/data-detail="control-guide-index"/g)).toHaveLength(4);
    expect(nucleusState.match(/data-state="locked-read-only"/g)).toHaveLength(4);
    expect(nucleusState).toContain('data-detail="read-only-interlock"');
    expect(nucleusState).toContain('data-detail="selected-state-inspector"');
    expect(nucleusState).toContain('data-detail="retrieved-memory-cartridge"');
    expect(nucleusState.match(/data-availability="ready"/g)).toHaveLength(2);
    expect(nucleusState.match(/data-availability="planned"/g)).toHaveLength(6);
    expect(nucleusState.match(/data-control="[^"]+"/g)).toHaveLength(8);
    expect(nucleusState).not.toContain('<rect x="50" y="150" width="22" height="8" rx="2"');
    expect(nucleusState).not.toContain('<rect x="134" y="150" width="17" height="8" rx="2"');
  });

  it("representa Auditoría como consola dual R3 y diagnóstico pasivo", () => {
    expect(navAudit).toContain('data-detail="owner-inspection-console"');
    expect(navAudit).toContain('data-detail="r3-correlated-ledger"');
    expect(navAudit.match(/data-detail="correlated-audit-event"/g)).toHaveLength(5);
    expect(navAudit).toContain('data-detail="audit-rotation-cartridge"');
    expect(navAudit).toContain('data-detail="schema-inspection-optic"');
    expect(navAudit).not.toContain('data-detail="integrity-checksum-aperture"');
    for (const category of ['path', 'dataVersion', 'provider', 'adapter', 'permission']) {
      expect(navAudit).toContain(`data-category="${category}"`);
    }
    expect(navAudit).toContain('data-detail="passive-diagnostic-bank"');
    expect(navAudit.match(/data-detail="diagnostic-category-cell"/g)).toHaveLength(5);
    expect(navAudit).toContain('data-detail="read-only-diagnostic-probe"');
    expect(navAudit).toContain('data-detail="invalid-line-trap"');
    expect(navAudit).toContain('data-detail="no-effect-isolator"');
    expect(navAudit).not.toContain('data-detail="integrity-shield"');
    expect(navAudit).not.toContain('data-detail="passive-diagnostic-lens"');
  });

  it("refina ligeramente el emblema principal sin reemplazar su identidad", () => {
    expect(appAlice).toContain('data-refinement="subtle"');
    expect(appAlice).toContain('data-detail-pass="precision-finish-v16"');
    expect(appAlice).toContain('data-component-refinement="precision-components-v16"');
    expect(appAlice).toContain('data-material-finish="micro-etched-v16"');
    expect(appAlice).toContain('data-mounting-grammar="framed-emblem"');
    expect(appAlice).toContain('data-screw-style="layered-hex-socket"');
    expect(appAlice).toContain('data-detail="emblem-hex-socket-screws"');
    expect(appAlice).toContain('data-detail="app-screw-machining-index"');
    expect(appAlice).toContain('id="frame-ambient"');
    expect(appAlice).toContain('data-detail="background-machining"');
    expect(appAlice).toContain('data-detail="frame-machined-seams"');
    expect(appAlice).toContain('data-detail="synaptic-node-rims"');
    expect(appAlice).toContain('data-detail="core-calibration-index"');
    expect(appAlice).toContain('data-detail="core-aperture-rim"');
    expect(appAlice).toContain('data-detail="neural-bridge-ribs"');
    expect(appAlice).toContain('aria-label="Emblema de Alice Continuum"');
    expect(appAlice).toContain('data-motion="static"');
    expect(appAlice).toContain('data-palette="graphite-cyan-violet"');
    expect(appAlice).toContain('id="monogram-metal"');
    expect(appAlice).not.toMatch(/@keyframes|\banimation\s*:|<animate\b|<animateTransform\b|<animateMotion\b|<set\b|<script\b/i);
    expect(appAlice).not.toMatch(/class="app-(orbit|pulse|flow)"/);
    const widths = [...appAlice.matchAll(/stroke-width="([0-9.]+)"/g)].map((match) => Number(match[1]));
    expect(Math.max(...widths)).toBeLessThanOrEqual(5.8);
  });

  it("representa permisos como esclusa R2 de solicitud, decisión y grant efímero", () => {
    expect(navBridges).toContain('data-detail="permission-airlock-chassis"');
    expect(navBridges).toContain('data-detail="deny-by-default-bulkhead"');
    expect(navBridges).toContain('data-detail="prepared-request-capsule"');
    expect(navBridges).toContain('data-detail="owner-decision-airlock"');
    expect(navBridges).toContain('data-detail="explicit-owner-decision"');
    expect(navBridges).toContain('data-detail="ephemeral-grant-cartridge"');
    expect(navBridges).toContain('data-detail="grant-scope-contacts"');
    expect(navBridges).toContain('data-detail="lease-expiry-dial"');
    expect(navBridges).toContain('data-detail="separate-execution-port"');
    expect(navBridges).toContain('data-detail="revocation-breaker"');
    expect(navBridges).toContain('data-storage="ephemeral"');
    expect(navBridges).toContain('data-detail="immutable-request-digest"');
    expect(navBridges.match(/data-request-field=/g)).toHaveLength(3);
    expect(navBridges).toContain('data-decision="required"');
    expect(navBridges).toContain('data-execution="separate-action-required"');
    expect(navBridges).toContain('data-detail="deny-by-default-bulkhead" data-state="closed"');
    expect(navBridges).toContain('class="gateway-bezel-glint"');
    expect(navBridges).toContain('.gateway-bezel-glint{animation:none}');
    expect(navBridges).not.toContain('data-detail="policy-gateway-frame"');
  });

  it("mantiene Configuración reconocible como engranaje y controles", () => {
    expect(navSettings).toContain('data-semantic="settings inference privacy hardware fiber-optic-bus"');
    expect(navSettings).toContain('data-icon="settings"');
    expect(navSettings).toContain('data-detail="system-configuration-backplane"');
    expect(navSettings).toContain('data-detail="runtime-start-stop-controls"');
    expect(navSettings).toContain('data-detail="provider-model-cartridges"');
    expect(navSettings).toContain('data-detail="mandatory-send-review"');
    expect(navSettings).toContain('data-detail="external-hardware-safe-off"');
    for (const domain of ['inference', 'privacy', 'hardware']) {
      expect(navSettings).toContain(`data-settings-domain="${domain}"`);
    }
    expect(navSettings).toContain('data-gear="primary"');
    expect(navSettings).not.toContain('data-gear="secondary"');
    expect(navSettings).not.toContain('data-gear="tertiary"');
    expect(navSettings).not.toContain('data-control="precision"');
    expect(navSettings).toContain('data-detail="gear-axis-support"');
    expect(navSettings).toContain('data-purpose="supports-gear-axis-and-absorbs-vibration"');
    expect(navSettings).toContain('data-detail="vibration-damping-coupler"');
    expect(navSettings).toContain('data-detail="support-load-index"');
    expect(navSettings).toContain('data-detail="dual-bearing"');
    expect(navSettings).toContain('data-detail="configuration-selector-core"');
    expect(navSettings).toContain('data-detail="faceted-selector-knob"');
    expect(navSettings.match(/data-detail="selector-machined-facet"/g)).toHaveLength(8);
    expect(navSettings).toContain('data-detail="selector-face-retainers"');
    expect(navSettings.match(/data-detail="slider-end-stops"/g)).toHaveLength(3);
    expect(navSettings.match(/data-detail="slider-thumb-chamfer"/g)).toHaveLength(3);
    expect(navSettings).toContain('data-detail="selector-reference-notch"');
    expect(navSettings.match(/data-detail="symbolic-adjustment-slider"/g)).toHaveLength(3);
    expect(navSettings.match(/data-detail="selector-flush-fastener"/g)).toHaveLength(4);
    expect(navSettings).not.toContain('data-detail="central-hex-key-socket"');
    expect(navSettings).not.toContain('data-detail="drive-shaft-spline"');
    expect(navSettings).toContain('data-detail="precision-gear-rotor"');
    expect(navSettings).toContain('data-detail="chamfered-gear-teeth"');
    expect(navSettings.match(/data-detail="chamfered-gear-tooth"/g)).toHaveLength(12);
    expect(navSettings).toContain('data-detail="continuous-toothed-crown"');
    expect(navSettings).toContain('data-tooth-profile="wide-flat-crest-deep-root"');
    expect(navSettings).toContain('data-detail="gear-root-collar"');
    expect(navSettings).toContain('data-detail="recessed-rotor-web"');
    expect(navSettings).toContain('data-detail="optical-encoder-ring"');
    expect(navSettings).toContain('data-detail="tapered-torque-spokes"');
    expect(navSettings).toContain('data-detail="torque-limiter-pins"');
    expect(navSettings.match(/data-detail="torque-limiter-pin"/g)).toHaveLength(6);
    expect(navSettings).toContain('data-detail="bearing-ball-cage"');
    expect(navSettings.match(/data-detail="bearing-ball"/g)).toHaveLength(12);
    expect(navSettings.match(/data-detail="individual-bearing-pocket"/g)).toHaveLength(12);
    expect(navSettings).toContain('data-detail="bearing-race-machining"');
    expect(navSettings.match(/data-detail="bearing-separator-bridge"/g)).toHaveLength(12);
    expect(navSettings.match(/data-detail="machined-spoke-insert"/g)).toHaveLength(6);
    expect(navSettings.match(/data-detail="limiter-pin-recess"/g)).toHaveLength(6);
    expect(navSettings).toContain('data-detail="web-pocket-machining"');
    expect(navSettings.match(/<g\b/g)?.length).toBe(navSettings.match(/<\/g>/g)?.length);
    expect(navSettings.indexOf('data-detail="rotor-machined-components"')).toBeGreaterThan(navSettings.indexOf('data-detail="precision-gear-rotor"'));
    expect(navSettings.indexOf('data-detail="rotor-machined-components"')).toBeLessThan(navSettings.indexOf('data-detail="fixed-drive-hub"'));
    expect(navSettings).toContain('data-detail="fixed-drive-hub" transform="translate(70 101)"');
    expect(navSettings).toContain('data-detail="lubrication-microchannels"');
    expect(navSettings).toContain('data-detail="armored-fiber-optic-harness"');
    expect(navSettings).toContain('data-detail="fiber-optic-input-coupler"');
    expect(navSettings).toContain('data-detail="fiber-distribution-manifold"');
    expect(navSettings).toContain('data-detail="fiber-backbone-window"');
    expect(navSettings.match(/data-detail="fiber-branch-conduit"/g)).toHaveLength(3);
    expect(navSettings.match(/data-detail="fiber-core"/g)).toHaveLength(3);
    expect(navSettings.match(/data-detail="fiber-terminal-ferrule"/g)).toHaveLength(3);
    expect(navSettings).toContain('data-channel="inference"');
    expect(navSettings).toContain('data-channel="privacy"');
    expect(navSettings).toContain('data-channel="hardware"');
    expect(navSettings).toContain('data-detail="fiber-strain-relief-clamps"');
    expect(navSettings).toContain('data-detail="fiber-optic-status-prism"');
    expect(navSettings).not.toContain('data-detail="refined-signal-conduit"');
    expect(navSettings.indexOf('data-detail="armored-fiber-optic-harness"')).toBeLessThan(navSettings.indexOf('data-detail="precision-gear-rotor"'));
    expect(navSettings.indexOf('data-detail="armored-fiber-optic-harness"')).toBeLessThan(navSettings.indexOf('data-detail="etched-hardware-module"'));
  });

  it("reserva los engranajes exclusivamente para Configuración", () => {
    const iconsWithoutSettings = Object.entries(functionalIcons)
      .filter(([name]) => name !== "navSettings")
      .map(([, source]) => source);

    expect(iconsWithoutSettings.every((source) => !source.includes("data-gear="))).toBe(true);
  });

  it("hace inequívocos los cinco controles de cámara", () => {
    expect(viewPan).toContain('data-control-symbol="four-way-pan"');
    expect(viewRotate).toContain('data-control-symbol="orbit-cube"');
    expect(viewZoomIn).toContain('data-control-symbol="magnifier-plus"');
    expect(viewZoomOut).toContain('data-control-symbol="magnifier-minus"');
    expect(viewReset).toContain('data-control-symbol="home-reset"');
  });

  it("distingue equipos montados de controles independientes", () => {
    const equipmentIcons = [
      bridgeBody, bridgeFace, bridgeOverview, navActivity, navAudit, navAvatar,
      navBridges, navIdentification, navMemory, navProcedures, navSettings, navSkills,
      nucleusFlow, nucleusPlanner, nucleusState, nucleusVolume,
    ];
    const independentControls = [viewPan, viewReset, viewRotate, viewZoomIn, viewZoomOut];

    expect(equipmentIcons.every((source) => source.includes('data-detail="chassis-to-plinth-mounts"'))).toBe(true);
    expect(equipmentIcons.every((source) => (source.match(/data-detail="load-bearing-foot"/g) ?? []).length === 2)).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-mounting-system="dual-load-bearing"'))).toBe(true);
    expect(independentControls.every((source) => !source.includes('data-detail="chassis-to-plinth-mounts"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-detail="precision-panel-bevel"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-detail="panel-recess-gasket"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-detail="panel-machined-lip"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-detail="panel-satin-face"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('data-detail="fitted-component-hardware"'))).toBe(true);
    expect(equipmentIcons.every((source) => source.includes('clipPathUnits="userSpaceOnUse"'))).toBe(true);
    expect(independentControls.every((source) => source.includes('data-detail="precision-control-rim"'))).toBe(true);
    expect(independentControls.every((source) => source.includes('data-detail="control-recessed-bearing"'))).toBe(true);
    expect(independentControls.every((source) => source.includes('data-detail="control-bearing-retainers"'))).toBe(true);
  });

  it("refina las bases del resto de equipos sin alterar la base propia de Memoria", () => {
    const equipmentIcons = [
      bridgeBody, bridgeFace, bridgeOverview, navActivity, navAudit, navAvatar,
      navBridges, navIdentification, navProcedures, navSettings, navSkills,
      nucleusFlow, nucleusPlanner, nucleusState, nucleusVolume,
    ];
    for (const source of equipmentIcons) {
      expect(source).toContain('data-base="machined-service-chassis"');
      expect(source.match(/data-detail="precision-equipment-plinth"/g)).toHaveLength(1);
      expect(source.match(/data-detail="base-recessed-service-panel"/g)).toHaveLength(2);
      expect(source).toContain('data-detail="base-central-coupler"');
      expect(source).toContain('data-detail="base-load-isolators"');
    }
    expect(navMemory).toContain('data-base="memory-service-chassis"');
    expect(navMemory).not.toContain('data-base="machined-service-chassis"');
    for (const source of [viewPan, viewReset, viewRotate, viewZoomIn, viewZoomOut]) {
      expect(source).not.toContain('data-detail="precision-equipment-plinth"');
    }
  });

  it("monta las ranuras de ventilación sin repetirlas como adorno flotante", () => {
    const iconsWithoutCooling = [
      bridgeBody, bridgeFace, bridgeOverview, navActivity, navAudit, navAvatar, navBridges, navIdentification, navProcedures, navSettings,
      navSkills, navMemory, nucleusFlow, nucleusPlanner, nucleusState, nucleusVolume, viewPan, viewReset, viewRotate, viewZoomIn, viewZoomOut,
    ];

    expect(iconsWithoutCooling.every((source) => !source.includes('data-detail="mounted-cooling-rail"'))).toBe(true);
    expect(Object.values(functionalIcons).every((source) => !source.includes('data-detail="cooling-array"'))).toBe(true);
  });
});
