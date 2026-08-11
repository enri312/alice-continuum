import { describe, expect, it } from "vitest";
import bridgeBody from "../../icons/bridge-body.svg?raw";
import bridgeFace from "../../icons/bridge-face.svg?raw";
import bridgeOverview from "../../icons/bridge-overview.svg?raw";
import navActivity from "../../icons/nav-activity.svg?raw";
import navAvatar from "../../icons/nav-avatar.svg?raw";
import navBridges from "../../icons/nav-bridges.svg?raw";
import navConversation from "../../icons/nav-conversation.svg?raw";
import navIdentification from "../../icons/nav-identification.svg?raw";
import navMemory from "../../icons/nav-memory.svg?raw";
import navNucleus from "../../icons/nav-nucleus.svg?raw";
import navProcedures from "../../icons/nav-procedures.svg?raw";
import navSettings from "../../icons/nav-settings.svg?raw";
import navSkills from "../../icons/nav-skills.svg?raw";
import nucleusFlow from "../../icons/nucleus-flow.svg?raw";
import nucleusPlanner from "../../icons/nucleus-planner.svg?raw";
import nucleusState from "../../icons/nucleus-state.svg?raw";
import nucleusVolume from "../../icons/nucleus-volume.svg?raw";
import viewPan from "../../icons/view-pan.svg?raw";
import viewReset from "../../icons/view-reset.svg?raw";
import viewRotate from "../../icons/view-rotate.svg?raw";
import viewZoomIn from "../../icons/view-zoom-in.svg?raw";
import viewZoomOut from "../../icons/view-zoom-out.svg?raw";

const functionalIcons = {
  bridgeBody,
  bridgeFace,
  bridgeOverview,
  navActivity,
  navAvatar,
  navBridges,
  navConversation,
  navIdentification,
  navMemory,
  navNucleus,
  navProcedures,
  navSettings,
  navSkills,
  nucleusFlow,
  nucleusPlanner,
  nucleusState,
  nucleusVolume,
  viewPan,
  viewReset,
  viewRotate,
  viewZoomIn,
  viewZoomOut,
};

describe("sistema de iconos funcionales", () => {
  it("mantiene el catálogo completo y con diseños distintos", () => {
    const sources = Object.values(functionalIcons);
    expect(sources).toHaveLength(22);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it.each(Object.entries(functionalIcons))("%s tiene semántica accesible", (_name, source) => {
    expect(source).toMatch(/^<svg\b/);
    expect(source).toContain('role="img"');
    expect(source).toMatch(/aria-label="[^"]+"/);
    expect(source).toMatch(/<title>[^<]+<\/title>/);
  });

  it.each(Object.entries(functionalIcons))("%s es local y no ejecutable", (_name, source) => {
    expect(source).not.toMatch(/<script\b/i);
    expect(source).not.toMatch(/(?:href|src)=["'](?:https?:|data:|\/\/)/i);
    expect(source).not.toMatch(/<foreignObject\b/i);
  });

  it.each(Object.entries(functionalIcons))("%s conserva el lienzo previsto", (name, source) => {
    const expectedViewBox = name.startsWith("view") ? "0 0 48 48" : "0 0 64 64";
    expect(source).toContain(`viewBox="${expectedViewBox}"`);
  });
});
