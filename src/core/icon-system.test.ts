import { describe, expect, it } from "vitest";
import bridgeBody from "../../icons/bridge-body.svg?raw";
import bridgeFace from "../../icons/bridge-face.svg?raw";
import bridgeOverview from "../../icons/bridge-overview.svg?raw";
import navActivity from "../../icons/nav-activity.svg?raw";
import navAudit from "../../icons/nav-audit.svg?raw";
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
  navAudit,
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
    expect(sources).toHaveLength(23);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("distingue actividad temporal de auditoría forense", () => {
    expect(navActivity).toContain("LIVE EVENT WINDOW");
    expect(navActivity).toContain("TIMELINE · EVENT STREAM · R3");
    expect(navAudit).toContain("SHA-256 OK");
    expect(navAudit).toContain("VERIFY · TRACE · DIAGNOSE");
    expect(navAudit).not.toBe(navActivity);
  });

  it.each(Object.entries(functionalIcons))("%s declara una fuente SVG utilizable", (_name, source) => {
    expect(source).toMatch(/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/);
    expect(source).toContain('viewBox="0 0 200 200"');
    expect(source).toContain('role="img"');
    expect(source).toMatch(/aria-label="[^"]+"/);
    expect(source).toMatch(/<title>[^<]+<\/title>/);
    expect(source).toMatch(/<defs>/);
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

  it.each(Object.entries(functionalIcons))("%s usa el lienzo técnico de alta definición", (_name, source) => {
    expect(source).toContain('viewBox="0 0 200 200"');
  });

  it.each(Object.entries(functionalIcons))("%s tiene movimiento decorativo desactivable", (_name, source) => {
    expect(source).toMatch(/animation:/);
    expect(source).toContain("prefers-reduced-motion");
  });

  it("conserva Avatar con el contenido real del visor de Alice", () => {
    expect(navAvatar).toContain("ALICE · AVATAR");
    expect(navAvatar).toContain("MODELO CARGADO");
    expect(navAvatar).toContain("INSPECTOR VRM");
    expect(navAvatar).toContain("CLIPS");
    expect(navAvatar).toContain("FACIAL · SOLO LECTURA");
    expect(navAvatar).toContain("01 RENDER");
    expect(navAvatar).toContain("04 RAGDOLL");
    expect(navAvatar).toContain("MANUAL · R3");
    expect(navAvatar).toContain("ALICE.VRM");
    expect(navAvatar).toContain("LOCAL · PRIVATE");
    expect(navAvatar).not.toMatch(/transform:\s*translate/i);
  });

  it("mantiene Rostro como calibrador inactivo y no como tracking ficticio", () => {
    expect(bridgeFace).toContain("FACE CALIBRATION");
    expect(bridgeFace).toContain("NO SIGNAL");
    expect(bridgeFace).toContain("0/5");
    expect(bridgeFace).toContain("0/8");
    expect(bridgeFace).toContain("VIDEO");
    expect(bridgeFace).toContain("NOT STORED");
  });

});
