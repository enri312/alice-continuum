// Browser rendering of actual built CSS and button states, not a live runtime test.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/enri3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 850, height: 500 } });
    const css = fs.readdirSync('dist/assets').filter(n => n.endsWith('.css')).map(n => fs.readFileSync('dist/assets/' + n, 'utf8')).join('\n');
    await page.setContent(`<style>${css}</style><main class="settings-page"><section class="settings-card"><div class="settings-policy settings-runtime"><strong>GEMMA LOCAL · INICIADO</strong><p>El botón de inicio está deshabilitado porque Gemma ya está funcionando.</p><div class="settings-runtime-actions"><button class="runtime-start" disabled>Iniciar Gemma local</button><button class="runtime-stop">Apagar Gemma</button></div></div></section></main>`);
    const stop = page.locator('.runtime-stop');
    const initial = await stop.evaluate(b => ({ background: getComputedStyle(b).backgroundColor, height: b.getBoundingClientRect().height }));
    assert.equal(initial.background, 'rgb(255, 197, 107)'); assert(initial.height >= 44);
    assert.equal(await page.locator('.runtime-start').evaluate(b => getComputedStyle(b).opacity), '1');
    await stop.focus();
    assert.equal(await stop.evaluate(b => getComputedStyle(b).outlineStyle), 'solid');
    fs.mkdirSync('artifacts/gemma-evaluation', { recursive: true });
    await page.screenshot({ path: 'artifacts/gemma-evaluation/settings-runtime-buttons.png' });
    await page.setViewportSize({ width: 390, height: 600 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
    console.log('PASS: active contrast colors, readable disabled state, 44px target, keyboard focus, narrow viewport');
  } finally { await browser.close(); }
})();
