// Isolated local voice pilot. No imports from Alice memory writers or cloud providers.
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const origin = 'http://127.0.0.1:18090';
const token = randomBytes(32).toString('hex');
const assets = fileURLToPath(new URL('./voice-turn-pilot/', import.meta.url));
const fetchLocal = (url, options = {}) => fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120000), ...options });
const ps = await fetchLocal('http://127.0.0.1:11434/api/ps').then(r => r.json());
if (ps.models.length) throw Error('Ollama tiene un modelo activo. Cerrá su sesión antes del piloto.');
try { await fetchLocal('http://127.0.0.1:18089/health'); throw Error('Puerto del motor ocupado'); }
catch (e) { if (e.message === 'Puerto del motor ocupado') throw e; }
let busy = false, ready = false, engine, idle;
function reply(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function decode(bytes, wav) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'pipe',
      '-f', wav ? 'wav' : 'matroska', '-i', 'pipe:0', '-t', '61', '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, failure;
    const timer = setTimeout(() => { failure = Error('Conversión agotó el tiempo'); child.kill(); }, 15000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.stdin.on('error', () => {});
    child.stderr.resume();
    child.stdout.on('data', c => { size += c.length; if (size > 61 * 32000) { failure = Error('Audio demasiado largo'); child.kill(); } else chunks.push(c); });
    child.on('close', code => { clearTimeout(timer); if (failure || code !== 0) reject(failure ?? Error('No se pudo decodificar el audio')); else resolve(Buffer.concat(chunks)); });
    child.stdin.end(bytes);
  });
}
function wavFrom(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(pcm.length + 36, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const server = http.createServer(async (req, res) => {
  if (req.headers.host !== '127.0.0.1:18090') return reply(res, 403, { error: 'Host no permitido' });
  clearTimeout(idle); idle = setTimeout(shutdown, 15 * 60 * 1000);
  if (req.method === 'GET' && ['/', '/client.js'].includes(req.url)) {
    res.writeHead(200, { 'Content-Type': req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      'Permissions-Policy': 'microphone=(self), camera=()' });
    return res.end(fs.readFileSync(assets + (req.url === '/' ? 'index.html' : 'client.js'), 'utf8').replace('__TOKEN__', token));
  }
  if (req.method === 'GET' && req.url === '/health') return reply(res, 200, { ready, busy });
  if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['x-pilot-token'] !== token) return reply(res, 403, { error: 'Solicitud no autorizada' });
  if (req.url === '/shutdown') { reply(res, 200, { stopped: true }); return shutdown(); }
  if (req.url !== '/transcribe') return reply(res, 404, { error: 'Ruta desconocida' });
  if (!ready || busy) return reply(res, 409, { error: 'El motor está preparando o procesando otra solicitud' });
  const mime = req.headers['content-type'] ?? '';
  if (!mime.startsWith('audio/wav') && !mime.startsWith('audio/webm')) return reply(res, 415, { error: 'Se admite WAV o WebM' });
  busy = true;
  try {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 8 * 1024 * 1024) { reply(res, 413, { error: 'Audio demasiado grande' }); return; } chunks.push(c); }
    if (!size) return reply(res, 200, { text: '', noSpeech: true, inference: false });
    const pcm = await decode(Buffer.concat(chunks), mime.startsWith('audio/wav'));
    if (pcm.length > 60 * 32000) return reply(res, 413, { error: 'Máximo 60 segundos por toma; no se transcribió un fragmento recortado' });
    // Exact digital silence only. Never mistake a quiet speaker for silence by an arbitrary volume threshold.
    if (!pcm.length || pcm.every(byte => byte === 0)) return reply(res, 200, { text: '', noSpeech: true, inference: false });
    const active = await fetchLocal('http://127.0.0.1:11434/api/ps').then(r => r.json());
    if (active.models.length) throw Error('Se activó Ollama: cerrá esa sesión para conservar un solo modelo');
    const start = performance.now();
    const r = await fetchLocal('http://127.0.0.1:18089/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'voice-pilot', stream: false, temperature: 0.2, seed: 42, max_tokens: 500,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.' },
          { type: 'input_audio', input_audio: { data: wavFrom(pcm).toString('base64'), format: 'wav' } },
        ] }] }) });
    if (!r.ok) throw Error(`Motor local: HTTP ${r.status}`);
    const answer = await r.json();
    if (answer.choices?.[0]?.finish_reason === 'length') throw Error('Transcripción incompleta. Dividí la toma; no se acepta como completa.');
    const text = answer.choices?.[0]?.message?.content?.trim() ?? '';
    reply(res, 200, { text: text === 'NO_SPEECH' ? '' : text, noSpeech: !text || text === 'NO_SPEECH', inference: true, seconds: (performance.now() - start) / 1000 });
  } catch (e) { if (!res.headersSent) reply(res, 400, { error: e.message }); }
  finally { busy = false; }
});
let stopping = false;
function shutdown() {
  if (stopping) return; stopping = true; ready = false; clearTimeout(idle);
  engine?.kill(); server.close(); server.closeAllConnections();
}
server.requestTimeout = 30000;
server.on('error', e => { console.error(e.message); shutdown(); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18090, '127.0.0.1', resolve); });
engine = spawn('D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe', [
  '-m', 'D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf',
  '--mmproj', 'D:/Alice-model-evaluation/models/gemma4-e2b/mmproj-F16.gguf', '--host', '127.0.0.1', '--port', '18089',
  '-c', '4096', '-np', '1', '-ngl', '24', '--mmproj-offload', '--reasoning', 'off', '--jinja', '-t', '8',
  '--cors-origins', 'http://127.0.0.1:18089', '--no-cors-credentials', '--no-agent',
], { windowsHide: true, stdio: 'ignore' });
engine.on('error', e => { console.error(e.message); shutdown(); });
engine.on('exit', () => shutdown());
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown); process.on('exit', () => engine?.kill());
for (let n = 0; n < 120 && !stopping; n++) {
  try { if ((await fetchLocal('http://127.0.0.1:18089/health', { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
  await new Promise(r => setTimeout(r, 1000));
}
if (!ready) { shutdown(); throw Error('El motor no inició'); }
idle = setTimeout(shutdown, 15 * 60 * 1000);
console.log('Piloto listo: ' + origin + ' · sin memoria ni nube · cierre tras 15 minutos sin solicitudes');
