import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("../../", import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
const options = { cwd: project, env, windowsHide: true, encoding: "utf8" as const };

test("el índice no publica experimentos ni contenido de la bóveda Obsidian", () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], options).split("\0").filter(Boolean);
  const forbiddenCount = tracked.filter(name => name.toLowerCase().startsWith("experiments/")
    || (name.toLowerCase().startsWith("data/obsidian/") && name !== "data/obsidian/.gitkeep")).length;
  assert.equal(forbiddenCount, 0, "Hay contenido privado versionado: revisar el índice antes de publicar.");
});

test("las exclusiones protegen contenido futuro y permiten sólo el marcador vacío", () => {
  const probes = ["experiments/new-pilot/source.rs", "experiments/new-pilot/README.md", "data/obsidian/note.md", "data/obsidian/.obsidian/settings.json", "data/obsidian/Alice (sincronizado)/memory.md"];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", "-z", "--stdin"], { ...options, input: `${probes.join("\0")}\0` }).split("\0").filter(Boolean);
  assert.deepEqual(ignored, probes);
  assert.equal(spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", "data/obsidian/.gitkeep"], options).status, 1);
});
