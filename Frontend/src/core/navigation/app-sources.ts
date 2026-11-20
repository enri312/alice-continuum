import { isTauri } from "@tauri-apps/api/core";
import { buildBrainSnapshot } from "../cognitive/brain";
import { recordCognitiveEvent } from "../cognitive/activity-session";
import { conversationSnapshot } from "../conversation/conversation-session";
import { observationSnapshot } from "../governance/observation-session";
import { buildMemoryCatalog } from "../memory/memory-catalog";
import { learningSnapshot, refreshLearningSources } from "../memory/learning-session";
import { memorySessionSnapshot, refreshOwnerProfile, reloadMemoryFromDisk } from "../memory/memory-session";
import { navigate } from "./app-session";

export const desktopApp = isTauri();

let catalog: ReturnType<typeof buildMemoryCatalog>;
let catalogInputs: unknown[] = [];
export function appData() {
  const memory = memorySessionSnapshot();
  const learning = learningSnapshot();
  const { ownerProfile, sessions, finishedIndices } = memory;
  const { automaticMemory, selfStudy, approvedStudyIndices } = learning;
  const next = [ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices];
  if (next.some((item, index) => item !== catalogInputs[index]) || !catalog) {
    catalog = buildMemoryCatalog({ ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices });
    catalogInputs = next;
  }
  return { memory, learning, catalog };
}

let brain: ReturnType<typeof buildBrainSnapshot>;
let brainInputs: unknown[] = [];
export function brainSnapshot() {
  const { catalog: { cognitiveMemories } } = appData();
  const { messages, retrieval, cloudStatus, pending } = conversationSnapshot();
  const { grant, foregroundContext } = observationSnapshot();
  const observerEnabled = Boolean(grant);
  const cloudConfigured = cloudStatus.providers.some(provider => provider.configured);
  const next = [cognitiveMemories, messages, retrieval, observerEnabled, foregroundContext, cloudConfigured, pending];
  if (next.some((item, index) => item !== brainInputs[index]) || !brain) {
    brain = buildBrainSnapshot({
      lastUserMessage: [...messages].reverse().find(message => message.role === "user")?.text,
      conversationCount: messages.length, memories: cognitiveMemories,
      retrievedMemoryCount: retrieval.count, retrievedMemoryTop: retrieval.top, retrievedMemoryIds: retrieval.ids,
      memoryRetrievalObservation: retrieval, observerEnabled, foregroundContext, cloudConfigured, cloudPending: pending,
    });
    brainInputs = next;
  }
  return brain;
}

export function toggleObservation() {
  if (!desktopApp) return;
  navigate("puentes");
  recordCognitiveEvent("SECURITY", "PERMISSION_REQUIRED", observationSnapshot().grant
    ? "La detención requiere un grant oneShot en el Gateway R2"
    : "La activación requiere un grant de sesión en el Gateway R2");
}

export function refreshVolumeLearning() {
  refreshLearningSources();
  void refreshOwnerProfile();
  if (memorySessionSnapshot().memoryStatus === "error") void reloadMemoryFromDisk().catch(() => undefined);
}
