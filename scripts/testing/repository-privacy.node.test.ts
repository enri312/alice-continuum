import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = fileURLToPath(new URL("../../", import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
const options = { cwd: project, env, windowsHide: true, encoding: "utf8" as const };

test("el índice sólo publica las guías y el marcador permitidos de datos privados", () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], options).split("\0").filter(Boolean);
  const allowed = new Set(["data/README.md", "data/obsidian/.gitkeep", "runtime/README.md", "runtime/assets/Animations/README.md", "runtime/assets/Models/README.md"]);
  const forbiddenCount = tracked.filter(name => name.toLowerCase().startsWith("experiments/")
    || name.toLowerCase().startsWith("local/")
    || ((name.toLowerCase().startsWith("data/") || name.toLowerCase().startsWith("runtime/")) && !allowed.has(name))).length;
  assert.equal(forbiddenCount, 0, "Hay contenido privado versionado: revisar el índice antes de publicar.");
});

test("las exclusiones protegen contenido futuro y permiten sólo el marcador vacío", () => {
  const probes = ["experiments/new-pilot/source.rs", "experiments/new-pilot/README.md", "data/obsidian/note.md", "data/obsidian/.obsidian/settings.json", "data/obsidian/Alice (sincronizado)/memory.md",
    "data/memory/records.json", "data/conversation/history-v1.json", "data/voice-profile.json", "data/media-playlists.json", "data/.obsidian/settings.json",
    "runtime/ubuntu.env", "runtime/backup.json", "runtime/artifacts/dioxus/native/run/data/memory/records.json", "runtime/maintenance/private-script.mjs", "runtime/archives/recovery/private.json", "runtime/drafts/private-audio.wav", "local/legacy-private.json"];
  const ignored = execFileSync("git", ["check-ignore", "--no-index", "-z", "--stdin"], { ...options, input: `${probes.join("\0")}\0` }).split("\0").filter(Boolean);
  assert.deepEqual(ignored, probes);
  assert.equal(spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", "data/obsidian/.gitkeep"], options).status, 1);
});
