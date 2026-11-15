export type SavedRelation = {
  id: string;
  title: string;
  withdrawn: boolean;
  sourcesCurrent: boolean;
};
export type SavedRelationsPayload = { busy: boolean; relations: SavedRelation[] };

// A renderer may request a review, never confirm a write or choose its revision.
export function parseRelationReview(raw: string, payload: SavedRelationsPayload): string | null {
  try {
    const action: unknown = JSON.parse(raw);
    if (payload.busy || !action || typeof action !== "object" || Array.isArray(action)) return null;
    const item = action as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || item.type !== "reviewRelation" || typeof item.id !== "string") return null;
    const relation = payload.relations.find(relation => relation.id === item.id);
    return relation && !(relation.withdrawn && !relation.sourcesCurrent) ? relation.id : null;
  } catch { return null; }
}
