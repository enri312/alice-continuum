import type { WorkingMemorySnapshot } from "../memory/working-memory";
import type { ConversationHistorySnapshot } from "./conversation-history";
import type { ConversationBehaviorSettings } from "./behavior-settings";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  model?: string;
  exchangeId?: string;
};

export type CloudStatus = {
  providers: CloudProvider[];
};

export type CloudProvider = { id: string; label: string; configured: boolean; defaultModel: string; protocol: string; retentionMode: string };

export type CloudRequest = {
  behavior?: ConversationBehaviorSettings;
  voiceSessionId?: string;
  message: string;
  payload: string;
  provider: string;
  model: string;
  historyCount: number;
  memoryCount: number;
};

export type CloudResponse = {
  memoryContextMode?: "none" | "full" | "limited";
  text: string;
  provider: string;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  workingMemory: WorkingMemorySnapshot | null;
  workingMemoryError: string | null;
  conversationHistory: ConversationHistorySnapshot | null;
  conversationHistoryError: string | null;
};

export type HybridRetrievalCandidate = { id: string; text: string };

export type HybridRetrievalRequest = {
  query: string;
  candidates: HybridRetrievalCandidate[];
};

export type HybridRetrievalPreview = {
  matches: { id: string; rank: number; reason: string }[];
  model: string;
  elapsedMs: number;
  persisted: boolean;
  truthVerified: boolean;
  requiresOwnerReview: boolean;
};
