import { describe, expect, it } from "vitest";
import { lifecycleActionDescription, lifecycleActionsForStatus } from "./skill-workshop";

describe("skill workshop lifecycle policy", () => {
  it("exposes only the valid owner action for each guarded state", () => {
    expect(lifecycleActionsForStatus("draft").map(({ action }) => action)).toEqual(["submitReview"]);
    expect(lifecycleActionsForStatus("inReview").map(({ action }) => action)).toEqual(["approve"]);
    expect(lifecycleActionsForStatus("approved").map(({ action }) => action)).toEqual(["disable", "retire"]);
    expect(lifecycleActionsForStatus("disabled").map(({ action }) => action)).toEqual(["restore", "retire"]);
    expect(lifecycleActionsForStatus("retired")).toEqual([]);
  });

  it("keeps approval language explicit about execution remaining disabled", () => {
    expect(lifecycleActionDescription("approve")).toContain("ejecución deshabilitada");
  });
});
