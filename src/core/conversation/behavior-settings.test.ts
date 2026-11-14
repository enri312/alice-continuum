import { describe, expect, it } from "vitest";
import { buildBrainSnapshot } from "../cognitive/brain";
import { applyConversationBehavior, DEFAULT_CONVERSATION_BEHAVIOR, supportsConversationBehavior, updateConversationBehavior } from "./behavior-settings";

const base = () => buildBrainSnapshot({ conversationCount: 0, memories: [], retrievedMemoryCount: 0, retrievedMemoryTop: "", retrievedMemoryIds: [], observerEnabled: false, foregroundContext: null, cloudConfigured: false, cloudPending: false });

describe("conversation behavior settings", () => {
  it("rejects invalid slider values without mutating the active preferences", () => {
    const current = { ...DEFAULT_CONVERSATION_BEHAVIOR };
    for (const value of [NaN, Infinity, -0.01, 1.01]) expect(updateConversationBehavior(current, "creativity", value)).toBe(current);
    expect(current).toEqual({ creativity: 0.2, empathy: 0.5 });
    expect(updateConversationBehavior(current, "empathy", 0.876)).toEqual({ creativity: 0.2, empathy: 0.88 });
  });

  it("only unlocks the two implemented local conversation preferences", () => {
    const original = base();
    const adjusted = applyConversationBehavior(original, { creativity: 0.7, empathy: 0.9 }, true);
    expect(adjusted.behaviorControls.filter(control => !control.locked).map(control => [control.id, control.value])).toEqual([["control-creativity", 0.7], ["control-empathy", 0.9]]);
    for (const id of ["control-autonomy", "control-inhibition", "control-memory", "control-speed"]) expect(adjusted.behaviorControls.find(control => control.id === id)).toEqual(original.behaviorControls.find(control => control.id === id));
    expect(adjusted.stateMetrics).toBe(original.stateMetrics);
    expect(original.behaviorControls.every(control => control.locked)).toBe(true);
  });

  it("does not offer unsupported providers or edits while a response is in flight", () => {
    for (const provider of ["openai", "google", "anthropic", "xai", "compatible", ""]) expect(supportsConversationBehavior(provider)).toBe(false);
    expect(supportsConversationBehavior("llamacpp")).toBe(true);
    expect(supportsConversationBehavior("ollama")).toBe(true);
    for (const [supported, busy] of [[false, false], [true, true]]) {
      expect(applyConversationBehavior(base(), { ...DEFAULT_CONVERSATION_BEHAVIOR }, supported, busy).behaviorControls.every(control => control.locked)).toBe(true);
    }
  });
});
