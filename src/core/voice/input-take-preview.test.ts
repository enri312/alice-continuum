import { describe, expect, it, vi } from "vitest";
import { InputTakePreview } from "./input-take-preview";

function fixture() {
  const urls = { createObjectURL: vi.fn((_: Blob) => `blob:take-${urls.createObjectURL.mock.calls.length}`), revokeObjectURL: vi.fn() };
  const audio = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
  return { urls, audio, preview: new InputTakePreview(urls) };
}

describe("vista previa local de la toma filtrada", () => {
  it("usa la misma Blob y libera la URL anterior al reemplazarla", () => {
    const f = fixture(); const take = new Blob(["filtered"]);
    const first = f.preview.replace(take, () => true);
    expect(f.urls.createObjectURL).toHaveBeenCalledWith(take);
    expect(f.audio.pause).not.toHaveBeenCalled();
    const second = f.preview.replace(new Blob(["next"]), () => true, f.audio);
    expect(second).not.toBe(first);
    expect(f.preview.isCurrent(first!)).toBe(false);
    expect(f.preview.isCurrent(second!)).toBe(true);
    expect(f.audio.pause).toHaveBeenCalledOnce();
    expect(f.audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(f.audio.load).toHaveBeenCalledOnce();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(first);
    f.preview.clear(f.audio);
    expect(f.preview.isCurrent(second!)).toBe(false);
    expect(f.urls.revokeObjectURL).toHaveBeenLastCalledWith(second);
  });
  it("libera el reproductor al desmontar aunque React haya retirado su ref", () => {
    const f = fixture(); const url = f.preview.replace(new Blob(["filtered"]), () => true);
    f.preview.bind(f.audio);
    f.preview.clear(null);
    expect(f.audio.pause).toHaveBeenCalledOnce();
    expect(f.audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(f.audio.load).toHaveBeenCalledOnce();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });
  it("detiene y libera al limpiar, sin revocar dos veces", () => {
    const f = fixture(); const url = f.preview.replace(new Blob(["filtered"]), () => true);
    f.preview.clear(f.audio); f.preview.clear();
    expect(f.audio.pause).toHaveBeenCalledOnce();
    expect(f.audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(f.audio.load).toHaveBeenCalledOnce();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });
  it("no crea ni reemplaza audio por un callback de una generación revocada", () => {
    const f = fixture(); let generation = 1;
    const current = () => generation === 1;
    f.preview.replace(new Blob(["current"]), current);
    generation++; f.preview.clear(f.audio);
    expect(f.preview.replace(new Blob(["late"]), current, f.audio)).toBeNull();
    expect(f.urls.createObjectURL).toHaveBeenCalledOnce();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledOnce();
  });
  it("revoca la URL incluso si falla la limpieza del reproductor", () => {
    const f = fixture(); const url = f.preview.replace(new Blob(["filtered"]), () => true);
    f.audio.pause.mockImplementation(() => { throw Error("player closed"); });
    expect(() => f.preview.clear(f.audio)).not.toThrow();
    expect(f.audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(f.audio.load).toHaveBeenCalledOnce();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
    f.preview.clear();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledOnce();
  });
});
