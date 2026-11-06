import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the real project configuration against disposable files, never actual memories.
describe("frontera HTTP del servidor de desarrollo", () => {
  let root: string;
  let server: ViteDevServer;
  let origin: string;
  // Keep fixtures on the project's drive: Vite's Windows /@fs middleware resolves
  // its raw static root on that drive. A cross-drive URL can fall back to HTML.
  const fixtureParent = fileURLToPath(new URL("../../node_modules/.cache/", import.meta.url));
  const marker = "ALICE_SYNTHETIC_PRIVATE_FIXTURE";
  const privateFiles = ["data/records.json", "local/assets/avatar.vrm", ".cargo-target/cache.txt", ".env", "credentials.key", ".npmrc"];

  beforeAll(async () => {
    await mkdir(fixtureParent, {recursive:true});
    root = await mkdtemp(path.join(fixtureParent, "alice-dev-boundary-"));
    for (const file of privateFiles) {
      await mkdir(path.dirname(path.join(root, file)), { recursive:true });
      await writeFile(path.join(root, file), marker);
    }
    await mkdir(path.join(root, "icons"));
    await writeFile(path.join(root, "icons/app.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await writeFile(path.join(root, "index.html"), "<!doctype html><title>Alice fixture</title>");
    server = await createServer({
      configFile: fileURLToPath(new URL("../../vite.config.ts", import.meta.url)),
      root, logLevel:"silent", server:{host:"127.0.0.1",port:0,watch:null},
    });
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string") throw Error("Missing ephemeral port");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await server?.close();
    if (root && path.dirname(path.resolve(root)) === path.resolve(fixtureParent)
        && path.basename(root).startsWith("alice-dev-boundary-")) {
      await rm(root, {recursive:true,force:true});
    }
  });

  it.each(privateFiles)("bloquea %s con y sin consulta o ruta absoluta", async file => {
    for (const route of [`/${file}`, `/${file}?raw`, `/@fs/${path.join(root, file).replaceAll("\\", "/")}`]) {
      const response = await fetch(`${origin}${route}`);
      expect(response.status, route).toBe(403);
      expect(await response.text()).not.toContain(marker);
    }
  });
  it("bloquea el nombre codificado y no filtra por cambios de mayúsculas", async () => {
    expect((await fetch(`${origin}/%64ata/records.json`)).status).toBe(403);
    const response = await fetch(`${origin}/DATA/records.json`);
    expect(response.status).not.toBe(200);
    expect(await response.text()).not.toContain(marker);
  });
  it("mantiene disponibles la interfaz y los iconos públicos del proyecto", async () => {
    for (const route of ["/", "/icons/app.svg"]) {
      expect((await fetch(`${origin}${route}`)).status).toBe(200);
    }
  });
});
