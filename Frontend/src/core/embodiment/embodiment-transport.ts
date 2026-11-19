import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import {
  createCancelPermissionInput, createFaceLandmarkPreparation, createPermissionDecisionInput, createRevokePermissionInput,
  parsePermissionGatewayStatus, parsePermissionGrant, parsePreparedPermissionRequest,
  type PermissionGrant, type PreparedPermissionRequest,
} from "../governance/permissions";
import { startSerializedPolling } from "../shared/polling";
import { parseFaceReadinessStatus, type FaceReadinessStatus } from "./face-readiness";
import type { AvatarAnimationId, AvatarAnimationUrls } from "./avatar-animation";
import type { AvatarSceneState, mountAvatarScene } from "./avatar-scene";

export type EmbodimentView = "face" | "body" | "avatar";
type AvatarFile = { available: boolean; path: string; fileName: string; sizeBytes: number };
type AvatarAnimations = { clips: { id: AvatarAnimationId; path: string; available: boolean }[] };

export function createEmbodimentTransport(view: EmbodimentView, sceneId: string) {
  let reply: ((value: unknown) => void) | undefined;
  let disposePolling: (() => void) | undefined;
  let disposed = false;
  let face: FaceReadinessStatus | null = null;
  let faceError = "";
  let request: PreparedPermissionRequest | null = null;
  let grant: PermissionGrant | null = null;
  let busy = false;
  let generation = 0;
  let permissionText = "R2 disponible · sin solicitud";
  let pollingError = "";
  let gatewayReady = false;
  let sourceUrl = "";
  let animationUrls: AvatarAnimationUrls = {};
  let scene: ReturnType<typeof mountAvatarScene>;
  let attaching = false;

  function publishFace() {
    reply?.({
      type: "face",
      face, error: faceError, busy: busy || !gatewayReady, permissionText: pollingError || permissionText,
      request: request ? { id: request.requestId, state: request.state } : null,
      grant: grant ? { id: grant.grantId, state: grant.state } : null,
    });
  }

  async function readGateway() {
    const status = parsePermissionGatewayStatus(await invoke("permission_gateway_status"));
    const requests = status.requests.filter(item => item.capabilityId === "perception.face.landmarks");
    const grants = status.grants.filter(item => item.capabilityId === "perception.face.landmarks");
    return {
      request: requests.find(item => item.state === "awaitingDecision") ?? requests.at(-1) ?? null,
      grant: grants.find(item => item.state === "active" || item.state === "approved") ?? grants.at(-1) ?? null,
    };
  }

  async function permission(action: Record<string, unknown>) {
    if (busy || !gatewayReady) return;
    const command = action.type;
    const pending = request?.state === "awaitingDecision" ? request : null;
    const revocable = grant?.state === "approved" || grant?.state === "active" ? grant : null;
    if (command === "prepare") {
      if (pending || revocable || face?.model.state !== "verified" || !face.runtime.available) return;
    } else if (command === "revoke") {
      if (!revocable || revocable.grantId !== action.id) return;
    } else if (!pending || pending.requestId !== action.id || !["approve", "deny", "cancel"].includes(String(command))) {
      return;
    }
    busy = true;
    ++generation;
    publishFace();
    try {
      if (command === "prepare") {
        request = parsePreparedPermissionRequest(await invoke("prepare_permission_request", {
          input: createFaceLandmarkPreparation(`face-${crypto.randomUUID()}`, "Derivar movimiento facial efímero para controlar expresiones de Alice.", 60),
        }));
        permissionText = "Solicitud preparada · cámara cerrada · decisión requerida";
      } else if (command === "cancel" && pending) {
        request = parsePreparedPermissionRequest(await invoke("cancel_permission_request", { input: createCancelPermissionInput(pending.requestId) }));
        permissionText = "Solicitud cancelada · cámara cerrada";
      } else if (command === "revoke" && revocable) {
        grant = parsePermissionGrant(await invoke("revoke_permission_grant", { input: createRevokePermissionInput(revocable.grantId) }));
        permissionText = "Autorización revocada · cámara cerrada";
      } else if (pending && (command === "approve" || command === "deny")) {
        const result = await invoke<unknown>("decide_permission_request", { input: createPermissionDecisionInput(pending, command) });
        if (result !== null) grant = parsePermissionGrant(result);
        permissionText = command === "approve" ? "Grant creado · activación facial todavía bloqueada" : "Solicitud denegada · cámara cerrada";
      }
    } catch (cause) {
      permissionText = `R2 bloqueó la operación · ${String(cause)}`;
    } finally {
      if (!disposed) {
        try {
          ({ request, grant } = await readGateway());
          gatewayReady = true;
          pollingError = "";
        } catch (cause) {
          gatewayReady = false;
          pollingError = `R2 no pudo refrescar el estado · ${String(cause)}`;
        }
        busy = false;
        ++generation;
        publishFace();
      }
    }
  }

  function connectFace() {
    void invoke("face_readiness_status").then(parseFaceReadinessStatus).then(status => {
      face = status;
      publishFace();
    }).catch(cause => { faceError = String(cause); publishFace(); });
    disposePolling = startSerializedPolling({
      intervalMs: 5_000,
      read: async () => {
        const revision = generation;
        try { return { revision, value: await readGateway(), error: "" }; }
        catch (cause) { return { revision, value: null, error: `R2 no disponible · ${String(cause)}` }; }
      },
      onValue: result => {
        if (busy || generation !== result.revision) return;
        if (result.value) ({ request, grant } = result.value);
        gatewayReady = result.value !== null;
        pollingError = result.error;
        publishFace();
      },
      onError: () => {},
    });
  }

  function connectAvatar() {
    void Promise.all([invoke<AvatarFile>("avatar_status"), invoke<AvatarAnimations>("avatar_animation_status")])
      .then(([file, animations]) => {
        if (disposed) return;
        const clips = animations.clips.filter(clip => clip.available);
        animationUrls = Object.fromEntries(clips.map(clip => [clip.id, convertFileSrc(clip.path)]));
        sourceUrl = file.available ? convertFileSrc(file.path) : "";
        reply?.({ type: "avatarFile", file, clips: clips.length, posture: Boolean(animationUrls["standing-up"] && animationUrls["sitting-idle"]) });
      }).catch(cause => reply?.({ type: "avatarError", error: String(cause) }));
  }

  async function attach() {
    const host = document.getElementById(sceneId);
    if (!(host instanceof HTMLDivElement) || !sourceUrl || attaching || scene) return;
    attaching = true;
    try {
      const { mountAvatarScene } = await import("./avatar-scene");
      if (disposed || !host.isConnected) return;
      scene = mountAvatarScene(host, {
        sourceUrl, animationUrls,
        publish: (patch: Partial<AvatarSceneState>) => reply?.({ type: "viewer", patch }),
        onTelemetry: telemetry => reply?.({ type: "avatarTelemetry", telemetry }),
        onMotorTransition: input => {
          void invoke("record_avatar_motor_transition", { input }).then(() => reply?.({ type: "motor", ready: true }))
            .catch(() => reply?.({ type: "motor", ready: false }));
        },
      });
    } catch (cause) {
      reply?.({ type: "viewer", patch: { state: "error", error: String(cause) } });
    } finally { attaching = false; }
  }

  return {
    dispatch(raw: string, send: (value: unknown) => void) {
      if (disposed || !isTauri()) return;
      let action;
      try { action = JSON.parse(raw); } catch { return; }
      if (action?.type === "connect" && !reply) {
        reply = send;
        if (view === "face") connectFace();
        if (view === "avatar") connectAvatar();
        return;
      }
      if (view === "face" && action && typeof action.type === "string") void permission(action);
      if (view === "avatar") {
        switch (action?.type) {
          case "attach": void attach(); break;
          case "gamepad": scene?.toggleManual("gamepad"); break;
          case "diagnostic": scene?.toggleManual("diagnostic"); break;
          case "pose": scene?.togglePose(); break;
          case "posture": scene?.togglePosture(); break;
          case "reset": scene?.resetCamera(); break;
        }
      }
    },
    dispose() { disposed = true; reply = undefined; disposePolling?.(); scene?.dispose(); },
  };
}
