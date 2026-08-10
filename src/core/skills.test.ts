import { describe, expect, it } from "vitest";
import type { CapabilityRegistrySnapshot } from "./capabilities";
import { parseNewSkillDraft, parseSkillManifest } from "./skills";
import type { SkillManifest } from "./skills";

const registry: CapabilityRegistrySnapshot = {
  schemaVersion: 1,
  generatedAt: "2026-08-09T21:00:00-03:00",
  capabilities: [{
    id: "memory.records.read", version: 1, label: "Leer memoria local", description: "Lee registros locales validados.", domain: "memory", kind: "query", maturity: "partial", adapter: "memory", operations: ["load_memory"], state: "idle", risk: "medium", effects: ["localRead"], dataScopes: ["memoryRecords"], requirements: ["Memoria válida"], permission: { mode: "implicitRead", enforcedBy: "currentUi", summary: "Lectura local." }, health: { status: "healthy", summary: "Disponible.", checkedAt: "2026-08-09T21:00:00-03:00" }, lastExecution: null,
  }],
};

function manifest(): SkillManifest {
  return {
    schemaVersion: 1,
    skillId: "local.revisar-memoria",
    version: 1,
    revisionId: "9f8dc476-51f6-4a7d-858a-c18c9b953bf9",
    title: "Revisar memoria local",
    description: "Prepara una lectura visible sin modificar registros.",
    purpose: "Permitir una revisión humana antes de decidir cambios.",
    provenance: { author: "Carlos Nuñez", origin: "localUser", createdAt: "2026-08-09T21:00:00-03:00", updatedAt: "2026-08-09T21:00:00-03:00", parentRevisionId: null },
    status: "draft",
    declaredRisk: "medium",
    execution: { mode: "simulationOnly", enabled: false, allowNetwork: false, allowProcessLaunch: false, allowLocalWrite: false },
    requiredCapabilities: [{ capabilityId: "memory.records.read", operations: ["load_memory"], reason: "Preparar una vista local." }],
    inputs: [],
    outputs: [{ id: "summary", label: "Resumen", description: "Resultado visible.", kind: "text", sensitive: true }],
    preconditions: [{ id: "confirm-review", label: "Confirmar", description: "Confirmación del usuario.", kind: "manualConfirmation", reference: "user" }],
    steps: [{ id: "read-memory", title: "Preparar lectura", description: "Paso simulado y visible.", kind: "capability", capabilityId: "memory.records.read", operation: "load_memory", inputIds: [] }],
    successChecks: [{ id: "summary-present", label: "Resumen preparado", description: "Comprueba el resultado esperado.", kind: "outputPresent", reference: "summary" }],
  };
}

describe("R4 skill manifest", () => {
  it("acepta un borrador cerrado contra una capacidad R1 real", () => {
    const parsed = parseNewSkillDraft(manifest(), registry);
    expect(parsed.execution.enabled).toBe(false);
    expect(parsed.requiredCapabilities[0].operations).toEqual(["load_memory"]);
  });

  it("rechaza campos desconocidos y modos de ejecución", () => {
    expect(() => parseNewSkillDraft({ ...manifest(), script: "powershell" }, registry)).toThrow(/campos/);
    expect(() => parseNewSkillDraft({ ...manifest(), execution: { ...manifest().execution, enabled: true } }, registry)).toThrow(/simulationOnly/);
  });

  it("rechaza capacidades y operaciones que R1 no registra", () => {
    const unknown = manifest();
    unknown.requiredCapabilities[0].capabilityId = "system.shell.execute";
    unknown.steps[0].capabilityId = "system.shell.execute";
    expect(() => parseSkillManifest(unknown, registry)).toThrow(/no está registrada/);

    const operation = manifest();
    operation.requiredCapabilities[0].operations = ["delete_everything"];
    operation.steps[0].operation = "delete_everything";
    expect(() => parseSkillManifest(operation, registry)).toThrow(/no pertenece/);
  });

  it("rechaza riesgo menor, privilegios sobrantes y referencias inválidas", () => {
    expect(() => parseSkillManifest({ ...manifest(), declaredRisk: "low" }, registry)).toThrow(/riesgo/);
    const unused = manifest();
    unused.steps = [{ ...unused.steps[0], kind: "manual", capabilityId: null, operation: null }];
    expect(() => parseSkillManifest(unused, registry)).toThrow();
    const badReference = manifest();
    badReference.successChecks[0].reference = "missing";
    expect(() => parseSkillManifest(badReference, registry)).toThrow(/referencia/);
  });

  it("protege rutas y exige el estado inicial draft", () => {
    const path = manifest();
    path.inputs = [{ id: "folder", label: "Carpeta", description: "Ruta local.", kind: "path", required: true, sensitive: false }];
    expect(() => parseSkillManifest(path, registry)).toThrow(/sensitive/);
    expect(() => parseNewSkillDraft({ ...manifest(), status: "approved" }, registry)).toThrow(/draft/);
  });
});
