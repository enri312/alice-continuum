import type { OwnerProfileSnapshot } from "../conversation/owner-profile";
import { automaticMemoryForConversation, type AutomaticMemorySnapshot } from "./automatic-memory";
import type { MemorySession } from "./memory-record";
import { selfStudyForCognitiveVolume, selfStudyForConversation, type SelfStudySnapshot } from "./self-study";

type Sources = {
  ownerProfile: OwnerProfileSnapshot | null;
  sessions: MemorySession[];
  finishedIndices: number[];
  automaticMemory: AutomaticMemorySnapshot | null;
  selfStudy: SelfStudySnapshot | null;
  approvedStudyIndices: number[];
};

export function buildMemoryCatalog({
  ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices,
}: Sources) {
  const shared = [
    ...(ownerProfile?.state === "available" ? ownerProfile.records : []),
    ...finishedIndices.map(index => sessions[index]!),
    ...automaticMemoryForConversation(automaticMemory),
  ];
  const approvedStudy = selfStudy
    ? { records: approvedStudyIndices.map(index => selfStudy.records[index]!) }
    : null;
  return {
    conversationalMemories: [...shared, ...selfStudyForConversation(approvedStudy)],
    cognitiveMemories: [...shared, ...selfStudyForCognitiveVolume(selfStudy)],
  };
}
