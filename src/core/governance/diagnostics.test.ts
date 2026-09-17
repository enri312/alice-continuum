import { describe, expect, it } from "vitest";
import { parseDiagnosticSnapshot } from "./diagnostics";

const checks = [
  { id: "path.data-root", category: "path", label: "Directorio de datos", status: "healthy", summary: "Ruta local disponible." },
  { id: "provider.openai", category: "provider", label: "OpenAI", status: "configurationPending", summary: "Sin configuración completa." },
  { id: "adapter.face-body-output", category: "adapter", label: "Salida de rostro y cuerpo", status: "unavailable", summary: "Permanece planificado." },
];

const snapshot = {
  schemaVersion: 1,
  generatedAtMs: 1_786_280_000_000,
  overallStatus: "attention",
  summary: { total: 3, healthy: 1, configurationPending: 1, unavailable: 1, errors: 0 },
  checks,
};

describe("parseDiagnosticSnapshot", () => {
  it("acepta estados pasivos diferenciados y conteos coherentes", () => {
    const parsed = parseDiagnosticSnapshot(snapshot);
    expect(parsed.overallStatus).toBe("attention");
    expect(parsed.checks.map((item) => item.status)).toEqual(["healthy", "configurationPending", "unavailable"]);
  });

  it("rechaza campos privados o desconocidos", () => {
    expect(() => parseDiagnosticSnapshot({ ...snapshot, apiKey: "no permitido" })).toThrow();
    expect(() => parseDiagnosticSnapshot({ ...snapshot, checks: [{ ...checks[0], path: "E:\\privado" }, ...checks.slice(1)] })).toThrow();
  });

  it("rechaza duplicados, conteos y estados generales inventados", () => {
    expect(() => parseDiagnosticSnapshot({ ...snapshot, checks: [checks[0], checks[0], checks[2]] })).toThrow();
    expect(() => parseDiagnosticSnapshot({ ...snapshot, summary: { ...snapshot.summary, healthy: 2 } })).toThrow();
    expect(() => parseDiagnosticSnapshot({ ...snapshot, overallStatus: "healthy" })).toThrow();
  });

  it("acepta un diagnóstico completamente saludable", () => {
    const healthy = {
      ...snapshot,
      overallStatus: "healthy",
      summary: { total: 1, healthy: 1, configurationPending: 0, unavailable: 0, errors: 0 },
      checks: [checks[0]],
    };
    expect(parseDiagnosticSnapshot(healthy).summary.errors).toBe(0);
  });
});
