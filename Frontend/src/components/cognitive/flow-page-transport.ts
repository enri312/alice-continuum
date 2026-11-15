import { startAssociationsTransport } from "../memory/associations-transport";

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type Response = { type: "activitySuccess"; id: number; value: unknown } | { type: "activityFailure"; id: number }
  | { type: "associations"; response: unknown };

// No timers or R3 projection here. Rust owns the subscription and validates its data.
export function startFlowPageTransport(options: {
  invoke: Invoke;
  complete: (response: Response) => void;
  nodeIds: () => string[];
  onSelect: (id: string) => void;
}) {
  let active = true;
  let pending = false;
  let lastId = 0;
  const associations = startAssociationsTransport(options.invoke, response => {
    if (active) options.complete({ type: "associations", response });
  });
  return {
    accept(raw: string) {
      if (!active) return;
      let value: unknown;
      try { value = JSON.parse(raw); } catch { return; }
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 2) return;
      const item = value as Record<string, unknown>;
      if (item.scope === "selection" && typeof item.id === "string" && options.nodeIds().includes(item.id)) {
        options.onSelect(item.id);
      } else if (item.scope === "associations" && Object.hasOwn(item, "request")) {
        associations.accept(JSON.stringify(item.request));
      } else if (item.scope === "activity" && typeof item.id === "number" && Number.isInteger(item.id)
        && item.id > lastId && item.id <= 0xffff_ffff && !pending) {
        const id = item.id; lastId = id; pending = true;
        void Promise.resolve().then(() => active ? options.invoke("core_activity_snapshot") : undefined).then(value => {
          pending = false;
          if (active) options.complete({ type: "activitySuccess", id, value: value ?? null });
        }, () => {
          pending = false;
          if (active) options.complete({ type: "activityFailure", id });
        });
      }
    },
    dispose() { active = false; associations.dispose(); },
  };
}
