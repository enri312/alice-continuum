export type CognitiveModule = "SYSTEM" | "PERCEPTION" | "MEMORY" | "WORKSPACE" | "OUTPUT" | "SECURITY";
export type CognitiveLevel = "INFO" | "TRACE" | "WARN";

export type CognitiveEvent = {
  id: string;
  sequence: number;
  createdAt: string;
  module: CognitiveModule;
  level: CognitiveLevel;
  node: string;
  payload: string;
};

let sequence = 0;

export function createCognitiveEvent(module: CognitiveModule, node: string, payload: string, level: CognitiveLevel = "INFO"): CognitiveEvent {
  sequence += 1;
  return { id: crypto.randomUUID(), sequence, createdAt: new Date().toISOString(), module, level, node, payload };
}
