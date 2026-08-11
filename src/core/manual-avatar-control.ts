export type ManualAvatarInput = {
  moveX: number;
  moveZ: number;
  turn: number;
  leftTrigger: number;
  rightTrigger: number;
  jump: boolean;
};

export type ManualAvatarMotion = {
  x: number;
  z: number;
  yaw: number;
};

export type GamepadSnapshot = {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { value: number; pressed: boolean }[];
};

const DEAD_ZONE = 0.14;
const MAX_TRANSLATION = 0.85;
const LINEAR_SPEED = 0.72;
const TURN_SPEED = 1.65;

export function manualAvatarSpeed(input: Pick<ManualAvatarInput, "moveX" | "moveZ">) {
  const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveZ));
  const runProgress = Math.max(0, Math.min(1, (magnitude - 0.72) / 0.24));
  const smoothRunProgress = runProgress * runProgress * (3 - 2 * runProgress);
  return LINEAR_SPEED * (1 + smoothRunProgress * 0.72);
}

export function normalizeGamepadAxis(value: number, deadZone = DEAD_ZONE) {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadZone) return 0;
  return Math.sign(clamped) * ((magnitude - deadZone) / (1 - deadZone));
}

export function selectManualGamepad(gamepads: readonly (GamepadSnapshot | null)[]) {
  const connected = gamepads.filter((gamepad): gamepad is GamepadSnapshot => Boolean(gamepad?.connected));
  return connected.find((gamepad) => /dualsense|wireless controller|054c|0ce6/i.test(gamepad.id)) ?? connected[0] ?? null;
}

export function readManualAvatarInput(gamepad: GamepadSnapshot): ManualAvatarInput {
  const buttonValue = (index: number) => {
    const button = gamepad.buttons[index];
    return button ? Math.max(0, Math.min(1, Number.isFinite(button.value) ? button.value : Number(button.pressed))) : 0;
  };
  return {
    moveX: normalizeGamepadAxis(gamepad.axes[0] ?? 0),
    moveZ: normalizeGamepadAxis(gamepad.axes[1] ?? 0),
    turn: normalizeGamepadAxis(gamepad.axes[2] ?? 0),
    leftTrigger: buttonValue(6),
    rightTrigger: buttonValue(7),
    jump: Boolean(gamepad.buttons[0]?.pressed),
  };
}

export function advanceManualAvatarMotion(
  current: ManualAvatarMotion,
  input: ManualAvatarInput,
  deltaSeconds: number,
): ManualAvatarMotion {
  const delta = Math.max(0, Math.min(0.05, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const requestedMagnitude = Math.hypot(input.moveX, input.moveZ);
  const movementScale = requestedMagnitude > 1 ? 1 / requestedMagnitude : 1;
  const localX = input.moveX * movementScale;
  const localZ = input.moveZ * movementScale;
  const cosYaw = Math.cos(current.yaw);
  const sinYaw = Math.sin(current.yaw);
  const worldX = localX * cosYaw + localZ * sinYaw;
  const worldZ = -localX * sinYaw + localZ * cosYaw;
  const linearSpeed = manualAvatarSpeed(input);
  return {
    x: Math.max(-MAX_TRANSLATION, Math.min(MAX_TRANSLATION, current.x + worldX * linearSpeed * delta)),
    z: Math.max(-MAX_TRANSLATION, Math.min(MAX_TRANSLATION, current.z + worldZ * linearSpeed * delta)),
    yaw: current.yaw - input.turn * TURN_SPEED * delta,
  };
}

export function diagnosticManualInputAt(elapsedSeconds: number): ManualAvatarInput {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const phase = elapsed % 10;
  if (phase < 1.2) return { ...idleManualInput, moveZ: -0.68 };
  if (phase < 2.4) return { ...idleManualInput, moveZ: -1 };
  if (phase < 3.6) return { ...idleManualInput, moveZ: 0.72 };
  if (phase < 4.8) return { ...idleManualInput, moveX: -0.68 };
  if (phase < 6) return { ...idleManualInput, moveX: 0.68 };
  if (phase < 7.2) return { ...idleManualInput, turn: 0.62 };
  if (phase < 8.4) return { ...idleManualInput, turn: -0.62 };
  return { ...idleManualInput };
}

export function smoothManualAvatarInput(
  current: ManualAvatarInput,
  target: ManualAvatarInput,
  deltaSeconds: number,
): ManualAvatarInput {
  const delta = Math.max(0, Math.min(0.05, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const movementFactor = 1 - Math.exp(-delta * 9);
  const triggerFactor = 1 - Math.exp(-delta * 14);
  const approach = (from: number, to: number, factor: number) => from + (to - from) * factor;
  return {
    moveX: approach(current.moveX, target.moveX, movementFactor),
    moveZ: approach(current.moveZ, target.moveZ, movementFactor),
    turn: approach(current.turn, target.turn, movementFactor),
    leftTrigger: approach(current.leftTrigger, target.leftTrigger, triggerFactor),
    rightTrigger: approach(current.rightTrigger, target.rightTrigger, triggerFactor),
    jump: target.jump,
  };
}

export function manualInputIsActive(input: ManualAvatarInput) {
  return Math.abs(input.moveX) > 0 || Math.abs(input.moveZ) > 0 || Math.abs(input.turn) > 0 || input.leftTrigger > 0.02 || input.rightTrigger > 0.02 || input.jump;
}

const idleManualInput: ManualAvatarInput = { moveX: 0, moveZ: 0, turn: 0, leftTrigger: 0, rightTrigger: 0, jump: false };
