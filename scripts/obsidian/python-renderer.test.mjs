import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { prepareNoteJob, renderNotesWithPython } from './python-renderer.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const pythonExecutable = process.env.ALICE_TEST_PYTHON ?? path.join(projectRoot,
  process.platform === 'win32' ? 'runtime/venv/Scripts/python.exe' : 'runtime/venv-linux/bin/python');
const options = { projectRoot, pythonExecutable };

test('prepared fields preserve JS nullish and numeric representations', () => {
  const job = prepareNoteJob('x', 'Recuerdo registrado', 'memory/records.json', { intention: false, summary: 0,
    source: '', active: false, ownerCorrected: true, nested: { small: 1e-7 } });
  assert.equal(job.topic, 'false'); assert.equal(job.content, '0'); assert.equal(job.provenance, '');
  assert.ok(job.technicalJson.includes('1e-7'));
  assert.ok(job.states.includes('Uso automatico: retirado del contexto'));
});

test('Python worker handles multiple ordered batches and rejects invalid requests', { skip: !existsSync(pythonExecutable) }, async () => {
  const jobs = Array.from({ length: 1001 }, (_, index) => prepareNoteJob(String(index), 'Recuerdo registrado',
    'memory/records.json', { intention: `Tema ${index}`, summary: 'Dato sintético' }));
  const result = await renderNotesWithPython(jobs, options);
  assert.equal(result.length, 1001);
  assert.ok(result[0].includes('Tema 0')); assert.ok(result[1000].includes('Tema 1000'));
  await assert.rejects(renderNotesWithPython([{ ...jobs[0], extra: true }], options), /rechazo/);
  await assert.rejects(renderNotesWithPython([{ ...jobs[0], content: 'x'.repeat(8 * 1024 * 1024) }], options), /8 MiB/);
  await assert.rejects(renderNotesWithPython([jobs[0]], { ...options, pythonExecutable: 'relative-python' }), /absoluta/);
});
