// Explicit native WebView2 smoke test. Run against an isolated QA instance only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function main() {
  const [playwrightModule, dataRoot] = process.argv.slice(2);
  assert(playwrightModule && dataRoot, 'Pass Playwright module path and isolated data root');
  assert(path.basename(dataRoot).startsWith('alice-document-ui-'), 'Requires an isolated QA root');
  const { chromium } = require(playwrightModule);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  try {
    const page = browser.contexts().flatMap(context => context.pages())
      .find(candidate => candidate.url().includes('localhost:5173') || candidate.url().includes('127.0.0.1:5173'));
    assert(page, 'Native Alice page not found');
    // Confirm the actual backend uses the isolated directory before any operation.
    const audit = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('audit_snapshot'));
    assert(audit.storagePath.toLowerCase().startsWith(path.resolve(dataRoot).toLowerCase() + path.sep));
    const auditPath = path.join(dataRoot, 'audit', 'events-v1.jsonl');
    const readEvents = () => fs.readFileSync(auditPath, 'utf8').trim().split('\n')
      .map(line => JSON.parse(line)).filter(e => e.operation === 'preview_document');
    const baseline = readEvents().length;
    const card = page.locator('section').filter({ has: page.locator('#document-preview-title') }).last();
    const read = page.getByRole('button', { name: 'Autorizar lectura y ver texto', exact: true });
    await read.waitFor({ state: 'visible' });
    assert(await read.isDisabled());
    const manual = path.resolve('docs/MANUAL_DE_USO.md');
    const before = fs.readFileSync(manual);
    await page.getByLabel('Seleccionar documento local', { exact: true }).setInputFiles(manual);
    await read.click();
    await card.getByText('SHA-256:', { exact: false }).waitFor({ timeout: 35000 });
    const expectedHash = crypto.createHash('sha256').update(before).digest('hex');
    assert((await card.innerText()).includes(expectedHash));
    const fragments = await card.locator('details').count();
    assert(fragments > 0);
    await card.locator('summary').first().click();
    assert((await card.locator('pre').first().innerText()).includes('Alice'));
    await card.scrollIntoViewIfNeeded();
    fs.mkdirSync('local/artifacts', { recursive: true });
    await card.screenshot({ path: 'local/artifacts/document-preview-native.png' });
    await page.getByRole('button', { name: 'Descartar vista previa', exact: true }).click();
    assert.equal(await card.locator('details').count(), 0);
    assert(await read.isDisabled());
    // Real parser failure, deliberately malformed bytes; never stored as memory.
    await page.getByLabel('Seleccionar documento local', { exact: true }).setInputFiles({
      name: 'invalid-utf8.txt', mimeType: 'text/plain', buffer: Buffer.from([0xff]),
    });
    await read.click();
    await card.getByRole('alert').waitFor({ timeout: 35000 });
    assert((await card.getByRole('alert').innerText()).includes('No se pudo extraer'));
    assert.equal(await card.locator('details').count(), 0);
    await page.getByRole('button', { name: 'Descartar vista previa', exact: true }).click();
    assert.deepEqual(fs.readFileSync(manual), before);
    assert(!fs.existsSync(path.join(dataRoot, 'memory', 'records.json')));
    const events = readEvents().slice(baseline);
    assert.equal(events.length, 4);
    assert.deepEqual(events.map(e => e.outcome), ['pending', 'success', 'pending', 'error']);
    assert(!JSON.stringify(events).includes('MANUAL_DE_USO'));
    console.log(JSON.stringify({ nativeUi: true, fragments, discard: true, malformedInput: 'visibleError',
      auditEvents: events.length, sourceUnchanged: true, memoriesWritten: 0 }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
