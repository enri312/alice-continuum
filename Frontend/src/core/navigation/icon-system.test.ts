import { describe, expect, it } from "vitest";
import bridgeBody from "../../../icons/embodiment-body-solver.svg?raw";
import bridgeFace from "../../../icons/embodiment-face-calibration.svg?raw";
import bridgeOverview from "../../../icons/governance-capability-registry.svg?raw";
import navActivity from "../../../icons/cognitive-activity-timeline.svg?raw";
import navAudit from "../../../icons/governance-audit-diagnostics.svg?raw";
import navAvatar from "../../../icons/embodiment-avatar-vrm.svg?raw";
import navBridges from "../../../icons/governance-permissions-gateway.svg?raw";
import navIdentification from "../../../icons/cognitive-conversation-channel.svg?raw";
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
  "cognitive-conversation-channel.svg",
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
  navIdentification: "conversation-channel text-dialogue filtered-voice-session contextual-vision speech-output",
  navMemory: "layered-memory rag lifecycle archive backup",
  navProcedures: "observed-repetition evidence owner-decision",
  navSettings: "settings inference privacy hardware fiber-optic-bus",
  navSkills: "skill-workshop draft simulation approval",
  nucleusFlow: "cognitive-flow evidenced-links input-memory-output",
  nucleusPlanner: "governed-arbitration empty-planning-bench uncalculated-metrics no-selection no-execution owner-temporal-dock",
  nucleusState: "observable-internal-state technical-signals session-controls retrieved-memory",
  nucleusVolume: "organic-neural-volume cortex dendrites memories provenance",
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

  it.each(Object.entries(functionalIcons))("%s contiene un motivo propio y usa referencias de pintura locales", (_name, source) => {
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    const icon = source.match(/data-icon="([^"]+)"/)?.[1];
    expect(source).toContain('data-visual-style="titanio-optico"');
    expect(source).toMatch(/data-part="[a-z-]+"/);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`alice-${icon}-`)).toBe(true);
    for (const match of source.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(match[1]);
    expect(source).not.toMatch(/<text\b|<image\b/);
    if (source.includes("@keyframes")) {
      expect(source).toContain("@media(prefers-reduced-motion:no-preference)");
    } else {
      expect(source).toContain('data-motion="static"');
    }
  });

  it("distingue las siluetas de las herramientas que comparten pantalla", () => {
    const motifs = Object.values(functionalIcons).map(source => source.match(/data-part="([^"]+)"/)?.[1]);
    expect(new Set(motifs).size).toBe(21);
    expect(bridgeOverview).toContain('data-part="domain-backplane"');
    expect(navBridges).toContain('data-part="permission-shield"');
    expect(navActivity).toContain('data-part="event-spool"');
    expect(navAudit).toContain('data-part="evidence-lens"');
    expect(viewZoomIn).toContain('data-part="magnify"');
    expect(viewZoomOut).toContain('data-part="reduce"');
    expect(viewPan).toContain('data-part="four-directions"');
    expect(viewReset).toContain('data-part="return-home"');
    expect(viewRotate).toContain('data-part="orbit-pivot"');
  });

  it("conserva la identidad y el trazado del emblema principal", () => {
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

});
