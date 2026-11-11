import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Alice Continuum identity", () => {
  it("aligns npm, Rust and desktop product names", () => {
    expect(JSON.parse(read("package.json")).name).toBe("alice-continuum");
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.name).toBe("alice-continuum");
    expect(lock.packages[""].name).toBe("alice-continuum");
    expect(read("src-tauri/Cargo.toml")).toContain('name = "alice-continuum"');
    expect(read("src-tauri/Cargo.toml")).toContain('name = "alice_continuum_lib"');
    expect(read("src-tauri/src/main.rs")).toContain("alice_continuum_lib::run()");
    const config = JSON.parse(read("src-tauri/tauri.conf.json"));
    expect(config.productName).toBe("Alice Continuum");
    expect(config.app.windows[0].title).toContain("Alice Continuum");
  });

  it("preserves persistent identity and storage keys during the rebrand", () => {
    expect(JSON.parse(read("src-tauri/tauri.conf.json")).identifier).toBe("com.carlosnunez.alicecognitivecore");
    const app = read("src/App.tsx");
    expect(app).toContain('const storageKey = "alice-cognitive-core-sessions-v1"');
    expect(app).toContain('const cloudSelectionKey = "alice-cognitive-core-cloud-selection-v1"');
    expect(app).toContain('"proyecto-p-sessions-v1"');
  });

  it("brands the UI and documentation without renaming the character asset", () => {
    expect(read("src/App.tsx")).toContain("ALICE CONTINUUM · MEMORIA, COGNICIÓN Y PRESENCIA");
    expect(read("index.html")).toContain("<title>Alice Continuum</title>");
    expect(read("README.md")).toMatch(/^# Alice Continuum/);
    expect(read("docs/especificacion_alice_continuum.html")).toContain("<title>Alice Continuum — Documento maestro</title>");
    expect(read("icons/app-alice.svg")).toContain('aria-label="Emblema de Alice Continuum"');
  });

  it("recognizes both executable names for launch and self-observation safety", () => {
    const launcher = read("Iniciar Alice Continuum.cmd");
    expect(launcher).toContain('"%~dp0"');
    expect(launcher).toContain("scripts\\setup\\launch-windows.ps1");
    const windowsLauncher = read("scripts/setup/launch-windows.ps1");
    expect(windowsLauncher).toContain("'alice-continuum','alice-cognitive-core'");
    const observer = read("src-tauri/src/observation.rs");
    expect(observer).toContain('eq_ignore_ascii_case("alice-continuum.exe")');
    expect(observer).toContain('eq_ignore_ascii_case("alice-cognitive-core.exe")');
  });
});
