import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseOwnerProfileSnapshot, type OwnerProfileSnapshot } from "../../../core/conversation/owner-profile";
import { recordCognitiveEvent as recordEvent } from "../../../core/cognitive/activity-session";
import { automaticMemoryForConversation, type AutomaticMemorySnapshot } from "../../../core/memory/automatic-memory";
import { selfStudyForConversation, selfStudyForCognitiveVolume, type SelfStudySnapshot } from "../../../core/memory/self-study";
import type { MemorySession } from "../../../core/memory/memory-record";

// Retained for reference while the App root is migrated.
export function useLegacyMemoryCatalog(desktopApp: boolean, sessions: MemorySession[], automaticMemory: AutomaticMemorySnapshot | null, selfStudy: SelfStudySnapshot | null) {
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfileSnapshot | null>(null);
  const [ownerProfileError, setOwnerProfileError] = useState("");
  const [ownerProfileReloadKey, setOwnerProfileReloadKey] = useState(0);
  const remembered = useMemo(() => sessions.filter((session) => session.finishedAt), [sessions]);
  const conversationalMemories = useMemo(() => [...(ownerProfile?.records ?? []), ...remembered, ...automaticMemoryForConversation(automaticMemory), ...selfStudyForConversation(selfStudy)], [ownerProfile, remembered, automaticMemory, selfStudy]);
  const cognitiveMemories = useMemo(() => [...(ownerProfile?.records ?? []), ...remembered, ...automaticMemoryForConversation(automaticMemory), ...selfStudyForCognitiveVolume(selfStudy)], [ownerProfile, remembered, automaticMemory, selfStudy]);

  useEffect(() => {
    if (!desktopApp) return;
    let active = true;
    invoke<unknown>("owner_profile_status").then((raw) => {
      if (!active) return;
      const snapshot = parseOwnerProfileSnapshot(raw);
      setOwnerProfile(snapshot);
      setOwnerProfileError("");
      if (snapshot.state === "available") recordEvent("MEMORY", "OWNER_PROFILE_LOAD", `${snapshot.records.length} recuerdos de perfil confirmados · ${snapshot.sourceFiles.length} fuentes con SHA-256`);
    }).catch((error) => {
      if (!active) return;
      setOwnerProfileError(String(error));
      recordEvent("SECURITY", "OWNER_PROFILE_LOAD_ERROR", String(error), "WARN");
    });
    return () => { active = false; };
  }, [desktopApp, ownerProfileReloadKey]);

  return { ownerProfile, ownerProfileError, conversationalMemories, cognitiveMemories, setOwnerProfileReloadKey };
}
