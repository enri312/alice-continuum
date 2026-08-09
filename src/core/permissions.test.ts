import { describe, expect, it } from "vitest";
import {
  createCancelPermissionInput,
  createExecutePermissionInput,
  createForegroundControlPreparation,
  createPermissionDecisionInput,
  createRevokePermissionInput,
  createSensorPreparation,
  createWebDevelopmentPermissionGateway,
  parsePermissionGrant,
  parseContextObservationExecutionResult,
  parsePermissionGatewayStatus,
  parsePreparedPermissionRequest,
  parseSensorLeaseExecutionResult,
  parseSensorLeaseStatus,
} from "./permissions";

const digest = `sha256:${"a".repeat(64)}`;

function request() {
  return {
    schemaVersion: 1,
    requestId: "request_0123456789",
    idempotencyKey: "prepare-context-001",
    capabilityId: "context.foreground.control",
    capabilityVersion: 1,
    operation: "setContextObservationEnabled",
    mode: "session",
    purpose: "Observar la aplicación activa durante esta sesión.",
    resource: { kind: "window", stableId: "foreground-window", label: "Ventana en primer plano" },
    dataScopes: ["windowMetadata"],
    effects: ["windowMetadataRead"],
    risk: "medium",
    createdAt: "2026-08-09T15:00:00Z",
    decisionExpiresAt: "2026-08-09T15:05:00Z",
    requestedDurationSeconds: 300,
    maximumDurationSeconds: 300,
    executionPlanDigest: digest,
    previewDigest: digest,
    state: "awaitingDecision",
    summary: "Alice solicita observar temporalmente los metadatos de la ventana activa.",
    warnings: ["El título y proceso serán visibles localmente."],
  };
}

function status(requests: unknown[] = [request()]) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-09T15:00:01Z",
    policy: { denyByDefault: true, persistentGrants: false, r2DecisionCommandsExposed: true, r2ExecutionCommandsExposed: true },
    limits: { highRiskDecisionTtlSeconds: 60, standardDecisionTtlSeconds: 300, maximumSessionDurationSeconds: 300 },
    requests,
    grants: [],
  };
}

describe("permission gateway contract", () => {
  it("acepta el estado nativo estricto sin parámetros privados", () => {
    const parsed = parsePermissionGatewayStatus(status());

    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0].state).toBe("awaitingDecision");
    expect(parsed.grants).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain("enabled");
  });

  it("rechaza campos de parámetros ejecutables filtrados en el estado", () => {
    const leaked = { ...request(), executionParameters: { enabled: true } };

    expect(() => parsePermissionGatewayStatus(status([leaked]))).toThrow(/campos desconocidos/);
  });

  it("rechaza una política que exponga ejecución o grants persistentes", () => {
    expect(() => parsePermissionGatewayStatus({
      ...status(),
      policy: { denyByDefault: true, persistentGrants: true, r2DecisionCommandsExposed: true, r2ExecutionCommandsExposed: true },
    })).toThrow(/policy/);
  });

  it("rechaza límites, versiones y estados desconocidos", () => {
    expect(() => parsePermissionGatewayStatus({ ...status(), schemaVersion: 2 })).toThrow(/schemaVersion/);
    expect(() => parsePermissionGatewayStatus({
      ...status(),
      limits: { highRiskDecisionTtlSeconds: 60, standardDecisionTtlSeconds: 300, maximumSessionDurationSeconds: 999 },
    })).toThrow(/limits/);
    expect(() => parsePermissionGatewayStatus(status([{ ...request(), state: "executed" }]))).toThrow(/desconocido/);
  });

  it("rechaza solicitudes repetidas y duraciones oneShot inventadas", () => {
    const oneShot = { ...request(), mode: "oneShot", requestedDurationSeconds: 10, maximumDurationSeconds: 10 };
    expect(() => parsePermissionGatewayStatus(status([request(), request()]))).toThrow(/repetido/);
    expect(() => parsePermissionGatewayStatus(status([oneShot]))).toThrow(/no admite duración/);
  });

  it("produce un fallback web vacío y explícito", () => {
    const fallback = createWebDevelopmentPermissionGateway(new Date("2026-08-09T15:00:00Z"));

    expect(fallback.source).toBe("webDevelopment");
    expect(fallback.snapshot.requests).toEqual([]);
    expect(fallback.snapshot.grants).toEqual([]);
    expect(fallback.snapshot.policy.r2DecisionCommandsExposed).toBe(false);
    expect(fallback.snapshot.policy.r2ExecutionCommandsExposed).toBe(false);
  });

  it("construye únicamente la preparación conocida de contexto", () => {
    expect(createForegroundControlPreparation(
      "prepare-context-004",
      "Observar temporalmente la aplicación activa.",
      true,
    )).toEqual({
      idempotencyKey: "prepare-context-004",
      capabilityId: "context.foreground.control",
      operation: "setContextObservationEnabled",
      purpose: "Observar temporalmente la aplicación activa.",
      parameters: { enabled: true },
    });
  });

  it("rechaza una clave corta o un propósito vacío antes de invocar Tauri", () => {
    expect(() => createForegroundControlPreparation("short", "Observar.", true)).toThrow(/idempotencyKey/);
    expect(() => createForegroundControlPreparation("prepare-context-005", " ", true)).toThrow(/purpose/);
  });

  it("construye decisiones, cancelaciones y revocaciones ligadas a IDs opacos", () => {
    const parsedRequest = parsePreparedPermissionRequest(request());

    expect(createPermissionDecisionInput(parsedRequest, "approve")).toEqual({
      requestId: parsedRequest.requestId,
      previewDigest: digest,
      decision: "approve",
    });
    expect(createCancelPermissionInput(parsedRequest.requestId)).toEqual({ requestId: parsedRequest.requestId });
    expect(createRevokePermissionInput("grant_0123456789")).toEqual({ grantId: "grant_0123456789" });
    expect(createExecutePermissionInput("grant_0123456789")).toEqual({ grantId: "grant_0123456789" });
  });

  it("valida un grant de sesión aprobado sin convertirlo en ejecución", () => {
    const grant = parsePermissionGrant({
      schemaVersion: 1,
      grantId: "grant_0123456789",
      requestId: "request_0123456789",
      previewDigest: digest,
      capabilityId: "context.foreground.control",
      operation: "setContextObservationEnabled",
      mode: "session",
      issuedAt: "2026-08-09T15:00:02Z",
      expiresAt: "2026-08-09T15:05:02Z",
      remainingUses: null,
      state: "approved",
    });

    expect(grant.state).toBe("approved");
    expect(grant.remainingUses).toBeNull();
  });

  it("rechaza estados o usos incompatibles con el modo del grant", () => {
    const baseGrant = {
      schemaVersion: 1,
      grantId: "grant_0123456789",
      requestId: "request_0123456789",
      previewDigest: digest,
      capabilityId: "context.foreground.control",
      operation: "setContextObservationEnabled",
      mode: "oneShot",
      issuedAt: "2026-08-09T15:00:02Z",
      expiresAt: "2026-08-09T15:05:02Z",
      remainingUses: 1,
      state: "approved",
    };

    expect(() => parsePermissionGrant({ ...baseGrant, state: "active" })).toThrow(/estado session/);
    expect(() => parsePermissionGrant({ ...baseGrant, remainingUses: 0 })).toThrow(/remainingUses=1/);
    expect(() => parsePermissionGrant({ ...baseGrant, expiresAt: "2026-08-09T15:00:01Z" })).toThrow(/límite R2/);
  });

  it("valida el resultado ejecutado de una sesión de observación", () => {
    const result = parseContextObservationExecutionResult({
      enabled: true,
      grant: {
        schemaVersion: 1,
        grantId: "grant_0123456789",
        requestId: "request_0123456789",
        previewDigest: digest,
        capabilityId: "context.foreground.control",
        operation: "setContextObservationEnabled",
        mode: "session",
        issuedAt: "2026-08-09T15:00:02Z",
        expiresAt: "2026-08-09T15:05:02Z",
        remainingUses: null,
        state: "active",
      },
    });

    expect(result.enabled).toBe(true);
    expect(result.grant.state).toBe("active");
  });

  it("rechaza una ejecución que contradiga el modo o estado del grant", () => {
    expect(() => parseContextObservationExecutionResult({
      enabled: false,
      grant: {
        schemaVersion: 1,
        grantId: "grant_0123456789",
        requestId: "request_0123456789",
        previewDigest: digest,
        capabilityId: "context.foreground.control",
        operation: "setContextObservationEnabled",
        mode: "session",
        issuedAt: "2026-08-09T15:00:02Z",
        expiresAt: "2026-08-09T15:05:02Z",
        remainingUses: null,
        state: "active",
      },
    })).toThrow(/oneShot completado/);
  });

  it("construye perfiles sensoriales cerrados y limita la duración a 60 segundos", () => {
    expect(createSensorPreparation("camera", "sensor-camera-0001", "Verificar cámara viva.", 60)).toEqual({
      idempotencyKey: "sensor-camera-0001",
      capabilityId: "perception.camera.observe",
      operation: "observeAuthorizedCamera",
      purpose: "Verificar cámara viva.",
      parameters: { durationSeconds: 60 },
    });
    expect(createSensorPreparation("microphone", "sensor-microphone-01", "Verificar micrófono vivo.", 30).capabilityId).toBe("perception.microphone.observe");
    expect(() => createSensorPreparation("camera", "sensor-camera-0002", "Verificar.", 61)).toThrow(/1 y 60/);
  });

  it("valida un lease real sin persistencia y ligado a su grant activo", () => {
    const lease = {
      kind: "camera",
      capabilityId: "perception.camera.observe",
      grantId: "grant_sensor_camera_001",
      device: { kind: "camera", stableId: "camera-acer-hd-user-facing", label: "ACER HD User Facing" },
      adapter: "OpenCV 5 · DirectShow · proceso local controlado",
      expiresAt: "2026-08-09T15:01:02Z",
      maximumDurationSeconds: 60,
      indicator: "ACTIVO · SEÑAL VIVA · DESCARTE INMEDIATO",
      rawPersistence: false,
      verifiedSignalUnits: 3,
      width: 640,
      height: 480,
      sampleRateHz: null,
    };
    expect(parseSensorLeaseStatus({ schemaVersion: 1, leases: [lease] }).leases[0].width).toBe(640);
    const result = parseSensorLeaseExecutionResult({
      lease,
      grant: {
        schemaVersion: 1,
        grantId: "grant_sensor_camera_001",
        requestId: "request_sensor_camera_01",
        previewDigest: digest,
        capabilityId: "perception.camera.observe",
        operation: "observeAuthorizedCamera",
        mode: "session",
        issuedAt: "2026-08-09T15:00:02Z",
        expiresAt: "2026-08-09T15:01:02Z",
        remainingUses: null,
        state: "active",
      },
    });
    expect(result.lease.rawPersistence).toBe(false);
  });

  it("rechaza telemetría sensorial ficticia o contradictoria", () => {
    const microphone = {
      kind: "microphone",
      capabilityId: "perception.microphone.observe",
      grantId: "grant_sensor_microphone_01",
      device: { kind: "microphone", stableId: "microphone-array-intel-smart-sound", label: "Microphone Array" },
      adapter: "PortAudio · WASAPI",
      expiresAt: "2026-08-09T15:01:02Z",
      maximumDurationSeconds: 60,
      indicator: "ACTIVO",
      rawPersistence: false,
      verifiedSignalUnits: 11025,
      width: null,
      height: null,
      sampleRateHz: 44100,
    };
    expect(() => parseSensorLeaseStatus({ schemaVersion: 1, leases: [{ ...microphone, rawPersistence: true }] })).toThrow(/rawPersistence/);
    expect(() => parseSensorLeaseStatus({ schemaVersion: 1, leases: [{ ...microphone, width: 640 }] })).toThrow(/sampleRateHz/);
    expect(() => parseSensorLeaseStatus({ schemaVersion: 1, leases: [microphone, microphone] })).toThrow(/repite/);
  });
});
