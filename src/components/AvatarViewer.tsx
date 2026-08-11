import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMHumanBoneName, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";
import {
  computeLocomotionWeights,
  footGroundCorrection,
  loadMixamoAnimation,
  type AvatarAnimationId,
  type AvatarAnimationUrls,
} from "../core/avatar-animation";
import {
  advanceManualAvatarMotion,
  diagnosticManualInputAt,
  readManualAvatarInput,
  selectManualGamepad,
  smoothManualAvatarInput,
  type GamepadSnapshot,
  type ManualAvatarInput,
  type ManualAvatarMotion,
} from "../core/manual-avatar-control";

const locomotionAnimationIds = ["idle", "forward", "backward", "left", "right"] as const;

export type AvatarTelemetry = {
  name: string;
  authors: string[];
  copyright: string;
  metaVersion: string;
  boneCount: number;
  expressionCount: number;
  springJointCount: number;
  colliderCount: number;
  creditRequired: boolean;
  redistributionAllowed: boolean;
  modification: string;
};

type ViewerState = "loading" | "ready" | "error";
type PoseMode = "idle" | "reference";
type ManualMode = "off" | "gamepad" | "diagnostic";
type ManualControlTelemetry = {
  state: "off" | "waiting" | "connected";
  device: string;
  input: ManualAvatarInput;
};
type AvatarViewerProps = {
  sourceUrl: string;
  animationUrls: AvatarAnimationUrls;
  onTelemetry: (telemetry: AvatarTelemetry | null) => void;
};

function readTelemetry(vrm: VRM): AvatarTelemetry {
  const meta = vrm.meta;
  const isVrm1 = "authors" in meta;
  return {
    name: isVrm1 ? meta.name || "Alice" : meta.title || "Alice",
    authors: isVrm1 ? meta.authors : meta.author ? [meta.author] : [],
    copyright: isVrm1 ? meta.copyrightInformation ?? "No indicado" : "No indicado",
    metaVersion: meta.metaVersion,
    boneCount: Object.keys(vrm.humanoid.humanBones).length,
    expressionCount: vrm.expressionManager?.expressions.length ?? 0,
    springJointCount: vrm.springBoneManager?.joints.size ?? 0,
    colliderCount: vrm.springBoneManager?.colliders.length ?? 0,
    creditRequired: isVrm1 ? meta.creditNotation === "required" : true,
    redistributionAllowed: isVrm1 ? Boolean(meta.allowRedistribution) : false,
    modification: isVrm1 ? meta.modification ?? "no indicada" : "no indicada",
  };
}

function poseRotation(x: number, y: number, z: number) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")).toArray();
}

function applyPose(vrm: VRM, mode: PoseMode) {
  if (mode === "reference") {
    vrm.humanoid.resetNormalizedPose();
  } else {
    vrm.humanoid.setNormalizedPose({
      [VRMHumanBoneName.LeftUpperArm]: { rotation: poseRotation(0, 0, -1.30) },
      [VRMHumanBoneName.RightUpperArm]: { rotation: poseRotation(0, 0, 1.30) },
      [VRMHumanBoneName.LeftLowerArm]: { rotation: poseRotation(0, -0.10, -0.08) },
      [VRMHumanBoneName.RightLowerArm]: { rotation: poseRotation(0, 0.10, 0.08) },
    });
  }
  vrm.humanoid.update();
}

function applyManualPose(vrm: VRM, input: ManualAvatarInput, gaitPhase: number, gaitIntensity: number) {
  const cycle = Math.sin(gaitPhase);
  const doubleCycle = Math.sin(gaitPhase * 2);
  const planar = Math.hypot(input.moveX, input.moveZ);
  const forwardWeight = planar > .01 ? Math.abs(input.moveZ) / planar : 0;
  const strafeWeight = planar > .01 ? Math.abs(input.moveX) / planar : 0;
  const turnWeight = planar > .01 ? Math.min(.35, Math.abs(input.turn)) : Math.min(1, Math.abs(input.turn));
  const forwardStride = cycle * gaitIntensity * forwardWeight * (Math.abs(input.moveZ) > .01 ? -Math.sign(input.moveZ) : 1);
  const strafeStride = cycle * gaitIntensity * strafeWeight * Math.sign(input.moveX);
  const turnStride = cycle * gaitIntensity * turnWeight * Math.sign(input.turn);
  const leftLift = Math.max(0, forwardStride) * .30 + Math.max(0, strafeStride) * .12 + Math.max(0, turnStride) * .08;
  const rightLift = Math.max(0, -forwardStride) * .30 + Math.max(0, -strafeStride) * .12 + Math.max(0, -turnStride) * .08;
  const leftHipPitch = forwardStride * .27 + turnStride * .03;
  const rightHipPitch = -forwardStride * .27 - turnStride * .03;
  const leftKnee = gaitIntensity * .025 + leftLift;
  const rightKnee = gaitIntensity * .025 + rightLift;
  const bodyStride = forwardStride + strafeStride * .22 + turnStride * .14;
  const lateralLean = input.moveX * -.045;
  const turnLean = input.turn * -.025;
  vrm.humanoid.setNormalizedPose({
    [VRMHumanBoneName.Hips]: { rotation: poseRotation(0, input.turn * .025, doubleCycle * gaitIntensity * .022 + lateralLean) },
    [VRMHumanBoneName.LeftUpperLeg]: { rotation: poseRotation(leftHipPitch, turnStride * .08, -strafeStride * .05) },
    [VRMHumanBoneName.RightUpperLeg]: { rotation: poseRotation(rightHipPitch, -turnStride * .08, strafeStride * .05) },
    [VRMHumanBoneName.LeftLowerLeg]: { rotation: poseRotation(leftKnee, 0, 0) },
    [VRMHumanBoneName.RightLowerLeg]: { rotation: poseRotation(rightKnee, 0, 0) },
    [VRMHumanBoneName.LeftFoot]: { rotation: poseRotation(-leftHipPitch * .42 - leftKnee * .30, turnStride * .08, 0) },
    [VRMHumanBoneName.RightFoot]: { rotation: poseRotation(-rightHipPitch * .42 - rightKnee * .30, -turnStride * .08, 0) },
    [VRMHumanBoneName.LeftToes]: { rotation: poseRotation(Math.max(0, forwardStride) * .10, 0, 0) },
    [VRMHumanBoneName.RightToes]: { rotation: poseRotation(Math.max(0, -forwardStride) * .10, 0, 0) },
    [VRMHumanBoneName.LeftUpperArm]: { rotation: poseRotation(-bodyStride * .30, 0, -1.30 + input.leftTrigger * .72) },
    [VRMHumanBoneName.RightUpperArm]: { rotation: poseRotation(bodyStride * .30, 0, 1.30 - input.rightTrigger * .72) },
    [VRMHumanBoneName.LeftLowerArm]: { rotation: poseRotation(0, -.10, -.08 - input.leftTrigger * .32) },
    [VRMHumanBoneName.RightLowerArm]: { rotation: poseRotation(0, .10, .08 + input.rightTrigger * .32) },
    [VRMHumanBoneName.Spine]: { rotation: poseRotation(input.moveZ * -.035, -bodyStride * .03, lateralLean + turnLean) },
    [VRMHumanBoneName.Chest]: { rotation: poseRotation(0, bodyStride * .05, -lateralLean * .45) },
    [VRMHumanBoneName.Head]: { rotation: poseRotation(0, -bodyStride * .016, -(lateralLean + turnLean) * .35) },
  });
  vrm.humanoid.update();
}

const idleManualInput: ManualAvatarInput = { moveX: 0, moveZ: 0, turn: 0, leftTrigger: 0, rightTrigger: 0, jump: false };

export function AvatarViewer({ sourceUrl, animationUrls, onTelemetry }: AvatarViewerProps) {
  const diagnosticAutostart = import.meta.env.VITE_ALICE_AVATAR_DIAGNOSTIC === "1";
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const poseRef = useRef<(mode: PoseMode) => void>(() => undefined);
  const manualModeRef = useRef<ManualMode>(diagnosticAutostart ? "diagnostic" : "off");
  const manualResetRef = useRef<() => void>(() => undefined);
  const [viewerState, setViewerState] = useState<ViewerState>("loading");
  const [poseMode, setPoseMode] = useState<PoseMode>("idle");
  const [manualMode, setManualMode] = useState<ManualMode>(diagnosticAutostart ? "diagnostic" : "off");
  const [manualControl, setManualControl] = useState<ManualControlTelemetry>({ state: "off", device: "", input: idleManualInput });
  const [error, setError] = useState("");

  useEffect(() => {
    manualModeRef.current = manualMode;
    if (manualMode === "off") {
      manualResetRef.current();
      setManualControl({ state: "off", device: "", input: idleManualInput });
    }
  }, [manualMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abortController = new AbortController();
    let disposed = false;
    let frame = 0;
    let currentVrm: VRM | null = null;
    let animationMixer: THREE.AnimationMixer | null = null;
    let animationActions: Partial<Record<AvatarAnimationId, THREE.AnimationAction>> = {};
    let animationPlaybackEnabled = false;
    let jumpActive = false;
    let jumpWasPressed = false;
    let groundCorrection = 0;
    let referenceFootY: number | null = null;
    let normalizedHips: THREE.Object3D | null = null;
    let normalizedLeftFoot: THREE.Object3D | null = null;
    let normalizedRightFoot: THREE.Object3D | null = null;
    let manualMotion: ManualAvatarMotion = { x: 0, z: 0, yaw: 0 };
    let gaitPhase = 0;
    let gaitIntensity = 0;
    let diagnosticElapsed = 0;
    let smoothedInput = idleManualInput;
    let manualWasEnabled = false;
    let nextManualTelemetryAt = 0;
    const initialAvatarPosition = new THREE.Vector3();
    const initialAvatarQuaternion = new THREE.Quaternion();

    const applyLocomotionBlend = (input: ManualAvatarInput) => {
      const weights = computeLocomotionWeights(input.moveX, input.moveZ, input.turn);
      const movement = Math.min(1, Math.hypot(input.moveX, input.moveZ) + Math.abs(input.turn) * .38);
      const cyclesPerSecond = .68 + movement * .58;
      for (const id of locomotionAnimationIds) {
        const action = animationActions[id];
        if (!action) continue;
        action.enabled = true;
        action.setEffectiveWeight(weights[id]);
        action.setEffectiveTimeScale(id === "idle" ? .72 : action.getClip().duration * cyclesPerSecond);
        if (!action.isScheduled()) action.play();
      }
      animationPlaybackEnabled = true;
    };

    const playJump = () => {
      const jump = animationActions.jump;
      if (!jump) return false;
      for (const id of locomotionAnimationIds) animationActions[id]?.setEffectiveWeight(0);
      jump.enabled = true;
      jump.setEffectiveWeight(1);
      jump.setEffectiveTimeScale(1);
      jump.setLoop(THREE.LoopOnce, 1);
      jump.clampWhenFinished = true;
      jump.reset().play();
      animationPlaybackEnabled = true;
      return true;
    };

    const restoreIdle = () => {
      jumpActive = false;
      jumpWasPressed = false;
      animationActions.jump?.stop();
      if (animationActions.idle) applyLocomotionBlend(idleManualInput);
      else applyPose(currentVrm!, "idle");
    };

    setViewerState("loading");
    setError("");
    onTelemetry(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050b16);
    scene.fog = new THREE.FogExp2(0x050b16, 0.045);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 1, 5);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (cause) {
      setViewerState("error");
      setError(`WebGL no está disponible: ${String(cause)}`);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-label", "Visor tridimensional local del avatar Alice");
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.screenSpacePanning = true;
    controls.enablePan = true;
    controls.target.set(0, 1, 0);

    const ambient = new THREE.HemisphereLight(0xdff6ff, 0x111827, 2.1);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(2.2, 3.8, 3.2);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
    rimLight.position.set(-3, 2.2, -2.8);
    scene.add(ambient, keyLight, rimLight);

    const grid = new THREE.GridHelper(8, 32, 0x0ea5e9, 0x12324a);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = .3; });
    scene.add(grid);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), .05);
      const activeMode = manualModeRef.current;
      if (currentVrm && activeMode !== "off") {
        manualWasEnabled = true;
        const gamepads = activeMode === "gamepad" && typeof navigator.getGamepads === "function"
          ? Array.from(navigator.getGamepads()) as (GamepadSnapshot | null)[]
          : [];
        const gamepad = activeMode === "gamepad" ? selectManualGamepad(gamepads) : null;
        if (activeMode === "diagnostic" || gamepad) {
          diagnosticElapsed = activeMode === "diagnostic" ? diagnosticElapsed + delta : 0;
          const targetInput = activeMode === "diagnostic"
            ? diagnosticManualInputAt(diagnosticElapsed)
            : readManualAvatarInput(gamepad!);
          smoothedInput = smoothManualAvatarInput(smoothedInput, targetInput, delta);
          const input = smoothedInput;
          if (input.jump && !jumpWasPressed && animationActions.jump) {
            jumpActive = playJump();
          }
          jumpWasPressed = input.jump;
          if (jumpActive && !animationActions.jump?.isRunning()) jumpActive = false;
          if (!jumpActive) applyLocomotionBlend(input);
          const targetGait = Math.min(1, Math.hypot(input.moveX, input.moveZ) + Math.abs(input.turn) * .55);
          gaitIntensity += (targetGait - gaitIntensity) * Math.min(1, delta * 8);
          if (targetGait > .02) gaitPhase += delta * (4.2 + targetGait * 4.8);
          manualMotion = advanceManualAvatarMotion(manualMotion, input, delta);
          currentVrm.scene.position.set(
            initialAvatarPosition.x + manualMotion.x,
            initialAvatarPosition.y + Math.abs(Math.sin(gaitPhase * 2)) * gaitIntensity * .008,
            initialAvatarPosition.z + manualMotion.z,
          );
          currentVrm.scene.quaternion.copy(initialAvatarQuaternion);
          currentVrm.scene.rotateY(manualMotion.yaw);
          if (!animationMixer || Object.keys(animationActions).length === 0) {
            applyManualPose(currentVrm, input, gaitPhase, gaitIntensity);
          }
          if (performance.now() >= nextManualTelemetryAt) {
            nextManualTelemetryAt = performance.now() + 160;
            setManualControl({
              state: "connected",
              device: activeMode === "diagnostic" ? "SECUENCIA LOCAL · 8 S · SIN PERSISTENCIA" : gamepad!.id,
              input,
            });
          }
        } else if (performance.now() >= nextManualTelemetryAt) {
          manualMotion = { x: 0, z: 0, yaw: 0 };
          gaitPhase = 0;
          gaitIntensity = 0;
          smoothedInput = idleManualInput;
          currentVrm.scene.position.copy(initialAvatarPosition);
          currentVrm.scene.quaternion.copy(initialAvatarQuaternion);
          restoreIdle();
          nextManualTelemetryAt = performance.now() + 300;
          setManualControl({ state: "waiting", device: "", input: idleManualInput });
        }
      } else if (currentVrm && manualWasEnabled) {
        manualWasEnabled = false;
        manualMotion = { x: 0, z: 0, yaw: 0 };
        gaitPhase = 0;
        gaitIntensity = 0;
        diagnosticElapsed = 0;
        smoothedInput = idleManualInput;
        currentVrm.scene.position.copy(initialAvatarPosition);
        currentVrm.scene.quaternion.copy(initialAvatarQuaternion);
        restoreIdle();
      }
      animationMixer?.update(delta);
      if (
        currentVrm && animationPlaybackEnabled && !jumpActive && referenceFootY != null
        && normalizedHips && normalizedLeftFoot && normalizedRightFoot
      ) {
        currentVrm.scene.updateMatrixWorld(true);
        const leftY = normalizedLeftFoot.getWorldPosition(new THREE.Vector3()).y;
        const rightY = normalizedRightFoot.getWorldPosition(new THREE.Vector3()).y;
        const targetCorrection = footGroundCorrection(leftY, rightY, referenceFootY);
        groundCorrection += (targetCorrection - groundCorrection) * Math.min(1, delta * 18);
        normalizedHips.position.y += groundCorrection;
        normalizedHips.updateMatrixWorld(true);
      } else {
        groundCorrection = 0;
      }
      currentVrm?.update(delta);
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const load = async () => {
      try {
        const response = await fetch(sourceUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error(`No se pudo leer el archivo local (${response.status})`);
        const data = await response.arrayBuffer();
        if (disposed) return;
        const gltf = await loader.parseAsync(data, "");
        if (disposed) {
          const abandoned = gltf.userData.vrm as VRM | undefined;
          if (abandoned) VRMUtils.deepDispose(abandoned.scene);
          return;
        }
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) throw new Error("El archivo no contiene una extensión VRM reconocible");
        currentVrm = vrm;
        initialAvatarPosition.copy(vrm.scene.position);
        initialAvatarQuaternion.copy(vrm.scene.quaternion);
        applyPose(vrm, "idle");

        const loadedAnimations = await Promise.allSettled(
          (Object.entries(animationUrls) as [AvatarAnimationId, string][]).map(async ([id, url]) => [id, await loadMixamoAnimation(url, vrm, id)] as const),
        );
        if (disposed) return;
        animationMixer = new THREE.AnimationMixer(vrm.scene);
        animationActions = {};
        for (const result of loadedAnimations) {
          if (result.status === "fulfilled") {
            const [id, clip] = result.value;
            animationActions[id] = animationMixer.clipAction(clip);
          } else {
            console.error("No se pudo cargar una animación corporal", result.reason);
          }
        }
        normalizedHips = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Hips);
        normalizedLeftFoot = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftFoot);
        normalizedRightFoot = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightFoot);
        applyLocomotionBlend(idleManualInput);
        animationMixer.update(0);
        vrm.scene.updateMatrixWorld(true);
        if (normalizedLeftFoot && normalizedRightFoot) {
          referenceFootY = Math.min(
            normalizedLeftFoot.getWorldPosition(new THREE.Vector3()).y,
            normalizedRightFoot.getWorldPosition(new THREE.Vector3()).y,
          );
        }
        poseRef.current = (mode) => {
          if (mode === "reference") {
            animationMixer?.stopAllAction();
            animationPlaybackEnabled = false;
            applyPose(vrm, mode);
          } else if (animationActions.idle) applyLocomotionBlend(idleManualInput);
          else applyPose(vrm, mode);
        };
        manualResetRef.current = () => {
          manualMotion = { x: 0, z: 0, yaw: 0 };
          gaitPhase = 0;
          gaitIntensity = 0;
          diagnosticElapsed = 0;
          smoothedInput = idleManualInput;
          vrm.scene.position.copy(initialAvatarPosition);
          vrm.scene.quaternion.copy(initialAvatarQuaternion);
          restoreIdle();
        };
        setPoseMode("idle");
        vrm.scene.traverse((object) => { object.frustumCulled = false; });
        scene.add(vrm.scene);

        const box = new THREE.Box3().setFromObject(vrm.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const verticalDistance = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)));
        const distance = Math.max(1.3, verticalDistance * 1.08);
        grid.position.y = box.min.y;

        const resetCamera = () => {
          controls.target.copy(center);
          camera.position.set(center.x, center.y + size.y * .015, center.z + distance);
          camera.near = Math.max(.01, distance / 100);
          camera.far = Math.max(100, distance * 12);
          camera.updateProjectionMatrix();
          controls.minDistance = Math.max(.3, distance * .28);
          controls.maxDistance = distance * 3.2;
          controls.update();
        };
        resetRef.current = resetCamera;
        resetCamera();
        onTelemetry(readTelemetry(vrm));
        setViewerState("ready");
      } catch (cause) {
        if (disposed || abortController.signal.aborted) return;
        setViewerState("error");
        setError(String(cause));
      }
    };
    void load();

    return () => {
      disposed = true;
      abortController.abort();
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      resetRef.current = () => undefined;
      poseRef.current = () => undefined;
      manualResetRef.current = () => undefined;
      manualModeRef.current = "off";
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      animationMixer?.stopAllAction();
      animationMixer = null;
      animationActions = {};
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [animationUrls, onTelemetry, sourceUrl]);

  return <div className="avatar-viewer-shell">
    <div ref={hostRef} className="avatar-viewer" />
    <div className={`avatar-viewer-state state-${viewerState}`} aria-live="polite">
      <i />{viewerState === "loading" ? "CARGANDO VRM LOCAL" : viewerState === "ready" ? "VRM LISTO" : "ERROR DE VISOR"}
    </div>
    {viewerState === "ready" && <div className="avatar-viewer-actions"><button className={`avatar-gamepad ${manualMode === "gamepad" ? "active" : ""}`} type="button" aria-pressed={manualMode === "gamepad"} onClick={() => { setPoseMode("idle"); setManualMode((mode) => mode === "gamepad" ? "off" : "gamepad"); }}>{manualMode === "gamepad" ? "Detener control PS5" : "Probar control PS5"}</button><button className={`avatar-gait-test ${manualMode === "diagnostic" ? "active" : ""}`} type="button" aria-pressed={manualMode === "diagnostic"} onClick={() => { setPoseMode("idle"); setManualMode((mode) => mode === "diagnostic" ? "off" : "diagnostic"); }}>{manualMode === "diagnostic" ? "Detener ensayo" : "Ensayar marcha"}</button><button className="avatar-pose" type="button" disabled={manualMode !== "off"} onClick={() => { const next = poseMode === "idle" ? "reference" : "idle"; poseRef.current(next); setPoseMode(next); }}>{poseMode === "idle" ? "Ver pose de referencia" : "Volver a postura de reposo"}</button><button className="avatar-reset" type="button" onClick={() => resetRef.current()}>Restablecer cámara</button></div>}
    {manualMode !== "off" && <div className={`avatar-gamepad-status ${manualControl.state}`} aria-live="polite">
      <strong>{manualMode === "diagnostic" ? "ENSAYO PROCEDURAL · CONTROL TÉCNICO" : manualControl.state === "connected" ? "DUALSENSE · CONTROL HUMANO" : "ESPERANDO ENTRADA GAMEPAD"}</strong>
      <span>{manualControl.state === "connected" ? manualControl.device : "Presioná un botón o mové un stick para que WebView active el mando."}</span>
      <code>LX {manualControl.input.moveX.toFixed(2)} · LY {manualControl.input.moveZ.toFixed(2)} · RX {manualControl.input.turn.toFixed(2)} · X {manualControl.input.jump ? "SALTO" : "—"} · L2 {manualControl.input.leftTrigger.toFixed(2)} · R2 {manualControl.input.rightTrigger.toFixed(2)}</code>
    </div>}
    {viewerState === "error" && <div className="avatar-viewer-error"><strong>No se pudo mostrar Alice</strong><span>{error}</span></div>}
    <p className="avatar-viewer-help">{manualMode === "gamepad" ? "PS5 · STICK IZQ MOVER · STICK DER GIRAR · X SALTAR · DETENER RESTABLECE" : manualMode === "diagnostic" ? "ENSAYO 8 S · AVANCE · RETROCESO · LATERAL · GIRO · REPOSO · SIN MEMORIA" : <>POSTURA · {poseMode === "idle" ? "REPOSO ANIMADO" : "REFERENCIA DEL RIG"}&nbsp;&nbsp; ARRASTRAR · GIRAR&nbsp;&nbsp; RUEDA · ZOOM&nbsp;&nbsp; CLIC DERECHO · MOVER</>}</p>
  </div>;
}
