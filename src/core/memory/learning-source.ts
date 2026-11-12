export type LearningSourceStatus = "loading" | "ready" | "error";

export type LearningSourceState<T> = {
  snapshot: T | null;
  status: LearningSourceStatus;
  updatedAt: number | null;
  error: string | null;
};

export type LearningSourceController<T> = {
  notifyRefresh: () => void;
  runMutation: (write: () => Promise<T>) => Promise<T>;
  dispose: () => void;
};

type LearningSourceOptions<T> = {
  read: () => Promise<T>;
  onChange: (state: LearningSourceState<T>) => void;
  intervalMs?: number;
  now?: () => number;
};

type Mutation<T> = {
  write: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/** One read at a time, ordered writes, and no publication from displaced reads. */
export function createLearningSource<T>({
  read, onChange, intervalMs = 5_000, now = Date.now,
}: LearningSourceOptions<T>): LearningSourceController<T> {
  let state: LearningSourceState<T> = { snapshot: null, status: "loading", updatedAt: null, error: null };
  let disposed = false;
  let revision = 0;
  let readPending = false;
  let readRequested = false;
  let writePending = false;
  const mutations: Mutation<T>[] = [];
  const closed = () => new Error("La fuente de aprendizaje ya está cerrada.");

  function publish(snapshot: T) {
    if (disposed) return;
    state = { snapshot, status: "ready", updatedAt: now(), error: null };
    onChange(state);
  }

  function fail(error: unknown) {
    if (disposed) return;
    state = { ...state, status: "error", error: error instanceof Error ? error.message : String(error) };
    onChange(state);
  }

  async function refresh() {
    if (disposed || readPending || writePending || mutations.length || !readRequested) return;
    readRequested = false;
    readPending = true;
    const requestRevision = revision;
    try {
      const value = await read();
      if (!disposed && requestRevision === revision) publish(value);
    } catch (error) {
      if (!disposed && requestRevision === revision) fail(error);
    } finally {
      readPending = false;
      if (!disposed) void refresh();
    }
  }

  async function drainMutations() {
    if (disposed || writePending) return;
    const next = mutations.shift();
    if (!next) { void refresh(); return; }
    writePending = true;
    try {
      const value = await next.write();
      publish(value);
      next.resolve(value);
    } catch (error) {
      fail(error);
      next.reject(error);
    } finally {
      writePending = false;
      readRequested = true;
      if (!disposed) void drainMutations();
    }
  }

  function notifyRefresh() {
    if (disposed) return;
    // An event says the authority changed: an already pending read is displaced.
    revision += 1;
    readRequested = true;
    void refresh();
  }

  onChange(state);
  const timer = setInterval(() => {
    if (disposed) return;
    // A fallback tick is not evidence of a change. Let a slow valid read finish.
    readRequested = true;
    void refresh();
  }, intervalMs);
  notifyRefresh();
  return {
    notifyRefresh,
    runMutation(write) {
      if (disposed) return Promise.reject(closed());
      revision += 1;
      readRequested = true;
      const result = new Promise<T>((resolve, reject) => { mutations.push({ write, resolve, reject }); });
      // A slow old status read must not delay an owner's pause or review.
      void drainMutations();
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      revision += 1;
      clearInterval(timer);
      for (const mutation of mutations.splice(0)) mutation.reject(closed());
    },
  };
}
