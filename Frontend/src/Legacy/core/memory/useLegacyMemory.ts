import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { recordCognitiveEvent as recordEvent } from "../../../core/cognitive/activity-session";
import { loadCompatibleArray } from "../../../core/shared/storage-migration";
import { startSerializedPolling } from "../../../core/shared/polling";
import type { MemorySession as Session } from "../../../core/memory/memory-record";
import { applyMemoryRetrievalOutcome, applyMemoryReview, type RetrievalOutcome, type ReviewOutcome } from "../../../core/memory/memory-consolidation";
import { parseWorkingMemoryOperationResult, parseWorkingMemorySnapshot, type WorkingMemoryOperationResult, type WorkingMemorySnapshot } from "../../../core/memory/working-memory";

type MemorySnapshot = { sessions: Session[]; storagePath: string; existed: boolean };
const storageKey = "alice-cognitive-core-sessions-v1";
const legacyStorageKeys = ["proyecto-p-sessions-v1"];

function loadSessions(): Session[] {
  return loadCompatibleArray<Session>(localStorage, storageKey, legacyStorageKeys);
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

// Former App.tsx memory state, retained during the root migration.
export function useLegacyMemory(desktopApp: boolean) {
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemorySnapshot | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<"browser" | "loading" | "native" | "error">(desktopApp ? "loading" : "browser");
  const [memoryPath, setMemoryPath] = useState("");
  const memoryLoadStarted = useRef(false);
  const sessionsRef = useRef(sessions);
  const memorySaveQueue = useRef<Promise<void>>(Promise.resolve());
  const workingMemoryGeneration = useRef(-1);

  useEffect(() => {
    if (!desktopApp) return;
    return startSerializedPolling({
      intervalMs: 5_000,
      read: async () => parseWorkingMemorySnapshot(await invoke<unknown>("working_memory_status")),
      onValue: snapshot => {
        // A read started before a confirmed clear/response must not restore its old view.
        if (snapshot.generation < workingMemoryGeneration.current) return;
        setWorkingMemory(snapshot);
        workingMemoryGeneration.current = snapshot.generation;
      },
      onError: error => {
        if (workingMemoryGeneration.current < 0) {
          workingMemoryGeneration.current = 0;
          recordEvent("SECURITY", "WORKING_MEMORY_STATUS_ERROR", String(error), "WARN");
        }
      },
    });
  }, [desktopApp]);

  useEffect(() => {
    if (!desktopApp || memoryLoadStarted.current) return;
    memoryLoadStarted.current = true;
    const legacySessions = loadSessions();
    invoke<MemorySnapshot>("load_memory").then(async (snapshot) => {
      setMemoryPath(snapshot.storagePath);
      if (snapshot.existed) {
        sessionsRef.current = snapshot.sessions;
        setSessions(snapshot.sessions);
        setMemoryStatus("native");
        recordEvent("MEMORY", "MEMORY_LOAD", `${snapshot.sessions.length} recuerdos cargados desde archivo local`);
        return;
      }
      if (legacySessions.length) {
        const savedPath = await invoke<string>("save_memory", { sessions: legacySessions });
        setMemoryPath(savedPath);
        sessionsRef.current = legacySessions;
        setSessions(legacySessions);
        recordEvent("MEMORY", "MEMORY_MIGRATION", `${legacySessions.length} recuerdos migrados desde el navegador`);
      }
      setMemoryStatus("native");
    }).catch((error) => {
      setMemoryStatus("error");
      recordEvent("SECURITY", "MEMORY_LOAD_ERROR", String(error), "WARN");
    });
  }, [desktopApp]);

  function updateSessions(update: Session[] | ((current: Session[]) => Session[])) {
    const next = typeof update === "function" ? update(sessionsRef.current) : update;
    sessionsRef.current = next;
    setSessions(next);
    if (!desktopApp) {
      saveSessions(next);
      return;
    }
    memorySaveQueue.current = memorySaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const path = await invoke<string>("save_memory", { sessions: next });
        setMemoryPath(path);
        setMemoryStatus("native");
      })
      .catch((error) => {
        setMemoryStatus("error");
        recordEvent("SECURITY", "MEMORY_SAVE_ERROR", String(error), "WARN");
      });
  }

  async function updateSessionsVerified(update: (current: Session[]) => Session[]) {
    const previous = sessionsRef.current;
    const next = update(previous);
    sessionsRef.current = next;
    setSessions(next);
    if (!desktopApp) {
      saveSessions(next);
      return;
    }
    const persistence = memorySaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const path = await invoke<string>("save_memory", { sessions: next });
        setMemoryPath(path);
        setMemoryStatus("native");
      });
    memorySaveQueue.current = persistence.catch((error) => {
      setMemoryStatus("error");
      recordEvent("SECURITY", "MEMORY_SAVE_ERROR", String(error), "WARN");
    });
    try {
      await persistence;
    } catch (error) {
      if (sessionsRef.current === next) {
        sessionsRef.current = previous;
        setSessions(previous);
      }
      throw error;
    }
  }

  async function assessRetrievalOutcome(recordId: string, outcome: RetrievalOutcome) {
    const target = sessionsRef.current.find((session) => session.id === recordId);
    if (!target || target.kind !== "Enseñanza" || target.memoryStatus !== "confirmed" || target.archiveStatus === "archived") throw new Error("El recuerdo ya no admite una evaluación de recuperación.");
    await updateSessionsVerified((current) => current.map((session) => session.id === recordId ? applyMemoryRetrievalOutcome(session, outcome) : session));
    recordEvent("MEMORY", outcome === "helpful" ? "MEMORY_RETRIEVAL_HELPFUL" : "MEMORY_RETRIEVAL_NOT_HELPFUL", `${recordId} · confirmado por el propietario · sin cambio automático de fuerza o accesibilidad`);
  }

  async function clearWorkingMemory(expectedGeneration: number): Promise<WorkingMemoryOperationResult> {
    if (!desktopApp) throw new Error("El vaciado de RAM requiere la aplicación de escritorio.");
    try {
      const result = parseWorkingMemoryOperationResult(await invoke<unknown>("clear_working_memory", { input: { expectedGeneration, confirmed: true } }));
      workingMemoryGeneration.current = result.snapshot.generation;
      setWorkingMemory(result.snapshot);
      recordEvent("MEMORY", "WORKING_MEMORY_CLEARED", `RAM vaciada en generación ${result.snapshot.generation}`);
      if (result.warning) recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_AUDIT_WARNING", result.warning, "WARN");
      return result;
    } catch (error) {
      recordEvent("SECURITY", "WORKING_MEMORY_CLEAR_ERROR", String(error), "WARN");
      throw error;
    }
  }

  async function exportMemory() {
    if (!desktopApp) throw new Error("La exportación está disponible en la aplicación de escritorio.");
    await memorySaveQueue.current;
    const path = await invoke<string>("export_memory");
    recordEvent("MEMORY", "MEMORY_EXPORT", `Memoria exportada: ${path}`);
    return path;
  }

  async function restoreMemory() {
    if (!desktopApp) throw new Error("La restauración está disponible en la aplicación de escritorio.");
    await memorySaveQueue.current;
    const snapshot = await invoke<MemorySnapshot>("restore_memory_backup");
    sessionsRef.current = snapshot.sessions;
    setSessions(snapshot.sessions);
    setMemoryPath(snapshot.storagePath);
    setMemoryStatus("native");
    recordEvent("MEMORY", "MEMORY_RESTORE", `${snapshot.sessions.length} recuerdos restaurados desde el respaldo`, "WARN");
    return snapshot.sessions.length;
  }

  async function reloadMemoryFromDisk() {
    if (!desktopApp) throw new Error("La recarga de memoria requiere la aplicación de escritorio.");
    await memorySaveQueue.current;
    const snapshot = await invoke<MemorySnapshot>("load_memory");
    sessionsRef.current = snapshot.sessions;
    setSessions(snapshot.sessions);
    setMemoryPath(snapshot.storagePath);
    setMemoryStatus("native");
    return snapshot.sessions.length;
  }

  async function openMemoryDirectory() {
    if (!desktopApp) throw new Error("La carpeta privada está disponible en la aplicación de escritorio.");
    const path = await invoke<string>("open_memory_directory");
    recordEvent("MEMORY", "MEMORY_DIRECTORY_OPEN", `Carpeta de memoria abierta: ${path}`);
    return path;
  }

  function reviewMemory(id: string, outcome: ReviewOutcome) {
    const memory = sessionsRef.current.find((session) => session.id === id);
    if (!memory) return;
    updateSessions((current) => current.map((session) => session.id === id ? applyMemoryReview(session, outcome) : session));
    recordEvent("MEMORY", outcome === "confirmed" ? "MEMORY_REVIEW_CONFIRMED" : "MEMORY_REVIEW_CONFLICT", `${outcome === "confirmed" ? "Vigencia confirmada" : "Corrección solicitada"}: ${memory.intention}`, outcome === "confirmed" ? "INFO" : "WARN");
  }

  return {
    sessions, workingMemory, setWorkingMemory, workingMemoryGeneration,
    memoryStatus, setMemoryStatus, memoryPath, updateSessions, updateSessionsVerified,
    reviewMemory, assessRetrievalOutcome, clearWorkingMemory,
    exportMemory, restoreMemory, reloadMemoryFromDisk, openMemoryDirectory,
  };
}
