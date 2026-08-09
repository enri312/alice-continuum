export type DiagnosticCategory = "path" | "dataVersion" | "provider" | "adapter" | "permission";
export type DiagnosticStatus = "healthy" | "configurationPending" | "unavailable" | "error";
export type DiagnosticOverallStatus = "healthy" | "attention" | "error";

export type DiagnosticCheck = {
  id: string;
  category: DiagnosticCategory;
  label: string;
  status: DiagnosticStatus;
  summary: string;
};

export type DiagnosticSummary = {
  total: number;
  healthy: number;
  configurationPending: number;
  unavailable: number;
  errors: number;
};

export type DiagnosticSnapshot = {
  schemaVersion: 1;
  generatedAtMs: number;
  overallStatus: DiagnosticOverallStatus;
  summary: DiagnosticSummary;
  checks: DiagnosticCheck[];
};

const categories: DiagnosticCategory[] = ["path", "dataVersion", "provider", "adapter", "permission"];
const statuses: DiagnosticStatus[] = ["healthy", "configurationPending", "unavailable", "error"];
const overallStatuses: DiagnosticOverallStatus[] = ["healthy", "attention", "error"];
const snapshotKeys = ["schemaVersion", "generatedAtMs", "overallStatus", "summary", "checks"];
const summaryKeys = ["total", "healthy", "configurationPending", "unavailable", "errors"];
const checkKeys = ["id", "category", "label", "status", "summary"];
const diagnosticId = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function parseSummary(value: unknown): DiagnosticSummary {
  if (!isObject(value)
    || !exactKeys(value, summaryKeys)
    || !count(value.total)
    || !count(value.healthy)
    || !count(value.configurationPending)
    || !count(value.unavailable)
    || !count(value.errors)
    || value.healthy + value.configurationPending + value.unavailable + value.errors !== value.total) {
    throw new Error("Resumen de diagnóstico R3 inválido");
  }
  return value as DiagnosticSummary;
}

function parseCheck(value: unknown): DiagnosticCheck {
  if (!isObject(value)
    || !exactKeys(value, checkKeys)
    || typeof value.id !== "string" || !diagnosticId.test(value.id)
    || !categories.includes(value.category as DiagnosticCategory)
    || !boundedText(value.label, 120)
    || !statuses.includes(value.status as DiagnosticStatus)
    || !boundedText(value.summary, 520)) {
    throw new Error("Comprobación de diagnóstico R3 inválida");
  }
  return value as DiagnosticCheck;
}

export function parseDiagnosticSnapshot(value: unknown): DiagnosticSnapshot {
  if (!isObject(value)
    || !exactKeys(value, snapshotKeys)
    || value.schemaVersion !== 1
    || !count(value.generatedAtMs) || value.generatedAtMs === 0
    || !overallStatuses.includes(value.overallStatus as DiagnosticOverallStatus)
    || !Array.isArray(value.checks)) {
    throw new Error("Snapshot de diagnóstico R3 inválido");
  }
  const summary = parseSummary(value.summary);
  const checks = value.checks.map(parseCheck);
  if (checks.length !== summary.total
    || new Set(checks.map((item) => item.id)).size !== checks.length
    || checks.filter((item) => item.status === "healthy").length !== summary.healthy
    || checks.filter((item) => item.status === "configurationPending").length !== summary.configurationPending
    || checks.filter((item) => item.status === "unavailable").length !== summary.unavailable
    || checks.filter((item) => item.status === "error").length !== summary.errors) {
    throw new Error("Conteos de diagnóstico R3 incoherentes");
  }
  const expectedOverall: DiagnosticOverallStatus = summary.errors
    ? "error"
    : summary.configurationPending || summary.unavailable
      ? "attention"
      : "healthy";
  if (value.overallStatus !== expectedOverall) {
    throw new Error("Estado general de diagnóstico R3 incoherente");
  }
  return { ...value, summary, checks } as DiagnosticSnapshot;
}
