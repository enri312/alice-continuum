import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Alice Continuum identity", () => {
  it("separa las fuentes de Frontend y mantiene la coordinación desde la raíz", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const project = JSON.parse(read("package.json"));
    const frontend = JSON.parse(read("Frontend/package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    expect(project.workspaces).toEqual(["Frontend"]);
    expect(frontend.name).toBe("@alice-continuum/frontend");
    expect(lock.packages.Frontend.name).toBe(frontend.name);
    expect(project.scripts.dev).toContain("--workspace=Frontend");
    expect(project.scripts.build).toContain("--workspace=Frontend");
    for (const file of ["Frontend/src/main.tsx", "Frontend/index.html", "Frontend/vite.config.ts", "Frontend/public/favicon.svg", "Frontend/crates/state-controls/Cargo.toml"]) {
      expect(existsSync(path.join(root, file)), file).toBe(true);
    }
    for (const previous of ["src", "public", "icons", "crates", "index.html", "vite.config.ts"]) expect(existsSync(path.join(root, previous)), previous).toBe(false);
  });
  it("mantiene backend y adaptadores juntos y conserva la ruta del frontend de Tauri", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const native = path.join(root, "Backend", "src-tauri");
    const config = JSON.parse(read("Backend/src-tauri/tauri.conf.json"));
    expect(path.resolve(native, config.build.frontendDist)).toBe(path.join(root, "Frontend/dist"));
    expect(existsSync(path.join(root, "Backend/adapters/document_reader.py"))).toBe(true);
    expect(existsSync(path.join(root, "Backend/adapters/linux_media_bridge.py"))).toBe(true);
    expect(existsSync(path.join(root, "src-tauri"))).toBe(false);
    expect(existsSync(path.join(root, "scripts/adapters"))).toBe(false);
  });
  it("aligns npm, Rust and desktop product names", () => {
    expect(JSON.parse(read("package.json")).name).toBe("alice-continuum");
    const lock = JSON.parse(read("package-lock.json"));
    expect(lock.name).toBe("alice-continuum");
    expect(lock.packages[""].name).toBe("alice-continuum");
    expect(read("Backend/src-tauri/Cargo.toml")).toContain('name = "alice-continuum"');
    expect(read("Backend/src-tauri/Cargo.toml")).toContain('name = "alice_continuum_lib"');
    expect(read("Backend/src-tauri/src/main.rs")).toContain("alice_continuum_lib::run()");
    const config = JSON.parse(read("Backend/src-tauri/tauri.conf.json"));
    expect(config.productName).toBe("Alice Continuum");
    expect(config.app.windows[0].title).toContain("Alice Continuum");
  });

  it("preserves persistent identity and storage keys during the rebrand", () => {
    expect(JSON.parse(read("Backend/src-tauri/tauri.conf.json")).identifier).toBe("com.carlosnunez.alicecognitivecore");
    const app = read("Frontend/src/App.tsx");
    expect(app).toContain('const storageKey = "alice-cognitive-core-sessions-v1"');
    expect(app).toContain('const cloudSelectionKey = "alice-cognitive-core-cloud-selection-v1"');
    expect(app).toContain('"proyecto-p-sessions-v1"');
  });

  it("brands the UI and documentation without renaming the character asset", () => {
    expect(read("Frontend/src/App.tsx")).toContain("ALICE CONTINUUM · MEMORIA, COGNICIÓN Y PRESENCIA");
    expect(read("Frontend/index.html")).toContain("<title>Alice Continuum</title>");
    expect(read("README.md")).toMatch(/^# Alice Continuum/);
    expect(read("docs/especificacion_alice_continuum.html")).toContain("<title>Alice Continuum — Documento maestro</title>");
    expect(read("Frontend/icons/app-alice.svg")).toContain('aria-label="Emblema de Alice Continuum"');
  });

  it("recognizes both executable names for launch and self-observation safety", () => {
    const launcher = read("Iniciar Alice Continuum.cmd");
    expect(launcher).toContain('"%~dp0"');
    expect(launcher).toContain("scripts\\setup\\launch-windows.ps1");
    const windowsLauncher = read("scripts/setup/launch-windows.ps1");
    expect(windowsLauncher).toContain("'alice-continuum','alice-cognitive-core'");
    const observer = read("Backend/src-tauri/src/observation.rs");
    expect(observer).toContain('eq_ignore_ascii_case("alice-continuum.exe")');
    expect(observer).toContain('eq_ignore_ascii_case("alice-cognitive-core.exe")');
  });
});
