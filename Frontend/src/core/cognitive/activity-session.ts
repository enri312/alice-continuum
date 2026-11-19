import type { CognitiveEvent, CognitiveLevel, CognitiveModule } from "./cognitive-events";

type Draft = Omit<CognitiveEvent, "sequence">;
const EVENT_LIMIT = 200;
const listeners = new Set<() => void>();
let current: readonly CognitiveEvent[] = [];
let applyBatch: ((raw: string) => string) | undefined;
let records: Draft[] = [];
let discarded = 0;
let clear = false;

function flush() {
  if (!applyBatch || (!clear && records.length === 0)) return;
  const response = applyBatch(JSON.stringify({ clear, discarded, records }));
  current = JSON.parse(response) as CognitiveEvent[];
  records = [];
  discarded = 0;
  clear = false;
  for (const listener of listeners) listener();
}

// Only the transport buffers events while WebAssembly is unavailable.
// The Rust session assigns sequence numbers and owns the visible buffer.
export function connectActivitySession(apply: (raw: string) => string) {
  applyBatch = apply;
  flush();
}

export function recordCognitiveEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO") {
  if (records.length === EVENT_LIMIT) {
    records.shift();
    discarded++;
  }
  records.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), module, level, node, payload });
  flush();
}

export function clearActivity() {
  discarded += records.length;
  records = [];
  clear = true;
  flush();
}

export function subscribeToActivity(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const activityEvents = () => current;
export const activityCount = () => current.length;
