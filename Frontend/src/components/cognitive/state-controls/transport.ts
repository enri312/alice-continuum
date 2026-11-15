import { parseStateControlsAction, type StateControlsAction, type StateControlsPayload } from "./bridge";

type Response = { type: "activitySuccess"; id: number; value: unknown } | { type: "activityFailure"; id: number };

// Rust owns polling and projection. This boundary transports one closed IPC read.
export function startStateControlsTransport(options: {
  invoke: (command: string) => Promise<unknown>;
  payload: () => StateControlsPayload;
  onAction: (action: StateControlsAction) => void;
  complete: (response: Response) => void;
}) {
  let active = true;
  let pending = false;
  let lastId = 0;
  let queued: number | undefined;
  const read = (id: number) => {
    pending = true;
    const finish = (response: Response) => {
      pending = false;
      if (active) options.complete(response);
      const next = queued; queued = undefined;
      if (active && next !== undefined) read(next);
    };
    void Promise.resolve().then(() => active ? options.invoke("core_activity_snapshot") : undefined).then(
      value => finish({ type: "activitySuccess", id, value: value ?? null }),
      () => finish({ type: "activityFailure", id }),
    );
  };
  return {
    accept(raw: string) {
      if (!active) return;
      let value: unknown;
      try { value = JSON.parse(raw); } catch { return; }
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const request = value as Record<string, unknown>;
      if (request.scope === "activity") {
        if (Object.keys(request).length !== 2 || typeof request.id !== "number" || !Number.isInteger(request.id)
          || request.id <= lastId || request.id > 0xffff_ffff) return;
        const id = request.id; lastId = id;
        // A new configuration can request a read while an obsolete one finishes.
        if (pending) queued = id;
        else read(id);
        return;
      }
      const action = parseStateControlsAction(raw, options.payload());
      if (action) options.onAction(action);
    },
    dispose() { active = false; queued = undefined; },
  };
}
