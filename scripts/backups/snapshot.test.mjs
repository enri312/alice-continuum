import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createSnapshot, listSnapshots, restoreSnapshot, settings, verifySnapshot } from './snapshot.mjs';
import { digest, jsonBytes } from './files.mjs';
import { superviseSession } from './session.mjs';

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec('git', ['-C', cwd, ...args], {
  windowsHide: true, env: { ...process.env, GIT_AUTHOR_NAME: 'Backup fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Backup fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' },
})).stdout.trim();
const write = async (file, text) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); };
const read = (file) => fs.readFile(file, 'utf8');

async function fixture(t) {
  const testRoot = fileURLToPath(new URL('../../local/artifacts/backup-tests/', import.meta.url));
  await fs.mkdir(testRoot, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(testRoot, 'alice-backup-test-'));
  // Only this freshly allocated test directory can be removed; never a user path.
  t.after(async () => {
    const actual = await fs.realpath(temporary);
    const parent = await fs.realpath(testRoot);
    assert.equal(path.dirname(actual), parent);
    assert.match(path.basename(actual), /^alice-backup-test-/);
    await fs.rm(actual, { recursive: true, force: true });
  });
  const projectRoot = path.join(temporary, 'project');
  const destination = path.join(temporary, 'backups');
  await write(path.join(projectRoot, '.gitignore'), 'data/\nlocal/\n.env*\nnode_modules/\n');
  await write(path.join(projectRoot, 'source.txt'), 'committed code\n');
  await write(path.join(projectRoot, 'deleted.txt'), 'delete me after commit\n');
  await git(projectRoot, 'init', '-q');
  await git(projectRoot, 'add', '.');
  await git(projectRoot, 'commit', '-qm', 'Fixture');
  await git(projectRoot, 'branch', 'saved-branch');
  await write(path.join(projectRoot, 'source.txt'), 'uncommitted work\n');
  await fs.unlink(path.join(projectRoot, 'deleted.txt'));
  await write(path.join(projectRoot, 'new.txt'), 'new source\n');
  await write(path.join(projectRoot, 'data/memory/records.json'), '{"records":["private memory"]}\n');
  await write(path.join(projectRoot, 'data/memory/automatic-v1.json'), '{"records":["automatic"]}\n');
  await write(path.join(projectRoot, 'data/memory/self-study-v1.json'), '{"lessons":["study"]}\n');
  await write(path.join(projectRoot, 'data/conversation/history-v1.json'), '{"exchanges":["private dialogue"]}\n');
  await write(path.join(projectRoot, 'data/audit/events.jsonl'), '{"event":"one"}\n{"event":"two"}\n');
  await write(path.join(projectRoot, 'data/obsidian/My note.md'), 'manual Obsidian note\n');
  await write(path.join(projectRoot, 'local/assets/avatar.vrm'), 'synthetic asset\n');
  await write(path.join(projectRoot, 'local/ubuntu.env'), 'PRIVATE_FIXTURE=value\n');
  await write(path.join(projectRoot, '.env'), 'LOCAL_FIXTURE=value\n');
  await write(path.join(projectRoot, 'node_modules/excluded.txt'), 'reinstallable\n');
  const env = { XDG_CONFIG_HOME: path.join(temporary, 'config'), FISH_API_KEY: 'SYNTHETIC_SECRET', UNRELATED_TOKEN: 'MUST_NOT_COPY' };
  await write(path.join(env.XDG_CONFIG_HOME, 'alice-continuum/fish.env'), 'SYNTHETIC_FISH_FILE=1\n');
  return { temporary, projectRoot, destination, env };
}

test('full backup and offline restore preserve code, deletions, Git branches and all private stores', async t => {
  const config = await fixture(t);
  const result = await createSnapshot(config);
  const manifest = await verifySnapshot(result.snapshot);
  assert.equal(result.changed, true);
  if (process.platform === 'win32') {
    const acl = JSON.parse((await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$acl = ([IO.DirectoryInfo]::new($env:ALICE_TEST_BACKUP)).GetAccessControl(); @{ protected = $acl.AreAccessRulesProtected; rules = @($acl.Access | ForEach-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value }) } | ConvertTo-Json -Compress'],
    { windowsHide: true, env: { ...process.env, ALICE_TEST_BACKUP: config.destination } })).stdout);
    assert.equal(acl.protected, true);
    assert.equal(acl.rules.length, 3);
    assert.ok(!acl.rules.includes('S-1-1-0'));
  } else assert.equal((await fs.stat(config.destination)).mode & 0o777, 0o700);
  assert.ok(manifest.files.some(entry => entry.path.endsWith('self-study-v1.json')));
  assert.ok(!manifest.files.some(entry => entry.path.includes('node_modules')));
  const target = path.join(config.temporary, 'recovered');
  await restoreSnapshot(result.snapshot, target);
  for (const entry of manifest.files) {
    assert.equal(digest(await fs.readFile(path.join(target, entry.path))), entry.sha256);
  }
  assert.equal(await read(path.join(target, 'source.txt')), 'uncommitted work\n');
  await assert.rejects(fs.stat(path.join(target, 'deleted.txt')), { code: 'ENOENT' });
  assert.equal(await git(target, 'rev-parse', 'HEAD'), manifest.git.head);
  assert.equal(await git(target, 'rev-parse', 'saved-branch'), manifest.git.head);
  assert.equal(await git(target, 'diff', '--name-only', '--diff-filter=D'), 'deleted.txt');
  const credentials = await read(path.join(target, 'local/recovered-settings/environment.json'));
  assert.match(credentials, /SYNTHETIC_SECRET/);
  assert.ok(!credentials.includes('MUST_NOT_COPY'));
  // The original private file was only read.
  assert.equal(await read(path.join(config.projectRoot, 'data/memory/records.json')), '{"records":["private memory"]}\n');
});

test('unchanged runs reuse a verified version, changed runs retain both versions', async t => {
  const config = await fixture(t);
  const first = await createSnapshot(config);
  const again = await createSnapshot(config);
  assert.equal(again.changed, false);
  assert.equal(again.snapshot, first.snapshot);
  await write(path.join(config.projectRoot, 'data/obsidian/My note.md'), 'updated note\n');
  const second = await createSnapshot(config);
  assert.notEqual(second.snapshot, first.snapshot);
  assert.equal((await listSnapshots(config.destination)).length, 2);
  await verifySnapshot(first.snapshot);
});

test('a corrupt newest snapshot is rejected for restore but does not prevent making a fresh backup', async t => {
  const config = await fixture(t);
  const first = await createSnapshot(config);
  await fs.appendFile(path.join(first.snapshot, 'files/data/memory/records.json'), 'damage');
  await assert.rejects(verifySnapshot(first.snapshot), /SHA-256/);
  const target = path.join(config.temporary, 'recovery');
  await assert.rejects(restoreSnapshot(first.snapshot, target), /SHA-256/);
  await assert.rejects(fs.stat(target), { code: 'ENOENT' });
  const messages = [];
  const repaired = await createSnapshot({ ...config, onWarning: message => messages.push(message) });
  assert.notEqual(repaired.snapshot, first.snapshot);
  assert.equal(messages.length, 1);
  assert.equal((await listSnapshots(config.destination)).length, 2);
});

test('missing files, extra files, broken manifests and broken bundles fail verification', async t => {
  const config = await fixture(t);
  const { snapshot } = await createSnapshot(config);
  const original = await fs.readFile(path.join(snapshot, 'files/new.txt'));
  await fs.unlink(path.join(snapshot, 'files/new.txt'));
  await assert.rejects(verifySnapshot(snapshot));
  await write(path.join(snapshot, 'files/new.txt'), original);
  await write(path.join(snapshot, 'unexpected.txt'), 'extra');
  await assert.rejects(verifySnapshot(snapshot), /no declarados/);
  await fs.unlink(path.join(snapshot, 'unexpected.txt'));
  const manifest = await fs.readFile(path.join(snapshot, 'manifest.json'));
  await fs.appendFile(path.join(snapshot, 'manifest.json'), ' ');
  await assert.rejects(verifySnapshot(snapshot), /manifiesto/);
  await fs.writeFile(path.join(snapshot, 'manifest.json'), manifest);
  await fs.appendFile(path.join(snapshot, 'project.bundle'), 'damage');
  await assert.rejects(verifySnapshot(snapshot), /Git.*SHA-256/);
});

test('existing restore targets and source-contained destinations are refused without changing source data', async t => {
  const config = await fixture(t);
  const { snapshot } = await createSnapshot(config);
  await assert.rejects(restoreSnapshot(snapshot, config.projectRoot), /carpeta nueva/);
  await assert.rejects(restoreSnapshot(snapshot, path.join(config.projectRoot, 'restored')), /fuentes originales/);
  await assert.rejects(createSnapshot({ ...config, destination: path.join(config.projectRoot, 'backups') }), /separado/);
  await assert.rejects(createSnapshot({ ...config, destination: config.temporary }), /separado/);
  await assert.rejects(createSnapshot({ ...config, projectRoot: path.join(config.projectRoot, 'data') }), /raiz completa/);
  assert.equal(await read(path.join(config.projectRoot, 'source.txt')), 'uncommitted work\n');
});

test('source junctions and destination junctions are rejected', async t => {
  const config = await fixture(t);
  const external = path.join(config.temporary, 'external');
  await fs.mkdir(external);
  await fs.symlink(external, path.join(config.projectRoot, 'data/linked'), 'junction');
  await assert.rejects(createSnapshot(config), /enlace/);
  await fs.symlink(external, path.join(config.temporary, 'linked-destination'), 'junction');
  await assert.rejects(createSnapshot({ ...config, destination: path.join(config.temporary, 'linked-destination/backups') }), /enlaces/);
});

test('a rewritten manifest cannot traverse directories or modify Git metadata', async t => {
  const config = await fixture(t);
  const { snapshot } = await createSnapshot(config);
  const original = await verifySnapshot(snapshot);
  for (const unsafe of ['../escape', '/absolute', 'local\\escape', '.git/config', '.GIT/config', '.git~1/config', 'data/name:stream', 'data/CON', 'data/trailing.']) {
    const manifest = structuredClone(original);
    manifest.files[0].path = unsafe;
    const bytes = jsonBytes(manifest);
    await fs.writeFile(path.join(snapshot, 'manifest.json'), bytes);
    await fs.writeFile(path.join(snapshot, 'manifest.sha256'), digest(bytes));
    await assert.rejects(verifySnapshot(snapshot), /Ruta/);
  }
});

test('invalid source JSON prevents publication while keeping the earlier complete version', async t => {
  const config = await fixture(t);
  const earlier = await createSnapshot(config);
  await write(path.join(config.projectRoot, 'data/memory/records.json'), '{truncated');
  await assert.rejects(createSnapshot(config), /JSON/);
  assert.deepEqual(await listSnapshots(config.destination), [earlier.snapshot]);
  await verifySnapshot(earlier.snapshot);
});

test('a write during copying is detected and an interrupted copy is never published', async t => {
  const config = await fixture(t);
  const originalCopy = fs.copyFile;
  let changed = false;
  t.mock.method(fs, 'copyFile', async (...args) => {
    const result = await originalCopy(...args);
    if (!changed && args[0].endsWith('source.txt')) {
      changed = true;
      await write(args[0], 'changed during backup\n');
    }
    return result;
  });
  await assert.rejects(createSnapshot(config), /cambiaron/);
  assert.deepEqual(await listSnapshots(config.destination), []);
  assert.ok((await fs.readdir(config.destination)).some(name => name.startsWith('.incomplete-')));
});

test('low disk space refuses publication without deleting any previous snapshot', async t => {
  const config = await fixture(t);
  const earlier = await createSnapshot(config);
  await write(path.join(config.projectRoot, 'source.txt'), 'updated\n');
  t.mock.method(fs, 'statfs', async () => ({ bavail: 1, bsize: 4096 }));
  await assert.rejects(createSnapshot(config), /espacio/);
  assert.deepEqual(await listSnapshots(config.destination), [earlier.snapshot]);
});

test('a live lock prevents concurrent writers and is not removed by the rejected process', async t => {
  const config = await fixture(t);
  const lock = path.join(config.destination, '.backup.lock');
  const bytes = jsonBytes({ host: os.hostname(), pid: process.pid, token: 'fixture' });
  await write(lock, bytes);
  await assert.rejects(createSnapshot(config), /en curso/);
  assert.deepEqual(await fs.readFile(lock), bytes);
});

test('a dead same-host lock is recovered; an unknown-host lock is left alone', async t => {
  const config = await fixture(t);
  // Obtain a real PID known to have exited rather than guessing a system PID.
  const child = execFile(process.execPath, ['-e', '']);
  const deadPid = child.pid;
  await new Promise(resolve => child.once('close', resolve));
  const lock = path.join(config.destination, '.backup.lock');
  await write(lock, jsonBytes({ host: os.hostname(), pid: deadPid, token: 'dead' }));
  await createSnapshot(config);
  await write(lock, jsonBytes({ host: 'another-computer', pid: deadPid, token: 'foreign' }));
  await assert.rejects(createSnapshot(config), /otro equipo/);
});

test('external ALICE_DATA_DIR is fully recovered into the new project, never overwritten in place', async t => {
  const config = await fixture(t);
  const dataRoot = path.join(config.temporary, 'external-data');
  await write(path.join(dataRoot, 'memory/records.json'), '{"external":true}');
  const { snapshot } = await createSnapshot({ ...config, dataRoot });
  const target = path.join(config.temporary, 'recovery');
  await restoreSnapshot(snapshot, target);
  assert.equal(await read(path.join(target, 'data/memory/records.json')), '{"external":true}');
  await assert.rejects(restoreSnapshot(snapshot, path.join(dataRoot, 'child')), /fuentes originales/);
});

test('backup after restore preserves recovery credentials not yet applied to the environment', async t => {
  const config = await fixture(t);
  const { snapshot } = await createSnapshot(config);
  const target = path.join(config.temporary, 'recovered');
  await restoreSnapshot(snapshot, target);
  const next = await createSnapshot({ ...config, projectRoot: target, env: { XDG_CONFIG_HOME: config.env.XDG_CONFIG_HOME } });
  assert.match(await read(path.join(next.snapshot, 'files/local/recovered-settings/environment.json')), /SYNTHETIC_SECRET/);
});

test('configuration resolves per-platform paths and rejects an invalid interval', async t => {
  const config = await fixture(t);
  const defaults = await settings({ projectRoot: config.projectRoot, env: config.env });
  assert.equal(defaults.destination, path.join(config.temporary, 'Alice Backups/project'));
  await write(path.join(config.projectRoot, 'local/backup.json'), JSON.stringify({ schemaVersion: 1, intervalMinutes: 10, destinations: { [process.platform]: config.destination } }));
  const resolved = await settings({ projectRoot: config.projectRoot, env: config.env });
  assert.equal(resolved.destination, config.destination);
  assert.equal(resolved.intervalMinutes, 10);
  await assert.rejects(settings({ ...config, intervalMinutes: 0 }), /intervalo/);
});

test('detached HEAD is restored together with branch history', async t => {
  const config = await fixture(t);
  await git(config.projectRoot, 'checkout', '--detach');
  await git(config.projectRoot, 'add', 'source.txt');
  await git(config.projectRoot, 'commit', '-qm', 'Detached work');
  const { snapshot } = await createSnapshot(config);
  const target = path.join(config.temporary, 'recovered');
  const restored = await restoreSnapshot(snapshot, target);
  assert.equal(await git(target, 'rev-parse', 'HEAD'), restored.head);
  assert.equal(await git(target, 'rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD');
  assert.notEqual(await git(target, 'rev-parse', 'saved-branch'), restored.head);
});

test('interrupted restore leaves a marked new directory and never changes the backup or original', async t => {
  const config = await fixture(t);
  const { snapshot } = await createSnapshot(config);
  const originalCopy = fs.copyFile;
  t.mock.method(fs, 'copyFile', async (...args) => {
    if (args[0].endsWith('source.txt')) throw new Error('synthetic write failure');
    return originalCopy(...args);
  });
  const target = path.join(config.temporary, 'recovered');
  await assert.rejects(restoreSnapshot(snapshot, target), /synthetic/);
  assert.match(await read(path.join(target, '.alice-restore-incomplete')), /incompleta/);
  await verifySnapshot(snapshot);
  assert.equal(await read(path.join(config.projectRoot, 'source.txt')), 'uncommitted work\n');
});

test('session backs up before launch and after close, without overlapping periodic copies', async t => {
  const events = [];
  let concurrent = 0;
  let maximum = 0;
  let finish;
  let periodicFinished;
  const observed = new Promise(resolve => { periodicFinished = resolve; });
  const session = superviseSession({
    intervalMs: 5, log: () => {},
    backup: async () => {
      maximum = Math.max(maximum, ++concurrent);
      events.push('backup');
      await new Promise(resolve => setTimeout(resolve, 20));
      concurrent--;
      if (events.includes('launch')) periodicFinished();
      return { changed: true, snapshot: 'fixture' };
    },
    launch: () => { events.push('launch'); return new Promise(resolve => { finish = resolve; }); },
  });
  await observed;
  events.push('exit');
  finish(7);
  assert.equal(await session, 7);
  assert.equal(maximum, 1);
  assert.deepEqual(events.slice(0, 2), ['backup', 'launch']);
  assert.equal(events.at(-1), 'backup');
});

test('backup failure is reported but does not prevent the assistant from launching or retrying at close', async () => {
  let calls = 0;
  let launched = false;
  const messages = [];
  await superviseSession({
    intervalMs: 1000, log: message => messages.push(message),
    backup: async () => { calls++; throw new Error('synthetic disk error'); },
    launch: async () => { launched = true; return 0; },
  });
  assert.equal(launched, true);
  assert.equal(calls, 2);
  assert.equal(messages.filter(message => message.includes('ERROR')).length, 2);
});

test('CLI supervises a synthetic child process and refuses an incomplete restore before launch', async t => {
  const config = await fixture(t);
  const fakeTauri = path.join(config.projectRoot, 'node_modules/@tauri-apps/cli/tauri.js');
  await write(fakeTauri, 'require("node:fs").writeFileSync("data/child.json", JSON.stringify({closed:true}));');
  const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
  const args = [cli, 'run', '--project-root', config.projectRoot, '--data-root', path.join(config.projectRoot, 'data'), '--destination', config.destination];
  const env = { ...process.env, ...config.env,
    GIT_DIR: path.join(config.temporary, 'incorrect-git-dir'), GIT_WORK_TREE: config.temporary };
  for (const key of Object.keys(env)) {
    if ((key.endsWith('_API_KEY') || key.startsWith('ALICE_')) && !Object.hasOwn(config.env, key)) delete env[key];
  }
  const result = await exec(process.execPath, args, { windowsHide: true, env });
  assert.match(result.stdout, /Respaldo: inicio/);
  assert.match(result.stdout, /Respaldo: cierre/);
  const versions = await listSnapshots(config.destination);
  assert.equal(versions.length, 2);
  const latest = await verifySnapshot(versions[0]);
  assert.ok(latest.files.some(entry => entry.path === 'data/child.json'));
  const target = path.join(config.temporary, 'cli-recovery');
  await exec(process.execPath, [cli, 'restore', '--snapshot', versions[0], '--target', target], { windowsHide: true, env });
  assert.equal(await git(target, 'rev-parse', 'HEAD'), latest.git.head);
  await fs.unlink(path.join(config.projectRoot, 'data/child.json'));
  await write(path.join(config.projectRoot, '.alice-restore-incomplete'), 'fixture');
  await assert.rejects(exec(process.execPath, args, { windowsHide: true, env }), error => error.stderr.includes('restauracion incompleta'));
  await assert.rejects(fs.stat(path.join(config.projectRoot, 'data/child.json')), { code: 'ENOENT' });
});
