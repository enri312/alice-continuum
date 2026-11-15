import { afterEach, describe, expect, it, vi } from "vitest";
import { startStateControlsView, type StateControlsRuntime } from "./lifecycle";

afterEach(() => vi.useRealTimers());
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture() {
  let acknowledge = () => {};
  let event = (_raw: string) => {};
  const runtime = { mount: vi.fn((_root: string, _payload: string, action: (raw: string) => void, ready: () => void) => { acknowledge = ready; event = action; return 12; }), update: vi.fn(), unmount: vi.fn() };
  const onStatus = vi.fn(), onAction = vi.fn();
  const host = startStateControlsView({ root: "root", initial: "first", load: async () => runtime, onStatus, onAction });
  return { host, runtime, onStatus, onAction, ready: () => acknowledge(), event: (raw: string) => event(raw) };
}
describe("ciclo de vida de la vista Dioxus", () => {
  it("espera el primer montaje real, entrega el último snapshot y limpia al navegar", async () => {
    const value = fixture();
    value.host.update("latest");
    await flush();
    expect(value.onStatus).not.toHaveBeenCalled();
    value.event("early"); expect(value.onAction).not.toHaveBeenCalled();
    value.ready(); await flush();
    expect(value.runtime.update).toHaveBeenLastCalledWith(12, "latest");
    expect(value.onStatus).toHaveBeenLastCalledWith("ready");
    value.event("current"); expect(value.onAction).toHaveBeenCalledWith("current");
    value.host.dispose(); value.event("stale");
    expect(value.runtime.unmount).toHaveBeenCalledExactlyOnceWith(12);
    expect(value.onAction).toHaveBeenCalledTimes(1);
  });
  it("no monta una inicialización que termina después de abandonar la pantalla", async () => {
    let complete: (value: StateControlsRuntime) => void = () => {};
    const mount = vi.fn();
    const host = startStateControlsView({ root: "root", initial: "first", load: () => new Promise(resolve => { complete = resolve; }), onAction: vi.fn(), onStatus: vi.fn() });
    await flush(); host.dispose(); complete({ mount, update: vi.fn(), unmount: vi.fn() }); await flush();
    expect(mount).not.toHaveBeenCalled();
  });
  it("vuelve al panel disponible ante un montaje vencido o una actualización fallida", async () => {
    vi.useFakeTimers();
    const value = fixture(); await flush();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(value.onStatus).toHaveBeenCalledWith("error");
    expect(value.runtime.unmount).toHaveBeenCalledWith(12);
    value.ready(); await flush(); expect(value.onStatus).not.toHaveBeenCalledWith("ready");
    const broken = fixture(); await flush(); broken.ready(); await flush();
    broken.runtime.update.mockImplementation(() => { throw Error("unavailable"); });
    broken.host.update("next");
    expect(broken.onStatus).toHaveBeenLastCalledWith("error");
    expect(broken.runtime.unmount).toHaveBeenCalledExactlyOnceWith(12);
    broken.host.dispose();
  });
});
