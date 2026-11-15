import { describe, expect, it } from "vitest";
import { advanceAvatarBodyState, bodyStateAnimation } from "./avatar-body-state";
import type { AvatarAnimationId } from "./avatar-animation";

const fullCapabilities = new Set<AvatarAnimationId>([
  "idle", "forward", "backward", "left", "right", "jump", "run", "turn-left", "turn-right",
  "start-walking", "sitting-idle", "standing-up",
]);

const idleSignal = { movement: 0, forward: false, jumpPressed: false, togglePosture: false, transitionFinished: false };

describe("avatar body state machine", () => {
  it("usa Start Walking antes de la marcha frontal", () => {
    const starting = advanceAvatarBodyState("standing-idle", { ...idleSignal, movement: .7, forward: true }, fullCapabilities);
    expect(starting).toBe("starting-walk");
    expect(advanceAvatarBodyState(starting, { ...idleSignal, movement: .7, forward: true, transitionFinished: true }, fullCapabilities)).toBe("locomoting");
  });

  it("no inventa una transición cuando falta el clip Start Walking", () => {
    const capabilities = new Set(fullCapabilities);
    capabilities.delete("start-walking");
    expect(advanceAvatarBodyState("standing-idle", { ...idleSignal, movement: .7, forward: true }, capabilities)).toBe("locomoting");
  });

  it("reproduce Standing Up al revés para sentarse y entra en Sitting Idle", () => {
    const sittingDown = advanceAvatarBodyState("standing-idle", { ...idleSignal, togglePosture: true }, fullCapabilities);
    expect(sittingDown).toBe("sitting-down");
    expect(bodyStateAnimation(sittingDown)).toBe("standing-up");
    expect(advanceAvatarBodyState(sittingDown, { ...idleSignal, transitionFinished: true }, fullCapabilities)).toBe("sitting-idle");
    expect(bodyStateAnimation("sitting-idle")).toBe("sitting-idle");
  });

  it("se levanta antes de aceptar una orden de movimiento", () => {
    const standingUp = advanceAvatarBodyState("sitting-idle", { ...idleSignal, movement: .6, forward: true }, fullCapabilities);
    expect(standingUp).toBe("standing-up");
    expect(advanceAvatarBodyState(standingUp, { ...idleSignal, movement: .6, forward: true, transitionFinished: true }, fullCapabilities)).toBe("starting-walk");
  });

  it("mantiene las transiciones atómicas aunque cambie la entrada", () => {
    expect(advanceAvatarBodyState("standing-up", { ...idleSignal, movement: 1, jumpPressed: true }, fullCapabilities)).toBe("standing-up");
    expect(advanceAvatarBodyState("sitting-down", { ...idleSignal, movement: 1, togglePosture: true }, fullCapabilities)).toBe("sitting-down");
  });

  it("vuelve a reposo al soltar el mando y después de un salto", () => {
    expect(advanceAvatarBodyState("locomoting", idleSignal, fullCapabilities)).toBe("standing-idle");
    expect(advanceAvatarBodyState("jumping", { ...idleSignal, transitionFinished: true }, fullCapabilities)).toBe("standing-idle");
  });
});
