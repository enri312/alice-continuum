import type { AvatarAnimationId } from "./avatar-animation";

export type AvatarBodyState =
  | "standing-idle"
  | "starting-walk"
  | "locomoting"
  | "jumping"
  | "sitting-down"
  | "sitting-idle"
  | "standing-up";

export type AvatarBodySignal = {
  movement: number;
  forward: boolean;
  jumpPressed: boolean;
  togglePosture: boolean;
  transitionFinished: boolean;
};

export type AvatarBodyCapabilities = ReadonlySet<AvatarAnimationId>;

const movingThreshold = .08;

function canUse(capabilities: AvatarBodyCapabilities, id: AvatarAnimationId) {
  return capabilities.has(id);
}

function enterLocomotion(signal: AvatarBodySignal, capabilities: AvatarBodyCapabilities): AvatarBodyState {
  return signal.forward && canUse(capabilities, "start-walking") ? "starting-walk" : "locomoting";
}

/**
 * Máquina de estados corporal deliberadamente pura. Decide qué estado procede,
 * pero no mueve el avatar ni escribe memoria: esos efectos pertenecen al visor
 * y, en el futuro, al ciclo de aprendizaje motor gobernado.
 */
export function advanceAvatarBodyState(
  state: AvatarBodyState,
  signal: AvatarBodySignal,
  capabilities: AvatarBodyCapabilities,
): AvatarBodyState {
  const moving = Number.isFinite(signal.movement) && signal.movement >= movingThreshold;

  if (state === "sitting-down") return signal.transitionFinished ? "sitting-idle" : state;
  if (state === "standing-up") {
    if (!signal.transitionFinished) return state;
    return moving ? enterLocomotion(signal, capabilities) : "standing-idle";
  }
  if (state === "starting-walk") {
    if (!moving) return "standing-idle";
    return signal.transitionFinished ? "locomoting" : state;
  }
  if (state === "jumping") {
    if (!signal.transitionFinished) return state;
    return moving ? "locomoting" : "standing-idle";
  }

  if (signal.togglePosture) {
    if (state === "sitting-idle") {
      return canUse(capabilities, "standing-up") ? "standing-up" : "standing-idle";
    }
    if (
      (state === "standing-idle" || state === "locomoting")
      && canUse(capabilities, "standing-up")
      && canUse(capabilities, "sitting-idle")
    ) return "sitting-down";
  }

  if (state === "sitting-idle") {
    if (!moving && !signal.jumpPressed) return state;
    return canUse(capabilities, "standing-up") ? "standing-up" : "standing-idle";
  }

  if (signal.jumpPressed && canUse(capabilities, "jump")) return "jumping";
  if (state === "locomoting") return moving ? state : "standing-idle";
  if (state === "standing-idle" && moving) return enterLocomotion(signal, capabilities);
  return state;
}

export function bodyStateAnimation(state: AvatarBodyState): AvatarAnimationId {
  if (state === "starting-walk") return "start-walking";
  if (state === "sitting-down" || state === "standing-up") return "standing-up";
  if (state === "sitting-idle") return "sitting-idle";
  if (state === "jumping") return "jump";
  return "idle";
}

export function isBodyTransition(state: AvatarBodyState) {
  return state === "starting-walk" || state === "jumping" || state === "sitting-down" || state === "standing-up";
}
