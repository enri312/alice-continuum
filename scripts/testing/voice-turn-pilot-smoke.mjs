import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const base = 'http://127.0.0.1:18090';
function snapshot(dir) { return fs.readdirSync(dir).sort().flatMap(n => { const p = path.join(dir, n), s = fs.lstatSync(p); if (s.isSymbolicLink()) throw Error('Symlink'); return s.isDirectory() ? snapshot(p) : [[p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]]; }); }
const before = snapshot('data');
const js = await fetch(base + '/client.js').then(r => r.text());
const token = js.match(/const token = '([a-f0-9]+)'/)[1];
const rows = [];
async function post(id, body, type, headers = {}) {
  const r = await fetch(base + '/transcribe', { method: 'POST', headers: { Origin: base, 'X-Pilot-Token': token, 'Content-Type': type, ...headers }, body });
  const json = await r.json(); rows.push({ id, status: r.status, ...json }); return { status: r.status, ...json };
}
try {
  assert.equal((await post('empty', Buffer.alloc(0), 'audio/wav')).inference, false);
  const wav = fs.readFileSync('local/artifacts/gemma-evaluation/human-spanish-2026-09-05.wav');
  const silence = Buffer.from(wav);
  for (let p = 12; p + 8 <= silence.length;) { const n = silence.readUInt32LE(p + 4); if (silence.toString('ascii', p, p + 4) === 'data') silence.fill(0, p + 8, p + 8 + n); p += 8 + n + n % 2; }
  assert.equal((await post('digital_silence', silence, 'audio/wav')).inference, false);
  assert.equal((await post('invalid', Buffer.from('not audio'), 'audio/wav')).status, 400);
  assert.equal((await post('wrong_origin', wav, 'audio/wav', { Origin: 'http://example.invalid' })).status, 403);
  assert.equal((await post('missing_token', wav, 'audio/wav', { 'X-Pilot-Token': '' })).status, 403);
  const real = await post('real_recording_webm', fs.readFileSync('local/artifacts/gemma-evaluation/human-spanish-pilot.webm'), 'audio/webm');
  assert.equal(real.status, 200); assert.equal(real.inference, true); assert.match(real.text, /Java/i); assert.match(real.text, /Python/i);
  const require = createRequire('C:/Users/enri3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 920 } });
    let micRequests = 0, transcriptions = 0;
    await page.addInitScript(() => { window.__micCalls = 0; const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = (...a) => { window.__micCalls++; return original(...a); }; });
    page.on('request', r => { if (r.url().endsWith('/transcribe')) transcriptions++; });
    await page.goto(base); await page.waitForFunction(() => !document.getElementById('start').disabled);
    assert.equal(await page.locator('#finish').isDisabled(), true);
    assert.equal(await page.locator('#transcribe').isDisabled(), true);
    micRequests = await page.evaluate(() => window.__micCalls); assert.equal(micRequests, 0);
    await page.locator('#text').fill('Texto revisable de prueba, no enviado');
    assert.equal(await page.locator('#copy').isDisabled(), false); assert.equal(transcriptions, 0);
    await page.locator('#text').fill('');
    await page.screenshot({ path: 'local/artifacts/gemma-evaluation/voice-turn-pilot.png', fullPage: true });
    rows.push({ id: 'browser_idle', micRequests, transcriptions, result: 'pass' });
  } finally { await browser.close(); }
} finally {
  const unchanged = JSON.stringify(before) === JSON.stringify(snapshot('data'));
  fs.writeFileSync('local/artifacts/gemma-evaluation/voice-turn-pilot-smoke.json', JSON.stringify({ date: new Date().toISOString(), canonicalDataUnchanged: unchanged, files: before.length, rows }, null, 2));
  assert(unchanged); console.log(JSON.stringify({ cases: rows.length, canonicalDataUnchanged: unchanged, files: before.length }));
}
