type PollingOptions<T> = {
  intervalMs: number;
  read: () => Promise<T>;
  onValue: (value: T) => void;
  onError: (error: unknown) => void;
};

/** One pending read per subscription; disposal ignores late results and errors. */
export function startSerializedPolling<T>({ intervalMs, read, onValue, onError }: PollingOptions<T>): () => void {
  let disposed = false;
  let pending = false;
  async function refresh() {
    if (disposed || pending) return;
    pending = true;
    try {
      const value = await read();
      if (!disposed) onValue(value);
    } catch (error) {
      if (!disposed) onError(error);
    } finally {
      pending = false;
    }
  }
  const timer = setInterval(() => { void refresh(); }, intervalMs);
  void refresh();
  return () => { disposed = true; clearInterval(timer); };
}
