// Real component rendering with existing local records, read-only.
// No model requests, memory writes or synthetic activity. Screenshots stay in data/.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/enri3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const paths = ['data/memory/records.json', 'data/memory/owner-profile.json'];
  const before = paths.map(p => fs.readFileSync(p, 'utf8'));
  const memories = [...JSON.parse(before[1]).records, ...JSON.parse(before[0])];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173');
    await page.evaluate(async memories => {
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const React = reactModule.default ?? reactModule;
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default ?? domModule;
      const { NeuralVolume } = await import('/src/components/cognitive/NeuralVolume.tsx');
      const { buildBrainSnapshot } = await import('/src/core/cognitive/brain.ts');
      document.getElementById('root').style.display = 'none';
      const host = document.createElement('main');
      host.className = 'volume-page-stage';
      host.style.margin = '20px';
      document.body.append(host);
      const snapshot = buildBrainSnapshot({ memories, conversationCount: 0, retrievedMemoryCount: 0, retrievedMemoryTop: '', retrievedMemoryIds: [], observerEnabled: false, foregroundContext: null, cloudConfigured: false, cloudPending: false });
      createRoot(host).render(React.createElement(NeuralVolume, { snapshot, activity: null, associationStatus: 'unavailable' }));
    }, memories);
    const select = page.locator('.observatory-select select');
    await page.locator('.observatory-search summary').click();
    await select.waitFor();
    assert.equal(await select.locator('option').count(), memories.length + 1);
    const orbit = page.getByRole('button', { name: 'Órbita automática:' });
    assert.equal(await orbit.getAttribute('aria-pressed'), 'false');
    await orbit.click();
    assert.equal(await orbit.getAttribute('aria-pressed'), 'true');
    await orbit.click();
    const ids = await select.locator('option').evaluateAll(rows => rows.slice(1).map(row => row.value));
    await select.selectOption(ids[0]);
    await page.locator('.volume-node-inspector.selected').waitFor();
    await page.locator('.observatory-provenance summary').click();
    await page.getByRole('button', { name: 'Cerrar ficha' }).click();
    assert.equal(await page.locator('.volume-inspector-rail').count(), 0);
    await page.locator('.observatory-search summary').click();
    fs.mkdirSync('data/visual-checks', { recursive: true });
    await page.screenshot({ path: 'data/visual-checks/volume-observatory-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'data/visual-checks/volume-observatory-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile overflow');
    assert.equal(errors.length, 0, errors.join('\n'));
    paths.forEach((p, i) => assert.equal(fs.readFileSync(p, 'utf8'), before[i]));
    console.log(`PASS: ${memories.length} existing memory nodes, selection, orbit control, mobile layout; sources unchanged. Browser rendering only, no native inference tested.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
