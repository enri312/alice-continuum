import { useState } from "react";
import type { CognitiveEvent, CognitiveLevel, CognitiveModule } from "../../../core/cognitive/cognitive-events";

let sequence = 0;

function createCognitiveEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel): CognitiveEvent {
  sequence += 1;
  return { id: crypto.randomUUID(), sequence, createdAt: new Date().toISOString(), module, level, node, payload };
}

// Former App.tsx state, kept for reference during the root migration.
export function useLegacyActivity() {
  const [cognitiveEvents, setCognitiveEvents] = useState<CognitiveEvent[]>([]);

  function recordEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO") {
    setCognitiveEvents(current => [...current.slice(-199), createCognitiveEvent(module, node, payload, level)]);
  }

  return { cognitiveEvents, recordEvent, clear: () => setCognitiveEvents([]) };
}
