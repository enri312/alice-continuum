import { describe, expect, it } from "vitest";
import {
  AVATAR_DIAGNOSTIC_DURATION_SECONDS,
  advanceManualAvatarMotion,
  diagnosticManualInputAt,
  manualInputIsActive,
  manualAvatarSpeed,
  normalizeGamepadAxis,
  readManualAvatarInput,
  selectManualGamepad,
  smoothManualAvatarInput,
  type GamepadSnapshot,
} from "./manual-avatar-control";

function gamepad(overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
  return {
    index: 0,
    id: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
    ...overrides,
  };
}

describe("manual avatar control", () => {
  it("elimina deriva dentro de la zona muerta y normaliza el resto", () => {
    expect(normalizeGamepadAxis(0.1)).toBe(0);
    expect(normalizeGamepadAxis(-0.14)).toBe(0);
    expect(normalizeGamepadAxis(1.5)).toBe(1);
    expect(normalizeGamepadAxis(-1.5)).toBe(-1);
    expect(normalizeGamepadAxis(0.57)).toBeCloseTo(0.5, 5);
  });

  it("prefiere el DualSense y no inventa un dispositivo desconectado", () => {
    const generic = gamepad({ index: 1, id: "Generic Controller" });
    const dualSense = gamepad({ index: 2 });
    expect(selectManualGamepad([generic, dualSense])?.index).toBe(2);
    expect(selectManualGamepad([gamepad({ connected: false })])).toBeNull();
  });

  it("lee sticks y gatillos sin producir salidas al mando", () => {
    const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
    buttons[6] = { value: 0.25, pressed: false };
    buttons[7] = { value: 1, pressed: true };
    buttons[0] = { value: 1, pressed: true };
    const input = readManualAvatarInput(gamepad({ axes: [0.57, -1, 0.14, 0], buttons }));
    expect(input.moveX).toBeCloseTo(0.5, 5);
    expect(input.moveZ).toBe(-1);
    expect(input.turn).toBe(0);
    expect(input.leftTrigger).toBe(0.25);
    expect(input.rightTrigger).toBe(1);
    expect(input.jump).toBe(true);
    expect(manualInputIsActive(input)).toBe(true);
  });

  it("limita tiempo y desplazamiento para mantener al avatar dentro del visor", () => {
    const input = { moveX: 1, moveZ: -1, turn: 0, leftTrigger: 0, rightTrigger: 0, jump: false };
    let motion = { x: 0, z: 0, yaw: 0 };
    for (let index = 0; index < 1000; index += 1) motion = advanceManualAvatarMotion(motion, input, 1);
    expect(motion.x).toBe(0.85);
    expect(motion.z).toBe(-0.85);
    const turned = advanceManualAvatarMotion(motion, { ...input, moveX: 0, moveZ: 0, turn: 1 }, 1);
    expect(turned.yaw).toBeLessThan(0);
  });

  it("aumenta velocidad sólo al superar el umbral analógico de carrera", () => {
    expect(manualAvatarSpeed({ moveX: 0, moveZ: -0.5 })).toBeCloseTo(0.72, 8);
    expect(manualAvatarSpeed({ moveX: 0, moveZ: -1 })).toBeCloseTo(1.2384, 8);
    expect(manualAvatarSpeed({ moveX: 0.6, moveZ: -0.6 })).toBeGreaterThan(0.72);
  });

  it("desplaza en el espacio local de Alice después de girar", () => {
    const facingLeft = { x: 0, z: 0, yaw: Math.PI / 2 };
    const forward = { moveX: 0, moveZ: -1, turn: 0, leftTrigger: 0, rightTrigger: 0, jump: false };
    const motion = advanceManualAvatarMotion(facingLeft, forward, 0.05);
    expect(motion.x).toBeLessThan(-0.03);
    expect(Math.abs(motion.z)).toBeLessThan(0.001);
  });

  it("ofrece un ensayo determinista que cubre marcha, carrera, retroceso, lateral, giro y reposo", () => {
    expect(AVATAR_DIAGNOSTIC_DURATION_SECONDS).toBe(10);
    expect(diagnosticManualInputAt(0.5).moveZ).toBeCloseTo(-0.68, 8);
    expect(diagnosticManualInputAt(1.5).moveZ).toBe(-1);
    expect(diagnosticManualInputAt(2.8).moveZ).toBeGreaterThan(0);
    expect(diagnosticManualInputAt(4).moveX).toBeLessThan(0);
    expect(diagnosticManualInputAt(5.2).moveX).toBeGreaterThan(0);
    expect(diagnosticManualInputAt(6.4).turn).toBeGreaterThan(0);
    expect(diagnosticManualInputAt(7.6).turn).toBeLessThan(0);
    expect(manualInputIsActive(diagnosticManualInputAt(9))).toBe(false);
    expect(diagnosticManualInputAt(10.5)).toEqual(diagnosticManualInputAt(0.5));
  });

  it("suaviza cambios bruscos sin sobrepasar la entrada objetivo", () => {
    const idle = diagnosticManualInputAt(9);
    const target = { ...idle, moveZ: -1, turn: .8, rightTrigger: 1 };
    const first = smoothManualAvatarInput(idle, target, .05);
    expect(first.moveZ).toBeGreaterThan(-1);
    expect(first.moveZ).toBeLessThan(0);
    expect(first.turn).toBeGreaterThan(0);
    expect(first.turn).toBeLessThan(.8);
    expect(first.rightTrigger).toBeGreaterThan(first.turn);
    let settled = first;
    for (let index = 0; index < 100; index += 1) settled = smoothManualAvatarInput(settled, target, .05);
    expect(settled.moveZ).toBeCloseTo(-1, 5);
    expect(settled.turn).toBeCloseTo(.8, 5);
    expect(settled.rightTrigger).toBeCloseTo(1, 5);
  });
});
