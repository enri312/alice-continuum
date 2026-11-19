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
