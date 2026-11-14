import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));
const crate = path.join(project, "crates/state-controls");
const output = path.join(project, "src/dioxus/state-controls/pkg");
const args = process.argv.slice(2);
const check = args.includes("--check");
function option(name) { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; }
const digest = value => createHash("sha256").update(value).digest("hex");
function sourceDigest() {
  return digest(["Cargo.toml", "Cargo.lock", ...readdirSync(path.join(crate, "src")).filter(name => name.endsWith(".rs")).sort().map(name => `src/${name}`)]
    .map(name => `${name}\0${readFileSync(path.join(crate, name), "utf8").replace(/\r\n/g, "\n")}`).join("\0"));
}
function artifactDigests() {
  function files(directory, prefix = "") {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? files(path.join(directory, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`]);
  }
  return Object.fromEntries(files(output).filter(name => name !== "build-manifest.json").sort()
    .map(name => [name, digest(readFileSync(path.join(output, name)))]));
}
if (check) {
  const manifest = JSON.parse(readFileSync(path.join(output, "build-manifest.json"), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.sourceSHA256 !== sourceDigest() || JSON.stringify(manifest.artifacts) !== JSON.stringify(artifactDigests())) {
    throw Error("El módulo de Estado y controles no corresponde a las fuentes. Ejecuta npm run dioxus:build.");
  }
  console.log("Estado y controles: fuentes y artefactos Dioxus verificados.");
} else {
  const rustRoot = option("--rust-root");
  const executable = name => rustRoot ? path.join(rustRoot, "bin", `${name}${process.platform === "win32" ? ".exe" : ""}`) : name;
  const cargoHome = path.resolve(option("--cargo-home") ?? path.join(project, "local/dioxus-build/cargo"));
  const privateRoot = path.join(project, "local/dioxus-build");
  const bindgen = option("--bindgen") ?? "wasm-bindgen";
  for (const directory of [cargoHome, privateRoot, path.join(privateRoot, "temp"), output]) mkdirSync(directory, { recursive: true });
  const env = { ...process.env, CARGO_HOME: cargoHome, CARGO_TARGET_DIR: path.join(privateRoot, "target"), TEMP: path.join(privateRoot, "temp"), TMP: path.join(privateRoot, "temp"), CARGO_BUILD_JOBS: "2" };
  for (const name of Object.keys(env)) {
    if (/(api[_-]?key|token|secret|pass(word|wd)?|cookie|authorization|credential|proxy|access[_-]?key|private[_-]?key)/i.test(name) || /^(ALICE_|FISH_|OPENAI_|ANTHROPIC_|GEMINI_|XAI_|OPENROUTER_|DEEPSEEK_)/.test(name)) delete env[name];
  }
  if (rustRoot) { env.RUSTC = executable("rustc"); env.RUSTDOC = executable("rustdoc"); }
  function run(binary, parameters, capture = false) {
    const result = spawnSync(binary, parameters, { cwd: project, env, encoding: "utf8", stdio: capture ? "pipe" : "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error(`No se pudo generar Estado y controles: ${path.basename(binary)} (${result.status}).`);
    return result.stdout?.trim();
  }
  const bindgenVersion = run(bindgen, ["--version"], true);
  if (bindgenVersion !== "wasm-bindgen 0.2.105") throw Error("Se requiere wasm-bindgen CLI 0.2.105.");
  const rustVersion = run(executable("rustc"), ["--version"], true);
  const buildArgs = ["build", "--manifest-path", path.join(crate, "Cargo.toml"), "--locked", "--release", "--target", "wasm32-unknown-unknown"];
  if (!args.includes("--online")) buildArgs.push("--offline");
  if (!existsSync(path.join(crate, "Cargo.lock"))) throw Error("Falta Cargo.lock; generar y revisar antes de compilar.");
  run(executable("cargo"), buildArgs);
  run(bindgen, [path.join(env.CARGO_TARGET_DIR, "wasm32-unknown-unknown/release/alice_state_controls.wasm"), "--target", "web", "--out-dir", output]);
  writeFileSync(path.join(output, "build-manifest.json"), `${JSON.stringify({ schemaVersion: 1, sourceSHA256: sourceDigest(), rustVersion, bindgenVersion, artifacts: artifactDigests() }, null, 2)}\n`);
  console.log("Estado y controles: WASM generado desde las fuentes del principal.");
}
