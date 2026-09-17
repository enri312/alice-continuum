// Real native UI against an isolated copy of canonical records. No model calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function hashes(root) {
  const result = {};
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      assert(!entry.isSymbolicLink());
      if (entry.isDirectory()) visit(file);
      else result[path.relative(root, file)] = hash(fs.readFileSync(file));
    }
  }
  visit(root); return result;
}
async function main() {
  const [modulePath, root] = process.argv.slice(2);
  assert(path.basename(root).startsWith('alice-r8-ui-'));
  const canonical = path.resolve('data');
  const before = hashes(canonical);
  const browser = await require(modulePath).chromium.connectOverCDP('http://127.0.0.1:9222');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => /(?:localhost|127\.0\.0\.1):5173/.test(p.url()));
    assert(page);
    const call = (command, args = {}) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
    const audit = await call('audit_snapshot');
    assert(audit.storagePath.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep));
    const graph = await call('knowledge_graph_snapshot');
    const memory = await call('load_memory');
    const candidates = graph.nodes.filter(n => n.evidenceUse === 'episodeOnly')
      .map(n => ({ id: n.lifecycle.recordId, quote: memory.sessions.find(r => r.id === n.lifecycle.recordId)?.intention?.slice(0, 80) }))
      .filter(n => n.quote?.trim()).slice(0, 2);
    assert.equal(candidates.length, 2);
    assert.equal((await call('knowledge_graph_associations')).revision, 0);
    await page.getByRole('button', { name: 'Flujo cognitivo', exact: true }).click();
    for (let i = 0; i < 2; i++) {
      await page.getByLabel(`Experiencia ${i + 1}`, { exact: true }).selectOption(candidates[i].id);
      await page.getByLabel(`Cita ${i + 1}`, { exact: true }).fill(candidates[i].quote);
    }
    await page.getByRole('button', { name: 'Revisar relación', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar y guardar relación', exact: true }).click();
    await page.getByText('Relación guardada por tu confirmación.', { exact: true }).waitFor();
    assert.equal((await call('knowledge_graph_snapshot')).edges.length, 1);
    await page.getByRole('button', { name: 'Retirar relación', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar relación', exact: true }).waitFor();
    assert.equal((await call('knowledge_graph_snapshot')).edges.length, 0);
    await page.getByRole('button', { name: 'Restaurar relación', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar cambio', exact: true }).click();
    await page.getByRole('button', { name: 'Retirar relación', exact: true }).waitFor();
    assert.equal((await call('knowledge_graph_snapshot')).edges.length, 1);
    await page.reload();
    await page.getByRole('button', { name: 'Flujo cognitivo', exact: true }).click();
    await page.getByRole('button', { name: 'Retirar relación', exact: true }).waitFor();
    assert.equal((await call('knowledge_graph_associations')).revision, 3);
    const sourcePath = path.join(root, 'memory', 'records.json');
    const records = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    records.find(r => r.id === candidates[0].id).intention += '\nCambio controlado sólo en la copia QA.';
    fs.writeFileSync(sourcePath, JSON.stringify(records));
    await page.getByRole('button', { name: 'Actualizar relaciones', exact: true }).click();
    await page.getByText('No vigente · fuente cambiada o no recuperable', { exact: true }).waitFor();
    assert.equal((await call('knowledge_graph_snapshot')).edges.length, 0);
    const journal = path.join(root, 'memory', 'associations-v1');
    const revisions = fs.readdirSync(journal).filter(f => f.endsWith('.json'));
    assert.equal(revisions.length, 3);
    for (const file of revisions) {
      const raw = fs.readFileSync(path.join(journal, file), 'utf8');
      for (const candidate of candidates) assert(!raw.includes(candidate.quote));
    }
    assert.deepEqual(hashes(canonical), before);
    console.log(JSON.stringify({ nativeUi: true, saved: true, withdrawn: true, restored: true,
      reload: true, staleSourceExcluded: true, immutableRevisions: 3, canonicalFilesPreserved: Object.keys(before).length }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
