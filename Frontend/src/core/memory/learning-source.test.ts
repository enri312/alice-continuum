import { afterEach, describe, expect, it, vi } from "vitest";
import { createLearningSource, type LearningSourceState } from "./learning-source";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const snapshots = <T>(onChange: ReturnType<typeof vi.fn<(state: LearningSourceState<T>) => void>>) =>
  onChange.mock.calls.map(([state]) => state.snapshot).filter(snapshot => snapshot !== null);

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("coordinación de fuentes de aprendizaje", () => {
  it("publica la lectura inicial validada con su fecha de recepción", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const read = vi.fn(async () => "inicial");
    const source = createLearningSource({ read, onChange, now: () => 1234 });
    await settle();
    expect(read).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith({ snapshot: "inicial", status: "ready", updatedAt: 1234, error: null });
    source.dispose();
  });

  it("agrupa eventos durante una lectura lenta y descarta la respuesta anterior al evento", async () => {
    vi.useFakeTimers();
    const initial = deferred<string>();
    const recent = deferred<string>();
    const read = vi.fn().mockImplementationOnce(() => initial.promise).mockImplementationOnce(() => recent.promise);
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    source.notifyRefresh(); source.notifyRefresh(); source.notifyRefresh();
    await settle();
    expect(read).toHaveBeenCalledOnce();
    initial.resolve("respuesta desplazada");
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(snapshots(onChange)).not.toContain("respuesta desplazada");
    recent.resolve("último estado");
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall?.[0].snapshot).toBe("último estado");
    source.dispose();
  });

  it("recupera cambios por sondeo aunque no llegue ninguna notificación", async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockResolvedValueOnce("antes").mockResolvedValue("después");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    await settle();
    await vi.advanceTimersByTimeAsync(4999);
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "después", status: "ready", error: null });
    source.dispose();
  });

  it("el sondeo periódico no invalida una lectura lenta cuando no hubo un evento de cambio", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const read = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue("siguiente consulta");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    await vi.advanceTimersByTimeAsync(15000);
    expect(read).toHaveBeenCalledOnce();
    pending.resolve("respuesta válida de una lectura lenta");
    await settle();
    expect(snapshots(onChange)).toContain("respuesta válida de una lectura lenta");
    await vi.advanceTimersByTimeAsync(5000);
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onChange.mock.lastCall?.[0].status).toBe("ready");
    source.dispose();
  });

  it("reintenta errores iniciales y conserva el último estado válido durante fallos posteriores", async () => {
    vi.useFakeTimers();
    const read = vi.fn()
      .mockRejectedValueOnce(Error("lectura inicial fallida"))
      .mockResolvedValueOnce("conservado")
      .mockRejectedValueOnce(Error("interrupción temporal"))
      .mockResolvedValue("recuperado");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange, intervalMs: 1000 });
    await settle();
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: null, status: "error" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "conservado", status: "ready", error: null });
    const receivedAt = onChange.mock.lastCall?.[0].updatedAt;
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "conservado", status: "error", updatedAt: receivedAt });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "recuperado", status: "ready", error: null });
    source.dispose();
  });

  it("confirma una mutación sin esperar una lectura antigua y evita que ésta la sobrescriba", async () => {
    vi.useFakeTimers();
    const old = deferred<string>();
    const authoritative = deferred<string>();
    const read = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => authoritative.promise);
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    const write = vi.fn(async () => "confirmado por el propietario");
    const result = source.runMutation(write);
    await settle();
    await expect(result).resolves.toBe("confirmado por el propietario");
    expect(write).toHaveBeenCalledOnce();
    expect(onChange.mock.lastCall?.[0].snapshot).toBe("confirmado por el propietario");
    expect(read).toHaveBeenCalledOnce();
    source.notifyRefresh(); source.notifyRefresh();
    old.resolve("anterior a la mutación");
    await settle();
    expect(snapshots(onChange)).not.toContain("anterior a la mutación");
    expect(read).toHaveBeenCalledTimes(2);
    authoritative.resolve("confirmado por el propietario");
    await settle();
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "confirmado por el propietario", status: "ready", error: null });
    source.dispose();
  });

  it("serializa dos escrituras y sólo relee cuando termina la cola de mutaciones", async () => {
    vi.useFakeTimers();
    const first = deferred<string>();
    const second = deferred<string>();
    const calls: string[] = [];
    const read = vi.fn().mockResolvedValueOnce("inicial").mockResolvedValue("segunda escritura");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    await settle();
    const one = source.runMutation(() => { calls.push("primera"); return first.promise; });
    const two = source.runMutation(() => { calls.push("segunda"); return second.promise; });
    await settle();
    expect(calls).toEqual(["primera"]);
    source.notifyRefresh();
    first.resolve("primera escritura");
    await one; await settle();
    expect(calls).toEqual(["primera", "segunda"]);
    expect(read).toHaveBeenCalledOnce();
    second.resolve("segunda escritura");
    await two; await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "segunda escritura", status: "ready", error: null });
    source.dispose();
  });

  it("conserva el estado confirmado si una mutación falla y permite la siguiente", async () => {
    vi.useFakeTimers();
    const failed = deferred<string>();
    const read = vi.fn().mockResolvedValueOnce("confirmado").mockResolvedValue("actualizado");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    await settle();
    const result = source.runMutation(() => failed.promise);
    const rejected = expect(result).rejects.toThrow("escritura rechazada");
    failed.reject(Error("escritura rechazada"));
    await rejected;
    expect(onChange.mock.calls.some(([state]) => state.snapshot === "confirmado" && state.status === "error")).toBe(true);
    await source.runMutation(async () => "actualizado");
    await settle();
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ snapshot: "actualizado", status: "ready", error: null });
    source.dispose();
  });

  it("al cerrar descarta la lectura pendiente, eventos nuevos y sondeos futuros", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const read = vi.fn(() => pending.promise);
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    source.dispose();
    const changesBefore = onChange.mock.calls.length;
    source.notifyRefresh();
    pending.resolve("respuesta de una pantalla cerrada");
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledTimes(changesBefore);
  });

  it("no publica errores de una lectura que termina después de cerrar", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read: () => pending.promise, onChange });
    source.dispose();
    const changesBefore = onChange.mock.calls.length;
    pending.reject(Error("fallo de una pantalla cerrada"));
    await settle();
    expect(onChange).toHaveBeenCalledTimes(changesBefore);
  });

  it("una mutación en curso puede resolver al llamador tras cerrar sin volver a publicar estado", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const read = vi.fn(async () => "inicial");
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read, onChange });
    await settle();
    const result = source.runMutation(() => pending.promise);
    await settle();
    source.dispose();
    const changesBefore = onChange.mock.calls.length;
    pending.resolve("escritura ya confirmada");
    await expect(result).resolves.toBe("escritura ya confirmada");
    await vi.advanceTimersByTimeAsync(10000);
    expect(onChange).toHaveBeenCalledTimes(changesBefore);
    expect(read).toHaveBeenCalledOnce();
  });

  it("una suscripción nueva no recibe resultados tardíos de la anterior", async () => {
    vi.useFakeTimers();
    const old = deferred<string>();
    const oldChanges = vi.fn<(state: LearningSourceState<string>) => void>();
    const newChanges = vi.fn<(state: LearningSourceState<string>) => void>();
    const first = createLearningSource<string>({ read: () => old.promise, onChange: oldChanges });
    first.dispose();
    const second = createLearningSource<string>({ read: async () => "sesión nueva", onChange: newChanges });
    await settle();
    old.resolve("sesión anterior");
    await settle();
    expect(snapshots(oldChanges)).not.toContain("sesión anterior");
    expect(snapshots(newChanges)).not.toContain("sesión anterior");
    expect(newChanges.mock.lastCall?.[0].snapshot).toBe("sesión nueva");
    second.dispose();
  });

  it("al cerrar rechaza escrituras todavía en cola y no las ejecuta después", async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const onChange = vi.fn<(state: LearningSourceState<string>) => void>();
    const source = createLearningSource<string>({ read: async () => "inicial", onChange });
    await settle();
    const first = source.runMutation(() => pending.promise);
    const queuedWrite = vi.fn(async () => "no debe ejecutarse");
    const queued = source.runMutation(queuedWrite);
    const rejected = expect(queued).rejects.toBeInstanceOf(Error);
    await settle();
    source.dispose();
    await rejected;
    pending.resolve("primera escritura ya iniciada");
    await expect(first).resolves.toBe("primera escritura ya iniciada");
    await settle();
    expect(queuedWrite).not.toHaveBeenCalled();
  });
});
