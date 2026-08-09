import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMHumanBoneName, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import type { VRM } from "@pixiv/three-vrm";

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
type AvatarViewerProps = {
  sourceUrl: string;
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

export function AvatarViewer({ sourceUrl, onTelemetry }: AvatarViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const poseRef = useRef<(mode: PoseMode) => void>(() => undefined);
  const [viewerState, setViewerState] = useState<ViewerState>("loading");
  const [poseMode, setPoseMode] = useState<PoseMode>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abortController = new AbortController();
    let disposed = false;
    let frame = 0;
    let currentVrm: VRM | null = null;

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
        applyPose(vrm, "idle");
        poseRef.current = (mode) => applyPose(vrm, mode);
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
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [onTelemetry, sourceUrl]);

  return <div className="avatar-viewer-shell">
    <div ref={hostRef} className="avatar-viewer" />
    <div className={`avatar-viewer-state state-${viewerState}`} aria-live="polite">
      <i />{viewerState === "loading" ? "CARGANDO VRM LOCAL" : viewerState === "ready" ? "VRM LISTO" : "ERROR DE VISOR"}
    </div>
    {viewerState === "ready" && <div className="avatar-viewer-actions"><button className="avatar-pose" type="button" onClick={() => { const next = poseMode === "idle" ? "reference" : "idle"; poseRef.current(next); setPoseMode(next); }}>{poseMode === "idle" ? "Ver pose de referencia" : "Volver a postura de reposo"}</button><button className="avatar-reset" type="button" onClick={() => resetRef.current()}>Restablecer cámara</button></div>}
    {viewerState === "error" && <div className="avatar-viewer-error"><strong>No se pudo mostrar Alice</strong><span>{error}</span></div>}
    <p className="avatar-viewer-help">POSTURA · {poseMode === "idle" ? "REPOSO LOCAL" : "REFERENCIA DEL RIG"}&nbsp;&nbsp; ARRASTRAR · GIRAR&nbsp;&nbsp; RUEDA · ZOOM&nbsp;&nbsp; CLIC DERECHO · MOVER</p>
  </div>;
}
