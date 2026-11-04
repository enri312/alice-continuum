import { afterEach, describe, expect, it, vi } from "vitest";
import { startSerializedPolling } from "./polling";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("sondeos de estado serializados", () => {
  it("consulta al iniciar y mantiene el intervalo cuando el backend responde", async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => "estado");
    const onValue = vi.fn();
    const stop = startSerializedPolling({ intervalMs: 2000, read, onValue, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(onValue).toHaveBeenCalledWith("estado");
    await vi.advanceTimersByTimeAsync(1999);
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });

  it("no acumula consultas durante una lectura lenta y continúa al terminar", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const read = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue("nuevo");
    const onValue = vi.fn();
    const stop = startSerializedPolling({ intervalMs: 2000, read, onValue, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).toHaveBeenCalledOnce();
    expect(onValue).not.toHaveBeenCalled();
    pending.resolve("primero");
    await vi.advanceTimersByTimeAsync(2000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onValue.mock.calls.map(([value]) => value)).toEqual(["primero", "nuevo"]);
    stop();
  });

  it("ignora el resultado pendiente y las próximas consultas al cerrar", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const read = vi.fn(() => pending.promise);
    const onValue = vi.fn();
    const stop = startSerializedPolling({ intervalMs: 2000, read, onValue, onError: vi.fn() });
    stop();
    pending.resolve("estado de una vista cerrada");
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).toHaveBeenCalledOnce();
    expect(onValue).not.toHaveBeenCalled();
  });

  it("no aplica un error que llega después de cerrar", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const onError = vi.fn();
    const stop = startSerializedPolling({ intervalMs: 2000, read: () => pending.promise, onValue: vi.fn(), onError });
    stop();
    pending.reject(Error("lectura ya cancelada"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it("informa un fallo vigente y permite recuperarse en el siguiente intervalo", async () => {
    vi.useFakeTimers();
    const failure = Error("backend temporalmente ocupado");
    const read = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue("recuperado");
    const onValue = vi.fn();
    const onError = vi.fn();
    const stop = startSerializedPolling({ intervalMs: 2000, read, onValue, onError });
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onValue).toHaveBeenCalledWith("recuperado");
    stop();
  });

  it("una suscripción nueva no recibe el resultado de la anterior", async () => {
    vi.useFakeTimers();
    const old = deferred<string>();
    const read = vi.fn().mockImplementationOnce(() => old.promise).mockResolvedValue("sesión nueva");
    const oldValues = vi.fn();
    const newValues = vi.fn();
    const stopOld = startSerializedPolling({ intervalMs: 2000, read, onValue: oldValues, onError: vi.fn() });
    stopOld();
    const stopNew = startSerializedPolling({ intervalMs: 2000, read, onValue: newValues, onError: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    old.resolve("sesión anterior");
    await vi.advanceTimersByTimeAsync(0);
    expect(oldValues).not.toHaveBeenCalled();
    expect(newValues.mock.calls).toEqual([["sesión nueva"]]);
    stopNew();
  });
});
