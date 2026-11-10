import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startObsidianSync, syncObsidianVault } from './sync.mjs';

const stamp = '2026-11-10T12:00:00.000Z';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const managedName = 'Alice (sincronizado)';

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function json(file, value) {
  await write(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function snapshot(root) {
  const result = {};
  async function visit(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) result[relative] = `link:${await fs.readlink(absolute)}`;
      else if (entry.isDirectory()) await visit(absolute);
      else result[relative] = hash(await fs.readFile(absolute));
    }
  }
  await visit(root);
  return result;
}

async function notes(root) {
  const result = new Map();
  async function visit(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.md')) result.set(absolute, await fs.readFile(absolute, 'utf8'));
    }
  }
  await visit(root);
  return result;
}

function containing(noteMap, text) {
  return [...noteMap].filter(([, content]) => content.includes(text));
}

function confirmed(id = 'confirmed-1', summary = 'CONFIRMED_SYNTHETIC_MARKER') {
  return {
    id, kind: 'Enseñanza', intention: 'Preferencia sintética', startedAt: stamp,
    finishedAt: null, summary, nextStep: null, memoryType: 'preference',
    source: 'Prueba sintética del propietario', importance: 3, storageStrength: 0.5,
    memoryStatus: 'confirmed', successfulRecalls: 0, failedRecalls: 0,
    successfulReviews: 0, correctionCount: 0, contextEvents: [],
  };
}

function automatic(id = 'automatic-1') {
  return {
    id, evidence: 'Cita sintética de entrada', content: 'AUTOMATIC_SYNTHETIC_MARKER',
    memoryType: 'preference', importance: 3, reason: 'Preferencia de prueba',
    sourceExchangeId: 'exchange-synthetic', sourceSha256: `sha256:${'a'.repeat(64)}`,
    createdAt: stamp, updatedAt: stamp, active: true, ownerCorrected: false, revisions: [],
  };
}

function study(lessonId = 'arithmetic-fractions') {
  return {
    id: `study:${lessonId}`, lessonId, domain: 'mathematics', track: 'arithmetic', title: 'Fracciones sintéticas',
    content: 'STUDY_SYNTHETIC_MARKER', sourceUrl: 'https://example.org/mathematics/fractions', sourceTitle: 'Fuente sintética',
    lessonSha256: `sha256:${'b'.repeat(64)}`, studiedAt: stamp, attempts: 1, passes: 1, lastPassed: true, active: true,
  };
}

function studyDocument(records) {
  return { schemaVersion: 1, enabled: true, biblicalTradition: 'catholic', phase: 'partial', lastStartedAt: stamp, lastCompletedAt: null, lastError: null, records };
}

test('projects separately sourced self-study, failed exercises and curriculum progress without changing source stores', async (t) => {
  const f = await fixture(t);
  const learned = study();
  const failed = { ...study('arithmetic-ratios'), content: 'FAILED_STUDY_MARKER', attempts: 2, lastPassed: false, active: false };
  await json(path.join(f.memoryRoot, 'self-study-v1.json'), studyDocument([learned, failed]));
  const before = await snapshot(f.memoryRoot);
  const result = await syncObsidianVault(f);
  assert.equal(result.studyCount, 2);
  const exported = await notes(f.managed);
  const learnedNote = containing(exported, 'STUDY_SYNTHETIC_MARKER')[0];
  assert.ok(learnedNote[0].includes(`${path.sep}Autoestudio${path.sep}`));
  assert.match(learnedNote[1], /activa; ultimo ejercicio aprobado/);
  assert.ok(learnedNote[1].includes(learned.sourceUrl));
  assert.ok(learnedNote[1].includes(learned.lessonSha256));
  const failedNote = containing(exported, 'FAILED_STUDY_MARKER')[0][1];
  assert.match(failedNote, /fuera del contexto/);
  assert.match(failedNote, /"lastPassed": false/);
  const progress = [...exported].find(([file]) => file.endsWith(`${path.sep}Progreso del curriculo.md`))[1];
  assert.match(progress, /Tradicion biblica: catolica/);
  assert.match(progress, /\| Aritmética \| 2 \| 1 \| 3 \| 2 \|/);
  assert.deepEqual(await snapshot(f.memoryRoot), before);
});

test('rejects forbidden self-study subjects, forged counters and unknown fields before changing output', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const before = await snapshot(f.vault);
  for (const invalid of [
    { ...study(), domain: 'medicine' }, { ...study(), track: 'programming' },
    { ...study(), track: 'humility', domain: 'mathematics' }, { ...study(), passes: 2 },
    { ...study(), passes: 0 }, { ...study(), ownerReviewed: true }, { ...study(), sourceUrl: 'javascript:alert(1)' },
  ]) {
    await json(path.join(f.memoryRoot, 'self-study-v1.json'), studyDocument([invalid]));
    await assert.rejects(syncObsidianVault(f));
    assert.deepEqual(await snapshot(f.vault), before);
  }
  await json(path.join(f.memoryRoot, 'self-study-v1.json'), { ...studyDocument([]), autoExecute: true });
  await assert.rejects(syncObsidianVault(f));
  assert.deepEqual(await snapshot(f.vault), before);
});

async function fixture(t, { empty = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alice-obsidian-test-'));
  t.after(async () => {
    const resolved = await fs.realpath(root);
    assert.equal(path.dirname(resolved).toLowerCase(), (await fs.realpath(os.tmpdir())).toLowerCase());
    assert.ok(path.basename(resolved).startsWith('alice-obsidian-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const projectRoot = path.join(root, 'project');
  const dataRoot = path.join(root, 'private-data');
  const memoryRoot = path.join(dataRoot, 'memory');
  const codeRoot = path.join(projectRoot, 'src', 'core', 'memory');
  const vault = path.join(dataRoot, 'obsidian');
  const managed = path.join(vault, managedName);
  await write(path.join(codeRoot, 'cognitive-memory.ts'), 'export const memoryStatus = "synthetic";\n');
  await write(path.join(codeRoot, 'automatic-memory.ts'), 'import { memoryStatus } from "./cognitive-memory";\nexport const automaticStatus = memoryStatus;\n');
  await write(path.join(codeRoot, 'automatic-memory.test.ts'), 'throw new Error("Do not execute source code while documenting it");\n');
  await fs.mkdir(dataRoot, { recursive: true });
  if (!empty) {
    await json(path.join(memoryRoot, 'records.json'), [confirmed()]);
    await json(path.join(memoryRoot, 'automatic-v1.json'), { schemaVersion: 1, enabled: true, records: [automatic()], decisions: [] });
    const source = '# Fuente sintética\n\nLEGACY_SYNTHETIC_MARKER\n';
    await write(path.join(memoryRoot, 'notes', 'Fuente de perfil.md'), source);
    await write(path.join(memoryRoot, 'notes', '.obsidian', 'workspace.json'), '{"privateEditorState":true}');
    await json(path.join(memoryRoot, 'owner-profile.json'), {
      schemaVersion: 1, ownerName: 'Propietario de prueba', confirmedBy: 'Propietario de prueba', confirmedAt: stamp,
      sourceFiles: [{ file: 'notes/Fuente de perfil.md', sha256: `sha256:${hash(source)}` }],
      records: [{ id: 'profile-1', kind: 'Perfil', intention: 'Tema sintético de perfil', summary: 'PROFILE_SYNTHETIC_MARKER', source: 'Fuente de perfil.md', memoryStatus: 'confirmed' }],
    });
  }
  return { root, projectRoot, dataRoot, memoryRoot, codeRoot, vault, managed };
}

test('exports the memory stores and existing Markdown without reading project code', async (t) => {
  const f = await fixture(t);
  const beforeMemory = await snapshot(f.memoryRoot);
  const beforeCode = await snapshot(f.codeRoot);
  const result = await syncObsidianVault(f);
  assert.equal(result.vaultPath, f.vault);
  assert.equal(result.confirmedCount, 1);
  assert.equal(result.automaticCount, 1);
  assert.equal(result.profileCount, 1);
  assert.equal(result.legacyNoteCount, 1);
  assert.equal(result.memoryPath, f.memoryRoot);
  const exported = await notes(f.managed);
  for (const marker of ['CONFIRMED_SYNTHETIC_MARKER', 'AUTOMATIC_SYNTHETIC_MARKER', 'PROFILE_SYNTHETIC_MARKER', 'LEGACY_SYNTHETIC_MARKER']) {
    assert.ok(containing(exported, marker).length, `Missing ${marker}`);
  }
  assert.ok(![...exported.keys()].some(file => file.includes('Codigo de memoria')), 'Source modules are not projected as memories');
  const storageMap = [...exported].find(([file]) => file.endsWith(`${path.sep}Mapa de la memoria.md`));
  assert.ok(storageMap && storageMap[1].includes(f.memoryRoot), 'The actual memory directory is visible');
  assert.ok(![...exported.keys()].some((file) => file.includes(`${path.sep}.obsidian${path.sep}`)), 'Editor state is not copied as knowledge');
  assert.deepEqual(await snapshot(f.memoryRoot), beforeMemory);
  assert.deepEqual(await snapshot(f.codeRoot), beforeCode);
  const stable = await snapshot(f.managed);
  const again = await syncObsidianVault(f);
  assert.equal(again.changed, false);
  assert.deepEqual(await snapshot(f.managed), stable);
});

test('reflects correction, withdrawal and owner-visible lifecycle states; removes deleted projections', async (t) => {
  const f = await fixture(t);
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed(), confirmed('obsolete-2', 'STALE_MEMORY_MARKER')]);
  await syncObsidianVault(f);
  const stale = containing(await notes(f.managed), 'STALE_MEMORY_MARKER').map(([file]) => file);
  assert.equal(stale.length, 1);
  const changed = {
    ...confirmed(), summary: 'CORRECTED_CONFIRMED_MARKER', memoryStatus: 'conflict',
    accessibilityStatus: 'dormant', accessibilityUpdatedAt: stamp,
    suppressionStatus: 'suppressed', suppressionReason: 'ownerChoice', suppressionUpdatedAt: stamp,
    archiveStatus: 'archived', archiveReason: 'ownerChoice', archiveUpdatedAt: stamp,
  };
  await json(path.join(f.memoryRoot, 'records.json'), [changed]);
  await json(path.join(f.memoryRoot, 'automatic-v1.json'), {
    schemaVersion: 1, enabled: false, decisions: [],
    records: [{ ...automatic(), content: 'CORRECTED_AUTOMATIC_MARKER', active: false, ownerCorrected: true }],
  });
  await syncObsidianVault(f);
  const exported = await notes(f.managed);
  assert.equal(containing(exported, 'STALE_MEMORY_MARKER').length, 0);
  for (const file of stale) await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  const record = containing(exported, 'CORRECTED_CONFIRMED_MARKER')[0]?.[1];
  assert.ok(record);
  for (const state of ['conflict', 'dormant', 'suppressed', 'archived']) assert.ok(record.includes(state), `Missing lifecycle label ${state}`);
  const auto = containing(exported, 'CORRECTED_AUTOMATIC_MARKER')[0]?.[1];
  assert.ok(auto);
  assert.match(auto, /"active"\s*:\s*false/);
  assert.match(auto, /"ownerCorrected"\s*:\s*true/);
});

test('preserves manual notes and Obsidian configuration outside its managed directory', async (t) => {
  const f = await fixture(t);
  const manual = path.join(f.vault, 'Memoria', 'Nota personal.md');
  const settings = path.join(f.vault, '.obsidian', 'app.json');
  await write(manual, '# Nota personal\n\nPERSONAL_CONTENT_MARKER\n');
  await write(settings, '{"alwaysUpdateLinks":true}\n');
  const before = [await fs.readFile(manual, 'utf8'), await fs.readFile(settings, 'utf8')];
  await syncObsidianVault(f);
  await json(path.join(f.memoryRoot, 'records.json'), []);
  await syncObsidianVault(f);
  assert.equal(await fs.readFile(manual, 'utf8'), before[0]);
  assert.equal(await fs.readFile(settings, 'utf8'), before[1]);
});

test('detects edits to generated notes and preserves all output before a conflicting update', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const ownNote = containing(await notes(f.managed), 'CONFIRMED_SYNTHETIC_MARKER')[0][0];
  await fs.appendFile(ownNote, '\nMANUAL_EDIT_TO_KEEP\n');
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed('confirmed-1', 'UPSTREAM_CHANGE_MARKER')]);
  const before = await snapshot(f.vault);
  await assert.rejects(syncObsidianVault(f));
  assert.deepEqual(await snapshot(f.vault), before, 'A conflict must not cause partial output or erase the edit');
});

test('detects an edited generated note even when its canonical record has been deleted', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const ownNote = containing(await notes(f.managed), 'CONFIRMED_SYNTHETIC_MARKER')[0][0];
  await fs.appendFile(ownNote, '\nEDIT_BEFORE_DELETION_MARKER\n');
  await json(path.join(f.memoryRoot, 'records.json'), []);
  const before = await snapshot(f.vault);
  await assert.rejects(syncObsidianVault(f));
  assert.deepEqual(await snapshot(f.vault), before);
});

test('hostile IDs and titles remain data and cannot escape the managed directory', async (t) => {
  const f = await fixture(t);
  await json(path.join(f.memoryRoot, 'records.json'), [
    { ...confirmed('../../escape'), intention: '../outside/[[Injected]]: unsafe\\name', summary: 'HOSTILE_ID_MARKER_ONE' },
    { ...confirmed('..\\..\\escape'), intention: 'CON/NUL:*?<>|', summary: 'HOSTILE_ID_MARKER_TWO' },
  ]);
  const sourceBefore = await snapshot(f.memoryRoot);
  await syncObsidianVault(f);
  const exported = await notes(f.managed);
  for (const marker of ['HOSTILE_ID_MARKER_ONE', 'HOSTILE_ID_MARKER_TWO']) {
    const matches = containing(exported, marker);
    assert.equal(matches.length, 1);
    const relative = path.relative(f.managed, matches[0][0]);
    assert.ok(relative && !path.isAbsolute(relative) && !relative.startsWith(`..${path.sep}`));
    assert.match(path.basename(matches[0][0]), /^[a-f0-9]{64}\.md$/);
  }
  assert.deepEqual(await snapshot(f.memoryRoot), sourceBefore);
  assert.deepEqual((await fs.readdir(f.dataRoot)).sort(), ['memory', 'obsidian']);
});

test('invalid input fails before modifying any existing output', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const before = await snapshot(f.vault);
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed('confirmed-1', 'MUST_NOT_EXPORT_PARTIALLY')]);
  await write(path.join(f.memoryRoot, 'automatic-v1.json'), '{broken JSON with PRIVATE_ERROR_MARKER');
  await assert.rejects(syncObsidianVault(f), (error) => {
    assert.ok(!String(error).includes('PRIVATE_ERROR_MARKER'), 'Errors must not expose raw private input');
    return true;
  });
  assert.deepEqual(await snapshot(f.vault), before);
});

test('missing stores produce a storage map and zero fabricated memories', async (t) => {
  const f = await fixture(t, { empty: true });
  const result = await syncObsidianVault(f);
  assert.equal(result.confirmedCount, 0);
  assert.equal(result.automaticCount, 0);
  assert.equal(result.profileCount, 0);
  assert.equal(result.legacyNoteCount, 0);
  assert.equal(result.memoryPath, f.memoryRoot);
  assert.equal((await notes(f.managed)).size, 2);
  assert.deepEqual(await snapshot(f.memoryRoot), {}, 'Exporting must not fabricate canonical stores');
});

test('memory projection is independent of unreadable TypeScript and legacy sessions are not duplicated', async (t) => {
  const f = await fixture(t, { empty: true });
  await write(path.join(f.codeRoot, 'unreadable.ts'), Buffer.from([0xff, 0xfe, 0xff]));
  await json(path.join(f.memoryRoot, 'sessions.json'), [{ summary: 'LEGACY_NOT_CANONICAL' }]);
  const sourceBefore = await snapshot(f.memoryRoot);
  const codeBefore = await snapshot(f.codeRoot);
  const result = await syncObsidianVault(f);
  assert.equal(result.confirmedCount, 0);
  const exported = await notes(f.managed);
  assert.equal(containing(exported, 'LEGACY_NOT_CANONICAL').length, 0);
  const storageMap = [...exported].find(([file]) => file.endsWith(`${path.sep}Mapa de la memoria.md`))[1];
  assert.match(storageMap, /Existe sessions.json.*todavia falta records.json/);
  assert.deepEqual(await snapshot(f.memoryRoot), sourceBefore);
  assert.deepEqual(await snapshot(f.codeRoot), codeBefore);
});

test('correcting an existing vault retires only its unchanged generated code notes', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const oldNotes = { 'Codigo de memoria/automatic-memory.md': '# Old code map\n', 'Mapa del codigo de memoria.md': '# Old index\n' };
  const manifestPath = path.join(f.managed, '.alice-obsidian-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const [relative, content] of Object.entries(oldNotes)) {
    await write(path.join(f.managed, relative), content);
    manifest.files[relative] = hash(content);
  }
  await json(manifestPath, manifest);
  const manual = path.join(f.vault, 'Memoria', 'Nota personal.md');
  await write(manual, '# Conservar esta nota manual\n');
  const sourceBefore = await snapshot(f.memoryRoot);
  await syncObsidianVault(f);
  for (const relative of Object.keys(oldNotes)) await assert.rejects(fs.stat(path.join(f.managed, relative)), { code: 'ENOENT' });
  assert.equal(await fs.readFile(manual, 'utf8'), '# Conservar esta nota manual\n');
  assert.deepEqual(await snapshot(f.memoryRoot), sourceBefore);
  assert.ok((await fs.readFile(path.join(f.managed, 'Mapa de la memoria.md'), 'utf8')).includes(f.memoryRoot));
});

test('rejects a vault symlink or junction without writing through it', async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, 'outside');
  await write(path.join(outside, 'sentinel.txt'), 'OUTSIDE_UNCHANGED');
  try { await fs.symlink(outside, f.vault, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip(`Link creation unavailable: ${error.code}`); throw error; }
  const before = await snapshot(outside);
  await assert.rejects(syncObsidianVault(f));
  assert.deepEqual(await snapshot(outside), before);
});

test('rejects a generated subdirectory replaced with a symlink or junction', async (t) => {
  const f = await fixture(t);
  await syncObsidianVault(f);
  const generatedNote = containing(await notes(f.managed), 'CONFIRMED_SYNTHETIC_MARKER')[0][0];
  const parent = path.dirname(generatedNote);
  assert.equal(path.dirname(parent), f.managed);
  const outside = path.join(f.root, 'outside');
  await fs.rename(parent, outside);
  try { await fs.symlink(outside, parent, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip(`Link creation unavailable: ${error.code}`); throw error; }
  const outsideBefore = await snapshot(outside);
  const vaultBefore = await snapshot(f.vault);
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed('confirmed-1', 'DO_NOT_WRITE_THROUGH_LINK')]);
  await assert.rejects(syncObsidianVault(f));
  assert.deepEqual(await snapshot(outside), outsideBefore);
  assert.deepEqual(await snapshot(f.vault), vaultBefore);
});

test('background synchronization refreshes saved changes and stops completely on close', { timeout: 10000 }, async (t) => {
  const f = await fixture(t);
  const watcher = startObsidianSync(f);
  t.after(() => watcher.close());
  async function waitFor(marker) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (containing(await notes(f.managed), marker).length) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Background synchronization did not refresh the projection.');
  }
  await waitFor('CONFIRMED_SYNTHETIC_MARKER');
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed('confirmed-1', 'BACKGROUND_REFRESH_MARKER')]);
  await waitFor('BACKGROUND_REFRESH_MARKER');
  await watcher.close();
  const closed = await snapshot(f.managed);
  await json(path.join(f.memoryRoot, 'records.json'), [confirmed('confirmed-1', 'AFTER_CLOSE_MARKER')]);
  await new Promise(resolve => setTimeout(resolve, 2200));
  assert.deepEqual(await snapshot(f.managed), closed);
});
