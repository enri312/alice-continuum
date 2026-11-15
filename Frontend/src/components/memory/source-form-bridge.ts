export type SourceChoice = { id: string; title: string; entry: string };
export type SourceFormPayload = {
  busy: boolean;
  sources: SourceChoice[];
  selected: [string, string];
  quotes: [string, string];
};
export type SourceFormAction =
  | { type: "selectSource"; index: 0 | 1; id: string }
  | { type: "editQuote"; index: 0 | 1; quote: string }
  | { type: "previewSources" };

export function buildSourceChoices(ids: string[], records: { id: string; intention: string }[], selected: string[]): SourceChoice[] {
  const entries = new Map(records.map(record => [record.id, record.intention]));
  return ids.map(id => ({
    id, title: entries.get(id)?.slice(0, 90) || id,
    entry: selected.includes(id) ? entries.get(id) ?? "" : "",
  }));
}

export function canPreviewSources(payload: SourceFormPayload) {
  return !payload.busy && payload.sources.length >= 2 && payload.selected[0] !== payload.selected[1]
    && payload.selected.every(id => id.length > 0 && payload.sources.some(source => source.id === id))
    && payload.quotes.every(quote => quote.trim().length > 0 && quote.length <= 2048);
}

// Sources, versions and hashes are selected by the host, never accepted from WASM.
export function parseSourceFormAction(raw: string, payload: SourceFormPayload): SourceFormAction | null {
  try {
    const action: unknown = JSON.parse(raw);
    if (payload.busy || !action || typeof action !== "object" || Array.isArray(action)) return null;
    const item = action as Record<string, unknown>;
    if (item.type === "previewSources") {
      return Object.keys(item).length === 1 && canPreviewSources(payload) ? { type: "previewSources" } : null;
    }
    if (Object.keys(item).length !== 3 || (item.index !== 0 && item.index !== 1)) return null;
    if (item.type === "selectSource" && typeof item.id === "string"
      && (item.id === "" || payload.sources.some(source => source.id === item.id))) {
      return { type: "selectSource", index: item.index, id: item.id };
    }
    if (item.type === "editQuote" && typeof item.quote === "string" && item.quote.length <= 2048) {
      return { type: "editQuote", index: item.index, quote: item.quote };
    }
    return null;
  } catch { return null; }
}
