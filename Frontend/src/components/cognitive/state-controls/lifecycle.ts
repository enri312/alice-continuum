export type StateControlsRuntime = {
  mount: (root: string, payload: string, onAction: (raw: string) => void, onReady: () => void) => number;
  update: (id: number, payload: string) => void;
  unmount: (id: number) => void;
};
export type ViewStatus = "loading" | "ready" | "error";

export function startStateControlsView(options: {
  root: string; initial: string;
  load: () => Promise<StateControlsRuntime>;
  onAction: (raw: string) => void;
  onStatus: (status: ViewStatus) => void;
  timeoutMs?: number;
}) {
  let active = true;
  let ready = false;
  let latest = options.initial;
  let runtime: StateControlsRuntime | undefined;
  let id: number | undefined;
  const release = () => {
    if (id === undefined) return;
    const mountedId = id;
    id = undefined;
    try { runtime?.unmount(mountedId); } catch { /* Keep the React view available. */ }
  };
  const fail = () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    release();
    options.onStatus("error");
  };
  const timer = setTimeout(fail, options.timeoutMs ?? 8_000);
  void Promise.resolve().then(options.load).then(loaded => {
    if (!active) return;
    runtime = loaded;
    id = loaded.mount(options.root, latest, raw => { if (active && ready) options.onAction(raw); }, () => {
      // A synchronous acknowledgement must also wait until mount returns its ID.
      queueMicrotask(() => {
        if (!active || ready || id === undefined) return;
        try {
          loaded.update(id, latest);
          ready = true;
          clearTimeout(timer);
          options.onStatus("ready");
        } catch { fail(); }
      });
    });
  }).catch(fail);
  return {
    update(payload: string) {
      latest = payload;
      if (active && ready && id !== undefined) {
        try { runtime?.update(id, latest); } catch { fail(); }
      }
    },
    dispose() { active = false; clearTimeout(timer); release(); },
  };
}
