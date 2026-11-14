import { createHash } from 'node:crypto';
import { promises as fs, constants } from 'node:fs';
import path from 'node:path';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
export function fail(message) { throw new Error(message); }

export async function exists(file) {
  try { await fs.lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// Check ancestors too: a Windows junction must not turn a private copy into a
// write elsewhere. This is a local recovery tool, not a hostile-user sandbox.
export async function noLinks(file) {
  const absolute = path.resolve(file);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) fail('No se admiten enlaces simbolicos ni junctions en las rutas del respaldo.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function relativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 2000) fail('Ruta de respaldo invalida.');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.toLowerCase() === '.git' || /^\.?git~\d+$/i.test(part)
    || /[<>:"\\|?*\u0000-\u001f]/.test(part) || /[. ]$/.test(part)
    || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) {
    fail('Ruta de respaldo insegura o no portable.');
  }
  return value;
}

export function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function mkdir(directory) {
  await noLinks(directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await noLinks(directory);
}

export async function writeNew(file, bytes, mode = 0o600) {
  await mkdir(path.dirname(file));
  const handle = await fs.open(file, 'wx', mode);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
}

export async function hashFile(file) {
  await noLinks(file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile()) fail('El respaldo solo admite archivos normales.');
    const hash = createHash('sha256');
    for await (const bytes of handle.createReadStream({ autoClose: false })) hash.update(bytes);
    const after = await handle.stat();
    const current = await fs.lstat(file);
    if (current.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs || current.ino !== after.ino || current.dev !== after.dev) {
      fail('Un archivo cambio durante la lectura; se conserva el respaldo anterior.');
    }
    return { sha256: hash.digest('hex'), size: after.size, mode: after.mode & 0o777 };
  } finally { await handle.close(); }
}

export async function copyNew(source, target, expected, mode = 0o600) {
  await noLinks(source);
  await mkdir(path.dirname(target));
  await fs.copyFile(source, target, constants.COPYFILE_EXCL);
  await fs.chmod(target, mode);
  const handle = await fs.open(target, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
  const actual = await hashFile(target);
  if (actual.sha256 !== expected.sha256 || actual.size !== expected.size) {
    fail('La copia no coincide con la fuente; no se publica como respaldo valido.');
  }
}

export async function walk(directory, prefix = '', skip = () => false) {
  await noLinks(directory);
  const result = [];
  if (!await exists(directory)) return result;
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (skip(entry.name, entry.isDirectory())) continue;
    const relative = relativePath(`${prefix}${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail('Hay un enlace en los archivos que se deben respaldar.');
    if (entry.isDirectory()) result.push(...await walk(file, `${relative}/`, skip));
    else if (entry.isFile()) result.push(relative);
    else fail('Hay un archivo especial que no puede respaldarse de forma portable.');
  }
  return result;
}

export async function validateData(file, relative) {
  if (!/\.jsonl?$/i.test(relative)) return;
  const content = await fs.readFile(file, 'utf8');
  try {
    if (relative.endsWith('.jsonl')) {
      for (const line of content.split(/\r?\n/)) if (line.trim()) JSON.parse(line);
    } else JSON.parse(content);
  } catch { fail('Hay JSON o JSONL invalido en los datos; se conserva el ultimo respaldo valido.'); }
}
