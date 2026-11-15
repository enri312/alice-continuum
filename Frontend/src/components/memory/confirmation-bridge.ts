export type ConfirmationPayload = {
  kind: "create" | "change";
  token: string;
  busy: boolean;
  quotes: string[];
  withdrawn: boolean;
};
export type ConfirmationAction = "confirm" | "cancel";

export function parseConfirmationAction(raw: string, pending: ConfirmationPayload): ConfirmationAction | null {
  try {
    const action: unknown = JSON.parse(raw);
    if (!action || typeof action !== "object" || Array.isArray(action) || pending.busy || !pending.token) return null;
    const item = action as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || item.token !== pending.token) return null;
    if (item.type === "confirm") return "confirm";
    if (item.type === "cancel" && pending.kind === "change") return "cancel";
    return null;
  } catch { return null; }
}
