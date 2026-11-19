import { invoke, isTauri } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../cognitive/activity-session";
import { parseOwnerProfileSnapshot, type OwnerProfileSnapshot } from "../conversation/owner-profile";
import { startSerializedPolling } from "../shared/polling";
import { loadCompatibleArray } from "../shared/storage-migration";
import { applyMemoryRetrievalOutcome, applyMemoryReview, type RetrievalOutcome, type ReviewOutcome } from "./memory-consolidation";
import { isLegacyMemoryDiscardable } from "./memory-discard";
import type { MemoryRecordChanges, MemorySession } from "./memory-record";
import { parseWorkingMemoryOperationResult, parseWorkingMemorySnapshot, type WorkingMemorySnapshot } from "./working-memory";

type NativeRecords = { sessions: MemorySession[]; storagePath: string; existed: boolean };
type StoredRecords = {
  sessions: MemorySession[];
  memoryStatus: "browser" | "loading" | "native" | "error";
  memoryPath: string;
};
type Snapshot = StoredRecords & {
  finishedIndices: number[];
  workingMemory: WorkingMemorySnapshot | null;
  ownerProfile: OwnerProfileSnapshot | null;
  ownerProfileError: string;
};
type Action =
  | ({ type: "stored" } & StoredRecords)
  | { type: "storageError" }
  | { type: "profileLoaded"; profile: OwnerProfileSnapshot }
  | { type: "profileFailed"; error: string }
  | { type: "workingMemory"; snapshot: WorkingMemorySnapshot };

const storageKey = "alice-cognitive-core-sessions-v1";
const desktopApp = isTauri();
const loadBrowserRecords = () => loadCompatibleArray<MemorySession>(localStorage, storageKey, ["proyecto-p-sessions-v1"]);
const finishedRecordIndices = (records: MemorySession[]) => records.flatMap((record, index) =>
  typeof record?.finishedAt === "string" && record.finishedAt.length ? [index] : []);
const initialRecords = desktopApp ? [] : loadBrowserRecords();
const listeners = new Set<() => void>();
let current: Snapshot = {
  sessions: initialRecords,
  finishedIndices: finishedRecordIndices(initialRecords),
  memoryStatus: desktopApp ? "loading" : "browser",
  memoryPath: "",
  workingMemory: null,
  ownerProfile: null,
  ownerProfileError: "",
};
let apply: ((raw: string) => string) | undefined;
let started = false;
let profileRead: Promise<void> | undefined;
let queue = Promise.resolve();

function publish(projection: Partial<Snapshot>) {
  if (!Object.keys(projection).length) return;
  current = { ...current, ...projection };
  for (const listener of listeners) listener();
}

function dispatch(action: Action) {
  if (apply) {
    publish(JSON.parse(apply(JSON.stringify(action))) as Partial<Snapshot>);
    return;
  }
  // The temporary view also works while WASM is loading or being retried.
  switch (action.type) {
    case "stored":
      publish({
        sessions: action.sessions, finishedIndices: finishedRecordIndices(action.sessions),
        memoryPath: action.memoryPath, memoryStatus: action.memoryStatus,
      });
      break;
    case "storageError":
      publish({ memoryStatus: "error" });
      break;
    case "profileLoaded":
      publish({ ownerProfile: action.profile, ownerProfileError: "" });
      break;
    case "profileFailed":
      publish({ ownerProfile: null, ownerProfileError: action.error });
      break;
    case "workingMemory": {
      if ((current.workingMemory?.generation ?? -1) <= action.snapshot.generation) {
        publish({ workingMemory: action.snapshot });
      }
      break;
    }
  }
}

export function connectMemorySession(update: (raw: string) => string) {
  if (apply) return;
  const initial = JSON.parse(update(JSON.stringify({ type: "initialize", snapshot: current }))) as Partial<Snapshot>;
  apply = update;
  publish(initial);
}

export function subscribeToMemory(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const memorySessionSnapshot = () => current;

export function refreshOwnerProfile() {
  if (!desktopApp) return;
  profileRead ??= invoke<unknown>("owner_profile_status").then(raw => {
    const profile = parseOwnerProfileSnapshot(raw);
    dispatch({ type: "profileLoaded", profile });
    if (profile.state === "available") recordEvent("MEMORY", "OWNER_PROFILE_LOAD", `${profile.records.length} recuerdos de perfil confirmados · ${profile.sourceFiles.length} fuentes con SHA-256`);
  }).catch(cause => {
    const error = String(cause);
    dispatch({ type: "profileFailed", error });
    recordEvent("SECURITY", "OWNER_PROFILE_LOAD_ERROR", error, "WARN");
  }).finally(() => { profileRead = undefined; });
  return profileRead;
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

function reportStorageError(event: string, error: unknown) {
  dispatch({ type: "storageError" });
  recordEvent("SECURITY", event, String(error), "WARN");
}

function showStoredRecords(sessions: MemorySession[], memoryPath: string) {
  dispatch({ type: "stored", sessions, memoryPath, memoryStatus: desktopApp ? "native" : "browser" });
  return sessions.length;
}

function readRecords() {
  return invoke<NativeRecords>("load_memory");
}

async function persistRecords(sessions: MemorySession[]) {
  if (desktopApp) return invoke<string>("save_memory", { sessions });
  localStorage.setItem(storageKey, JSON.stringify(sessions));
  return "";
}

export function startMemorySession() {
  if (started || !desktopApp) return;
  started = true;
  void refreshOwnerProfile();
  void enqueue(async () => {
    const snapshot = await readRecords();
    const legacy = snapshot.existed ? [] : loadBrowserRecords();
    if (legacy.length) {
      showStoredRecords(legacy, await persistRecords(legacy));
      recordEvent("MEMORY", "MEMORY_MIGRATION", `${legacy.length} recuerdos migrados desde el navegador`);
      return;
    }
    showStoredRecords(snapshot.sessions, snapshot.storagePath);
    if (snapshot.existed) recordEvent("MEMORY", "MEMORY_LOAD", `${snapshot.sessions.length} recuerdos cargados desde archivo local`);
  }).catch(error => reportStorageError("MEMORY_LOAD_ERROR", error));

  let reportedReadError = false;
  startSerializedPolling({
    intervalMs: 5_000,
    read: async () => parseWorkingMemorySnapshot(await invoke<unknown>("working_memory_status")),
    onValue: snapshot => dispatch({ type: "workingMemory", snapshot }),
    onError: error => {
      if (reportedReadError || current.workingMemory) return;
      reportedReadError = true;
      recordEvent("SECURITY", "WORKING_MEMORY_STATUS_ERROR", String(error), "WARN");
    },
  });
}

function changeRecord(id: string, change: (record: MemorySession) => MemorySession | null) {
  return enqueue(async () => {
    try {
      // Read the native source after previously queued operations, including restorations.
      const records = desktopApp ? (await readRecords()).sessions : current.sessions;
      const index = records.findIndex(record => record.id === id);
      const record = records[index];
      if (!record) throw new Error("El recuerdo ya no aparece en la memoria local.");
      const replacement = change(record);
      const next = [...records];
      next.splice(index, 1, ...(replacement ? [replacement] : []));
      return showStoredRecords(next, await persistRecords(next));
    } catch (error) {
      reportStorageError("MEMORY_SAVE_ERROR", error);
      throw error;
    }
  });
}

export async function updateMemory(id: string, changes: MemoryRecordChanges) {
  await changeRecord(id, record => {
    if (!record.finishedAt || record.archiveStatus === "archived" || record.memoryStatus === "archived"
      || record.memoryStatus === "confirmed" || record.memoryStatus === "conflict") {
      throw new Error("El estado del recuerdo cambió. Revisalo antes de editar; los recuerdos evaluados requieren una versión nueva.");
    }
    return { ...record, ...changes };
  });
  recordEvent("MEMORY", "MEMORY_UPDATE", `Recuerdo actualizado: ${id}`);
}

export async function discardMemory(id: string) {
  const count = await changeRecord(id, record => {
    if (!isLegacyMemoryDiscardable(record)) throw new Error("El registro ya no admite descarte directo.");
    return null;
  });
  recordEvent("MEMORY", "MEMORY_DELETE", `Fragmento heredado descartado: ${id}`, "WARN");
  return count;
}

export async function reviewMemory(id: string, outcome: ReviewOutcome) {
  await changeRecord(id, record => applyMemoryReview(record, outcome));
  recordEvent("MEMORY", outcome === "confirmed" ? "MEMORY_REVIEW_CONFIRMED" : "MEMORY_REVIEW_CONFLICT",
    `${outcome === "confirmed" ? "Vigencia confirmada" : "Corrección solicitada"}: ${id}`, outcome === "confirmed" ? "INFO" : "WARN");
}

export async function assessRetrievalOutcome(id: string, outcome: RetrievalOutcome) {
  await changeRecord(id, record => {
    if (record.kind !== "Enseñanza" || record.memoryStatus !== "confirmed" || record.archiveStatus === "archived") {
      throw new Error("El recuerdo ya no admite una evaluación de recuperación.");
    }
    return applyMemoryRetrievalOutcome(record, outcome);
  });
  recordEvent("MEMORY", outcome === "helpful" ? "MEMORY_RETRIEVAL_HELPFUL" : "MEMORY_RETRIEVAL_NOT_HELPFUL",
    `${id} · confirmado por el propietario · sin cambio automático de fuerza o accesibilidad`);
}

export function acceptWorkingMemoryResponse(raw: unknown) {
  try {
    const snapshot = parseWorkingMemorySnapshot(raw);
    dispatch({ type: "workingMemory", snapshot });
    recordEvent("MEMORY", "WORKING_MEMORY_RECORDED", `${snapshot.messageCount}/${snapshot.maximumMessages} mensajes reales en RAM · TTL ${snapshot.ttlSeconds}s`);
  } catch (error) {
    recordEvent("SECURITY", "WORKING_MEMORY_CONTRACT_ERROR", String(error), "WARN");
  }
}

export async function clearWorkingMemory(expectedGeneration: number) {
  if (!desktopApp) throw new Error("El vaciado de RAM requiere la aplicación de escritorio.");
  try {
    const result = parseWorkingMemoryOperationResult(await invoke<unknown>("clear_working_memory", { input: { expectedGeneration, confirmed: true } }));
    dispatch({ type: "workingMemory", snapshot: result.snapshot });
    recordEvent("MEMORY", "WORKING_MEMORY_CLEARED", `RAM vaciada en generación ${result.snapshot.generation}`);
    if (result.warning) recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_AUDIT_WARNING", result.warning, "WARN");
    return result;
  } catch (error) {
    recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_ERROR", String(error), "WARN");
    throw error;
  }
}

export async function exportMemory() {
  if (!desktopApp) throw new Error("La exportación está disponible en la aplicación de escritorio.");
  const path = await enqueue(() => invoke<string>("export_memory"));
  recordEvent("MEMORY", "MEMORY_EXPORT", `Memoria exportada: ${path}`);
  return path;
}

export async function restoreMemory() {
  if (!desktopApp) throw new Error("La restauración está disponible en la aplicación de escritorio.");
  return enqueue(async () => {
    const snapshot = await invoke<NativeRecords>("restore_memory_backup");
    const count = showStoredRecords(snapshot.sessions, snapshot.storagePath);
    recordEvent("MEMORY", "MEMORY_RESTORE", `${count} recuerdos restaurados desde el respaldo`, "WARN");
    return count;
  });
}

export async function reloadMemoryFromDisk() {
  if (!desktopApp) throw new Error("La recarga de memoria requiere la aplicación de escritorio.");
  return enqueue(async () => {
    try {
      const snapshot = await readRecords();
      return showStoredRecords(snapshot.sessions, snapshot.storagePath);
    } catch (error) {
      reportStorageError("MEMORY_RELOAD_ERROR", error);
      throw error;
    }
  });
}

export async function openMemoryDirectory() {
  if (!desktopApp) throw new Error("La carpeta privada está disponible en la aplicación de escritorio.");
  const path = await invoke<string>("open_memory_directory");
  recordEvent("MEMORY", "MEMORY_DIRECTORY_OPEN", `Carpeta de memoria abierta: ${path}`);
  return path;
}
