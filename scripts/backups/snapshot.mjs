import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyNew, digest, exists, fail, hashFile, inside, jsonBytes, mkdir, noLinks, relativePath, validateData, walk, writeNew } from './files.mjs';
import { protectPrivateDirectory } from './permissions.mjs';

const exec = promisify(execFile);
const PROJECT = fileURLToPath(new URL('../../', import.meta.url));
const ENV_NAMES = [
  'ALICE_DATA_DIR', 'ALICE_INFERENCE_HOME', 'ALICE_LLAMA_SERVER', 'ALICE_GEMMA_MODEL',
  'ALICE_GEMMA_PROJECTOR', 'ALICE_WHISPER_BIN', 'ALICE_WHISPER_MODEL', 'ALICE_PYTHON_BIN',
  'ALICE_GPU_LAYERS', 'FISH_API_KEY', 'ALICE_FISH_REFERENCE_ID', 'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENROUTER_API_KEY',
  'DEEPSEEK_API_KEY', 'ALICE_COMPATIBLE_API_KEY', 'ALICE_COMPATIBLE_BASE_URL',
  'ALICE_YOUTUBE_PLAYLIST_URL', 'ALICE_YOUTUBE_PLAYLIST', 'ALICE_BACKUP_DIR', 'OLLAMA_MODELS',
];
const SNAPSHOT_NAME = /^snapshot-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9-]{36}$/;
const EXCLUSIONS = [
  'Pesos y motores externos (ALICE_INFERENCE_HOME y rutas equivalentes).',
  'node_modules, dist, caches Rust, entornos Python y otros archivos ignorados por Git fuera de data/, local/assets/ y configuracion seleccionada.',
  'Memoria RAM, audio y fotogramas efimeros, credenciales del sistema no presentes en el entorno del lanzador, Git reflogs y objetos sin referencias.',
];

async function git(cwd, args) {
  try {
    // A shell/hook may export GIT_DIR or GIT_WORK_TREE. In recovery those must
    // never redirect a command from the new target to the original repository.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
    env.GIT_TERMINAL_PROMPT = '0';
    return (await exec('git', ['-C', cwd, ...args], { env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true })).stdout;
  } catch { fail(`Git no pudo completar ${args[0]}; revisa su instalacion y el repositorio.`); }
}

export async function settings(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? PROJECT);
  await noLinks(projectRoot);
  const configPath = path.join(projectRoot, 'local/backup.json');
  let config = {};
  if (await exists(configPath)) {
    await noLinks(configPath);
    try { config = JSON.parse(await fs.readFile(configPath, 'utf8')); }
    catch { fail('local/backup.json no contiene una configuracion JSON valida.'); }
    if (config.schemaVersion !== 1) fail('Version de configuracion de respaldo no admitida.');
  }
  const env = options.env ?? process.env;
  // Keep the default alongside the checkout, never implicitly on the Windows
  // system drive. A separate physical disk can be selected explicitly.
  const destination = options.destination ?? env.ALICE_BACKUP_DIR ?? config.destinations?.[process.platform]
    ?? path.join(path.dirname(projectRoot), 'Alice Backups', path.basename(projectRoot));
  const dataRoot = options.dataRoot ?? env.ALICE_DATA_DIR ?? path.join(projectRoot, 'data');
  const intervalMinutes = options.intervalMinutes ?? config.intervalMinutes ?? 15;
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) fail('El intervalo debe ser de 1 a 1440 minutos.');
  if (typeof destination !== 'string' || !path.isAbsolute(destination) || !path.isAbsolute(dataRoot)) fail('Las rutas de datos y respaldos deben ser absolutas.');
  const sourceRoots = [projectRoot, dataRoot];
  if (sourceRoots.some(root => inside(root, destination) || inside(destination, root))) {
    fail('El destino de respaldo debe estar separado del proyecto y de sus datos.');
  }
  await noLinks(destination);
  await noLinks(dataRoot);
  return { projectRoot, dataRoot: path.resolve(dataRoot), destination: path.resolve(destination), intervalMinutes, env };
}

async function gitState(root) {
  const actual = path.resolve((await git(root, ['rev-parse', '--show-toplevel'])).trim());
  const expected = path.resolve(root);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(actual) !== normalize(expected)) fail('La raiz del proyecto debe ser la raiz completa del repositorio Git.');
  const head = (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim();
  const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  const refs = (await git(root, ['for-each-ref', '--format=%(objectname) %(refname)'])).trim().split('\n').filter(Boolean).sort();
  return { head, branch, refs };
}

async function inventory(config) {
  const entries = new Map();
  const put = async (relative, source, kind) => {
    relativePath(relative);
    if (!await exists(source)) return;
    const metadata = await hashFile(source);
    entries.set(relative, { path: relative, kind, ...metadata, source });
  };
  const files = (await git(config.projectRoot, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).split('\0').filter(Boolean);
  for (const relative of new Set(files)) await put(relative, path.join(config.projectRoot, relative), 'code');
  for (const [source, prefix, kind] of [
    [config.dataRoot, 'data', 'data'],
    [path.join(config.projectRoot, 'local/assets'), 'local/assets', 'assets'],
    [path.join(config.projectRoot, 'local/recovered-settings'), 'local/recovered-settings', 'configuration'],
  ]) {
    for (const relative of await walk(source)) await put(`${prefix}/${relative}`, path.join(source, relative), kind);
  }
  for (const name of await fs.readdir(config.projectRoot)) {
    if (name === '.env' || name.startsWith('.env.')) await put(name, path.join(config.projectRoot, name), 'configuration');
  }
  for (const relative of ['local/ubuntu.env', 'local/backup.json']) await put(relative, path.join(config.projectRoot, relative), 'configuration');
  // Windows does not load the Linux Fish file. Do not inspect its user home.
  if (process.platform !== 'win32' || config.env.XDG_CONFIG_HOME) {
    const fish = path.join(config.env.XDG_CONFIG_HOME ?? os.homedir() + '/.config', 'alice-continuum/fish.env');
    await put('local/recovered-settings/fish.env', fish, 'configuration');
  }
  const savedEnvironment = path.join(config.projectRoot, 'local/recovered-settings/environment.json');
  let savedVariables = {};
  if (await exists(savedEnvironment)) {
    await noLinks(savedEnvironment);
    let saved;
    try { saved = JSON.parse(await fs.readFile(savedEnvironment, 'utf8')); }
    catch { fail('La configuracion recuperada no contiene JSON valido.'); }
    if (saved.schemaVersion !== 1 || !saved.variables || typeof saved.variables !== 'object') fail('La configuracion recuperada necesita revision.');
    savedVariables = saved.variables;
  }
  const environment = Object.fromEntries(ENV_NAMES.filter(name => config.env[name] !== undefined || savedVariables[name] !== undefined)
    .map(name => [name, config.env[name] ?? savedVariables[name]]));
  if (Object.values(environment).some(value => typeof value !== 'string')) fail('La configuracion recuperada contiene valores no textuales.');
  const content = jsonBytes({ schemaVersion: 1, variables: environment });
  entries.set('local/recovered-settings/environment.json', {
    path: 'local/recovered-settings/environment.json', kind: 'configuration',
    sha256: digest(content), size: content.length, mode: 0o600, content,
  });
  // Refuse case aliases even on Linux so the same backup can be restored on NTFS.
  const names = [...entries.keys()];
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) fail('Hay rutas que solo difieren en mayusculas.');
  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function publicEntry({ source: _source, content: _content, ...entry }) { return entry; }
function signature(files, state) { return digest(jsonBytes({ files: files.map(publicEntry), git: state })); }

async function acquireLock(destination) {
  const file = path.join(destination, '.backup.lock');
  const token = randomUUID();
  const lock = jsonBytes({ pid: process.pid, host: os.hostname(), token });
  try { await writeNew(file, lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Only one process may reclaim a dead lock. Without this gate two readers
    // could both unlink the old lock and accidentally remove the new owner's lock.
    const recoveryGate = path.join(destination, '.backup-lock-recovery');
    try { await fs.mkdir(recoveryGate, { mode: 0o700 }); }
    catch (gateError) {
      if (gateError.code === 'EEXIST') fail('Ya se esta revisando un bloqueo de respaldo; reintenta o revisa el bloqueo.');
      throw gateError;
    }
    try {
      await noLinks(file);
      const oldBytes = await fs.readFile(file);
      let old;
      try { old = JSON.parse(oldBytes); } catch { fail('El bloqueo de respaldo requiere revision manual.'); }
      if (old.host !== os.hostname() || !Number.isSafeInteger(old.pid) || old.pid <= 0) fail('El destino esta bloqueado por otro equipo o requiere revision.');
      let alive = true;
      try { process.kill(old.pid, 0); } catch (probe) { if (probe.code === 'ESRCH') alive = false; }
      if (alive) fail('Ya hay un respaldo en curso para este destino.');
      if (!(await fs.readFile(file)).equals(oldBytes)) fail('El bloqueo cambio; reintenta mas tarde.');
      await fs.unlink(file);
      return await acquireLock(destination);
    } finally { await fs.rmdir(recoveryGate); }
  }
  return async () => {
    if ((await fs.readFile(file)).equals(lock)) await fs.unlink(file);
  };
}

export async function listSnapshots(destination) {
  await noLinks(destination);
  if (!await exists(destination)) return [];
  return (await fs.readdir(destination, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && SNAPSHOT_NAME.test(entry.name))
    .map(entry => path.join(destination, entry.name)).sort().reverse();
}

// The manifest is hashed independently. Hashes detect damage, not forgery by a
// person who can rewrite both the backup and its checksums.
export async function verifySnapshot(snapshot) {
  if (!path.isAbsolute(snapshot)) fail('La ruta del respaldo debe ser absoluta.');
  await noLinks(snapshot);
  const manifestFile = path.join(snapshot, 'manifest.json');
  const sumFile = path.join(snapshot, 'manifest.sha256');
  await noLinks(manifestFile); await noLinks(sumFile);
  const bytes = await fs.readFile(manifestFile);
  if ((await fs.readFile(sumFile, 'utf8')).trim() !== digest(bytes)) fail('El manifiesto del respaldo esta incompleto o alterado.');
  let manifest;
  try { manifest = JSON.parse(bytes); } catch { fail('El manifiesto no contiene JSON valido.'); }
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length
    || !/^[a-f0-9]{40,64}$/.test(manifest.git?.head ?? '') || typeof manifest.git.branch !== 'string'
    || typeof manifest.source?.projectRoot !== 'string' || typeof manifest.source?.dataRoot !== 'string') fail('Formato de respaldo no admitido.');
  const expected = new Set(['manifest.json', 'manifest.sha256', 'project.bundle']);
  const names = new Set();
  for (const entry of manifest.files) {
    relativePath(entry.path);
    const key = entry.path.toLowerCase();
    if (names.has(key) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size < 0
      || !Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777
      || !['code', 'data', 'assets', 'configuration'].includes(entry.kind)) fail('Entrada de respaldo invalida o duplicada.');
    names.add(key);
    expected.add(`files/${entry.path}`);
    const file = path.join(snapshot, 'files', entry.path);
    const actual = await hashFile(file);
    if (actual.sha256 !== entry.sha256 || actual.size !== entry.size) fail('Un archivo del respaldo falta o no coincide con su SHA-256.');
    if (entry.kind === 'data') await validateData(file, entry.path);
  }
  const actualNames = await walk(snapshot);
  if (actualNames.length !== expected.size || actualNames.some(name => !expected.has(name))) fail('El inventario del respaldo contiene archivos no declarados.');
  const bundle = await hashFile(path.join(snapshot, 'project.bundle'));
  if (bundle.sha256 !== manifest.bundle?.sha256 || bundle.size !== manifest.bundle?.size) fail('El historial Git del respaldo no coincide con su SHA-256.');
  // --all HEAD produces a standalone bundle. Reject prerequisites so recovery
  // never relies on the lost source repository.
  const handle = await fs.open(path.join(snapshot, 'project.bundle'), 'r');
  let header = '';
  try {
    const buffer = Buffer.alloc(4096);
    while (!header.includes('\n\n') && header.length < 4 * 1024 * 1024) {
      const read = await handle.read(buffer, 0, buffer.length, null);
      if (!read.bytesRead) break;
      header += buffer.subarray(0, read.bytesRead).toString('latin1');
    }
  } finally { await handle.close(); }
  header = header.split('\n\n')[0];
  if (!/^# v[23] git bundle\n/.test(header) || /^-/m.test(header)
    || !header.split('\n').includes(`${manifest.git.head} HEAD`)) fail('El bundle Git no es una copia independiente del commit indicado.');
  return manifest;
}

export async function createSnapshot(options = {}) {
  const config = await settings(options);
  await mkdir(config.destination);
  await protectPrivateDirectory(config.destination);
  const release = await acquireLock(config.destination);
  try {
    const state = await gitState(config.projectRoot);
    const files = await inventory(config);
    const sourceSignature = signature(files, state);
    const previous = (await listSnapshots(config.destination))[0];
    if (!options.force && previous) {
      let latest;
      try { latest = await verifySnapshot(previous); }
      catch { (options.onWarning ?? console.warn)('[Respaldo] La copia anterior no paso la verificacion; se conserva y se creara otra.'); }
      if (latest?.sourceSignature === sourceSignature) return { snapshot: previous, changed: false, files: files.length };
    }
    const total = files.reduce((sum, entry) => sum + entry.size, 0);
    const space = await fs.statfs(config.destination);
    // Leave headroom for Git and the OS. No previous version is deleted to make space.
    if (space.bavail * space.bsize < total + 512 * 1024 * 1024) fail('No hay espacio suficiente para respaldar sin borrar versiones anteriores.');
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
    const staging = path.join(config.destination, `.incomplete-${id}`);
    const snapshot = path.join(config.destination, `snapshot-${id}`);
    await mkdir(staging);
    for (const entry of files) {
      const target = path.join(staging, 'files', entry.path);
      if (entry.content) await writeNew(target, entry.content);
      else await copyNew(entry.source, target, entry);
      if (entry.kind === 'data') await validateData(target, entry.path);
    }
    await git(config.projectRoot, ['bundle', 'create', path.join(staging, 'project.bundle'), '--all', 'HEAD']);
    await fs.chmod(path.join(staging, 'project.bundle'), 0o600);
    const bundleHandle = await fs.open(path.join(staging, 'project.bundle'), 'r+');
    try { await bundleHandle.sync(); } finally { await bundleHandle.close(); }
    await git(config.projectRoot, ['bundle', 'verify', path.join(staging, 'project.bundle')]);
    if (signature(await inventory(config), await gitState(config.projectRoot)) !== sourceSignature) {
      fail('Los datos cambiaron durante el respaldo; la copia incompleta queda aparte y se reintentara.');
    }
    const manifest = {
      schemaVersion: 1, createdAt: new Date().toISOString(), sourceSignature,
      source: { projectRoot: config.projectRoot, dataRoot: config.dataRoot, platform: process.platform },
      consistency: 'Archivos estables durante la copia, sin transaccion global entre almacenes.',
      git: state, files: files.map(publicEntry),
      bundle: await hashFile(path.join(staging, 'project.bundle')), exclusions: EXCLUSIONS,
    };
    const bytes = jsonBytes(manifest);
    await writeNew(path.join(staging, 'manifest.json'), bytes);
    await writeNew(path.join(staging, 'manifest.sha256'), `${digest(bytes)}\n`);
    await verifySnapshot(staging);
    await fs.rename(staging, snapshot);
    if (process.platform !== 'win32') {
      const directoryHandle = await fs.open(config.destination, 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    }
    return { snapshot, changed: true, files: files.length };
  } finally { await release(); }
}

export async function restoreSnapshot(snapshot, target) {
  if (!path.isAbsolute(target)) fail('La carpeta de restauracion debe ser absoluta.');
  if (inside(snapshot, target) || inside(target, snapshot)) fail('La restauracion debe estar separada del respaldo.');
  await noLinks(target);
  if (await exists(target)) fail('La restauracion requiere una carpeta nueva que todavia no exista.');
  const manifest = await verifySnapshot(snapshot);
  if (inside(manifest.source.projectRoot, target) || inside(target, manifest.source.projectRoot)
    || inside(manifest.source.dataRoot, target) || inside(target, manifest.source.dataRoot)) fail('La restauracion debe estar separada de las fuentes originales.');
  await mkdir(path.dirname(target));
  // mkdir without recursive is the reservation: an existing destination is never used.
  await fs.mkdir(target, { mode: 0o700 });
  await protectPrivateDirectory(target);
  // A failed restore remains explicitly marked for inspection; no recursive cleanup.
  const marker = path.join(target, '.alice-restore-incomplete');
  await writeNew(marker, 'Restauracion incompleta: no iniciar Alice desde esta carpeta.\n');
  await git(target, ['init', '--quiet']);
  await git(target, ['fetch', '--quiet', '--update-head-ok', path.join(snapshot, 'project.bundle'), '+refs/*:refs/*', 'HEAD']);
  if (manifest.git.branch === 'HEAD') await git(target, ['update-ref', '--no-deref', 'HEAD', manifest.git.head]);
  else {
    await git(target, ['check-ref-format', `refs/heads/${manifest.git.branch}`]);
    await git(target, ['symbolic-ref', 'HEAD', `refs/heads/${manifest.git.branch}`]);
    if ((await git(target, ['rev-parse', 'HEAD'])).trim() !== manifest.git.head) fail('La rama restaurada no corresponde al commit del respaldo.');
  }
  await git(target, ['read-tree', 'HEAD']);
  for (const entry of manifest.files) {
    await copyNew(path.join(snapshot, 'files', entry.path), path.join(target, entry.path), entry,
      entry.kind === 'code' && (entry.mode & 0o111) ? 0o700 : 0o600);
  }
  await git(target, ['fsck', '--full']);
  await git(target, ['remote', 'add', 'backup', path.join(snapshot, 'project.bundle')]);
  await fs.unlink(marker);
  return { target, files: manifest.files.length, head: manifest.git.head };
}
