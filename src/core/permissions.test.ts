import { describe, expect, it } from "vitest";
import {
  createForegroundControlPreparation,
  createWebDevelopmentPermissionGateway,
  parsePermissionGatewayStatus,
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
    policy: { denyByDefault: true, persistentGrants: false, r2DecisionCommandsExposed: false, r2ExecutionCommandsExposed: false },
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
    expect(parsePermissionGatewayStatus(fallback.snapshot)).toEqual(fallback.snapshot);
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
});
