type GovernanceAction = { type: string; id?: string; value?: string; checked?: boolean };

export function parseGovernanceAction(raw: string): GovernanceAction | null {
  try {
    const event = JSON.parse(raw) as Partial<GovernanceAction> | null;
    return event && typeof event.type === "string" &&
      (event.id === undefined || typeof event.id === "string") &&
      (event.value === undefined || typeof event.value === "string") &&
      (event.checked === undefined || typeof event.checked === "boolean") ? event as GovernanceAction : null;
  } catch { return null; }
}
