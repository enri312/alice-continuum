type Evidence = { recordId: string; recordVersion: number; recordSha256: string; quote: string };
type Request =
  | { type: "refresh"; id: number }
  | { type: "preview"; id: number; evidence: Evidence[] }
  | { type: "create"; id: number; evidence: Evidence[]; expectedRevision: number }
  | { type: "change"; id: number; relationId: string; withdrawn: boolean; expectedRevision: number };
type Completion = { type: "success"; id: number; value: unknown } | { type: "failure"; id: number; error: string };
type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

// Closed transport: UI events cannot supply arbitrary Tauri commands or arguments.
export function parseAssociationsRequest(raw: string): Request | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || !integer(value.id) || value.id < 1 || value.id > 0xffff_ffff) return null;
    const keys = Object.keys(value).length;
    if (value.type === "refresh" && keys === 2) return { type: "refresh", id: value.id };
    if ((value.type === "preview" && keys === 3) || (value.type === "create" && keys === 4 && integer(value.expectedRevision))) {
      if (!Array.isArray(value.evidence) || value.evidence.length !== 2 || !value.evidence.every(item => object(item)
        && Object.keys(item).length === 4 && typeof item.recordId === "string" && item.recordId.length > 0
        && integer(item.recordVersion) && typeof item.recordSha256 === "string" && /^sha256:[a-fA-F0-9]{64}$/.test(item.recordSha256)
        && typeof item.quote === "string" && item.quote.trim().length > 0 && item.quote.length <= 2048)) return null;
      const evidence = value.evidence as Evidence[];
      if (evidence[0].recordId === evidence[1].recordId) return null;
      return value.type === "preview" ? { type: "preview", id: value.id, evidence }
        : { type: "create", id: value.id, evidence, expectedRevision: value.expectedRevision as number };
    }
    if (value.type === "change" && keys === 5 && typeof value.relationId === "string" && value.relationId.length > 0
      && typeof value.withdrawn === "boolean" && integer(value.expectedRevision)) {
      return { type: "change", id: value.id, relationId: value.relationId, withdrawn: value.withdrawn, expectedRevision: value.expectedRevision };
    }
    return null;
  } catch { return null; }
}

export function startAssociationsTransport(invoke: Invoke, complete: (response: Completion) => void) {
  let active = true;
  let inFlight = false;
  let lastId = 0;
  async function execute(request: Request): Promise<unknown> {
    switch (request.type) {
      case "refresh": {
        const [graph, memory, relations] = await Promise.all([
          invoke("knowledge_graph_snapshot"), invoke("load_memory"), invoke("knowledge_graph_associations"),
        ]);
        return { graph, memory, relations };
      }
      case "preview": return invoke("preview_knowledge_graph_association", { evidence: request.evidence });
      case "create": return invoke("confirm_knowledge_graph_association", {
        evidence: request.evidence, expectedRevision: request.expectedRevision, confirmed: true,
      });
      case "change": return invoke("set_knowledge_graph_association_withdrawn", {
        id: request.relationId, withdrawn: request.withdrawn, expectedRevision: request.expectedRevision, confirmed: true,
      });
    }
  }
  return {
    accept(raw: string) {
      const request = parseAssociationsRequest(raw);
      if (!active || inFlight || !request || request.id <= lastId) return;
      lastId = request.id; inFlight = true;
      void Promise.resolve().then(() => active ? execute(request) : undefined).then(value => {
        inFlight = false;
        if (active) complete({ type: "success", id: request.id, value: value ?? null });
      }, error => {
        inFlight = false;
        if (active) complete({ type: "failure", id: request.id, error: String(error) });
      });
    },
    dispose() { active = false; },
  };
}
