export type OwnerProfileSource = {
  file: string;
  sha256: string;
};

export type OwnerProfileRecord = {
  id: string;
  kind: "Perfil";
  intention: string;
  summary: string;
  source: string;
  memoryStatus: "confirmed";
};

export type OwnerProfileSnapshot = {
  state: "available" | "missing";
  storagePath: string;
  ownerName: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  sourceFiles: OwnerProfileSource[];
  records: OwnerProfileRecord[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isSha256 = (value: unknown): value is string => typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);

export function parseOwnerProfileSnapshot(value: unknown): OwnerProfileSnapshot {
  if (!isObject(value) || (value.state !== "available" && value.state !== "missing") || typeof value.storagePath !== "string") {
    throw new Error("Snapshot de perfil privado inválido");
  }
  const sourceFiles = Array.isArray(value.sourceFiles) ? value.sourceFiles.map((source) => {
    if (!isObject(source) || typeof source.file !== "string" || !isSha256(source.sha256)) throw new Error("Fuente de perfil inválida");
    return { file: source.file, sha256: source.sha256 };
  }) : (() => { throw new Error("Fuentes de perfil ausentes"); })();
  const records = Array.isArray(value.records) ? value.records.map((record) => {
    if (!isObject(record)
      || typeof record.id !== "string"
      || record.kind !== "Perfil"
      || typeof record.intention !== "string"
      || typeof record.summary !== "string"
      || typeof record.source !== "string"
      || record.memoryStatus !== "confirmed") {
      throw new Error("Recuerdo de perfil inválido");
    }
    const parsed: OwnerProfileRecord = {
      id: record.id,
      kind: "Perfil",
      intention: record.intention,
      summary: record.summary,
      source: record.source,
      memoryStatus: "confirmed",
    };
    return parsed;
  }) : (() => { throw new Error("Recuerdos de perfil ausentes"); })();
  return {
    state: value.state,
    storagePath: value.storagePath,
    ownerName: typeof value.ownerName === "string" ? value.ownerName : null,
    confirmedBy: typeof value.confirmedBy === "string" ? value.confirmedBy : null,
    confirmedAt: typeof value.confirmedAt === "string" ? value.confirmedAt : null,
    sourceFiles,
    records,
  };
}
