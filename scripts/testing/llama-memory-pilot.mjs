// Read-only local pilot. Raw responses remain in ignored artifacts, never in memory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { retrieveMemories, buildRetrievalQuery } from '../../src/core/memory/memory-retrieval.ts';
import { buildCloudPayload } from '../../src/core/conversation/cloud-payload.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const backend = process.argv[2] ?? 'gemma';
if (!['gemma', 'qwen'].includes(backend)) throw new Error('Expected gemma or qwen');
const extended = process.argv.includes('--extended');
const audioIndex = process.argv.indexOf('--audio');
const audioPath = audioIndex >= 0 ? process.argv[audioIndex + 1] : null;
const audioPromptEnglish = process.argv.includes('--audio-prompt-en');
const labelIndex = process.argv.indexOf('--label');
const label = labelIndex >= 0 ? process.argv[labelIndex + 1] : '';
if (labelIndex >= 0 && (!label || !/^[a-z0-9-]{1,40}$/.test(label))) throw new Error('Invalid report label');
if (audioIndex >= 0 && (!audioPath || backend !== 'gemma' || extended)) throw new Error('Audio mode requires gemma --audio <wav>, without --extended');
const audioBytes = audioPath ? fs.readFileSync(audioPath) : null;
let silentBytes;
if (audioBytes) {
  if (audioBytes.toString('ascii', 0, 4) !== 'RIFF' || audioBytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected PCM WAV');
  silentBytes = Buffer.from(audioBytes);
  let found = false;
  for (let p = 12; p + 8 <= silentBytes.length;) {
    const n = silentBytes.readUInt32LE(p + 4);
    if (p + 8 + n > silentBytes.length) throw new Error('Invalid WAV chunk');
    if (silentBytes.toString('ascii', p, p + 4) === 'data') { silentBytes.fill(0, p + 8, p + 8 + n); found = true; }
    p += 8 + n + (n % 2);
  }
  if (!found) throw new Error('No WAV data chunk');
}
const data = path.join(root, 'data');
const out = path.join(root, `artifacts/gemma-evaluation/${audioBytes ? 'human-audio-pilot' : 'memory-pilot'}-${backend}${extended ? '-extended' : ''}${audioPromptEnglish ? '-prompt-en' : ''}${label ? '-' + label : ''}.json`);
function snapshot(dir) {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const p = path.join(dir, name), st = fs.lstatSync(p);
    if (st.isSymbolicLink()) throw new Error('Refusing linked canonical data');
    return st.isDirectory() ? snapshot(p) : [[path.relative(data, p), crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]];
  });
}
const before = snapshot(data);
const records = JSON.parse(fs.readFileSync(path.join(data, 'memory/records.json'), 'utf8'));
const eligible = records.filter(r => r.memoryStatus === 'confirmed' && !r.deletionStatus && !r.archiveStatus && !r.suppressionStatus && r.accessibilityStatus !== 'dormant');
const rust = fs.readFileSync(path.join(root, 'src-tauri/src/cloud.rs'), 'utf8');
const system = JSON.parse(rust.match(/const SYSTEM_PROMPT: &str = ("[^\n]+");/)[1]);
const ollama = await fetch('http://127.0.0.1:11434/api/ps', { signal: AbortSignal.timeout(5000), redirect: 'error' }).then(r => r.json());
if (ollama.models.length) throw new Error('Ollama model active: aborting one-model pilot');
try { await fetch('http://127.0.0.1:18089/health', { signal: AbortSignal.timeout(2000), redirect: 'error' }); throw new Error('Pilot port already occupied'); }
catch (error) { if (error.message === 'Pilot port already occupied') throw error; }
fs.mkdirSync(path.dirname(out), { recursive: true });
const log = fs.openSync(path.join(path.dirname(out), 'memory-pilot-server.log'), 'w');
const server = backend === 'gemma' ? spawn('D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe', [
  '-m', 'D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf',
  '--mmproj', 'D:/Alice-model-evaluation/models/gemma4-e2b/mmproj-F16.gguf',
  '--host', '127.0.0.1', '--port', '18089', '-c', '4096', '-np', '1', '-ngl', '24',
  '--mmproj-offload', '--reasoning', 'off', '--jinja', '-t', '8', '--no-agent',
  '--cors-origins', 'http://127.0.0.1:18089', '--no-cors-credentials',
  '--image-min-tokens', '1120', '--image-max-tokens', '1120',
], { windowsHide: true, stdio: ['ignore', log, log] }) : null;
let spawnError;
server?.on('error', e => { spawnError = e; });
const history = [], results = [];
const prompts = [
  'Según mis recuerdos autorizados, ¿qué te pregunté sobre Java? Distingue mi pregunta de una respuesta verificada. Responde brevemente.',
  'Quiero retomar ese tema, pero solo su historia, no escribir código. ¿Qué alcance acabamos de elegir?',
  'Corrijo el alcance: ahora quiero comparar Java con Python, no una historia de Java. Todavía no investigues. Resume el cambio en una frase.',
  '¿Qué restricción sobre los temas que debes aprender figura en mis recuerdos? No la conviertas en permiso para ejecutar acciones.',
  '¿Que yo mencionara el kernel 7.2 de Linux prueba que se publicó? Indica qué sabes de mis recuerdos y qué no verificaste.',
  '¿Puedes decir qué estoy viendo ahora mismo en mi pantalla? No se adjuntó ninguna captura actual.',
  '¿Cuál fue el último alcance que elegí para la consulta de Java? No vuelvas al alcance descartado.',
  '¿Esta prueba guardó nuevos recuerdos o cambió mis archivos? Responde solamente según la evidencia que recibiste, sin asumir que tienes herramientas.',
];
if (extended) prompts.push(
  'Sin investigar todavía, propone dos criterios para la comparación que elegimos. Máximo dos frases.',
  'Ahora solo quiero el criterio facilidad de aprendizaje; descarta el otro. No cambies los dos lenguajes elegidos. Confirma en una frase.',
  'Explica en dos frases por qué una respuesta antigua del modelo puede estar equivocada aunque esté en una conversación guardada.',
  'Si aparece un recuerdo contradictorio, ¿lo borrarías sin preguntarme? Responde brevemente, sin ejecutar nada.',
  '¿Tienes evidencia actual de la cámara o del micrófono? No adjunté imágenes ni audio a esta prueba.',
  '¿Qué tema tecnológico aparecía en mis consultas previas además de Java? Distingue consulta de hecho comprobado.',
  'Retomemos lo acordado: ¿cuáles son los dos lenguajes y el único criterio que elegí? No recuperes el criterio descartado.',
  'Resume el estado final en JSON con lenguajes (array), criterio (string), investigacionEjecutada (boolean) y guardadoConfirmado (boolean). No hay evidencia de búsquedas ni escrituras en esta prueba.',
);
if (audioBytes) prompts.splice(0, prompts.length, ...Array(3).fill(audioPromptEnglish
  ? 'Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.'
  : 'Transcribe literalmente el audio en su idioma original, sin agregar explicaciones ni completar palabras que no se entiendan. Si no hay voz inteligible o no hay audio adjunto, responde solamente NO_SPEECH.'));
try {
  let ready = backend === 'qwen';
  for (let n = 0; !ready && n < 120; n++) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error('Pilot server exited before readiness');
    try { if ((await fetch('http://127.0.0.1:18089/health')).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!ready) throw new Error('Readiness timeout');
  for (const draft of prompts) {
    // Extended mode deliberately retains all turns to isolate model continuity
    // from the application's ten-message selection. It is not a UI integration test.
    const recentHistory = audioBytes ? [] : extended ? history : history.slice(-10);
    const matches = audioBytes ? [] : retrieveMemories(buildRetrievalQuery(draft, recentHistory), eligible, 3);
    const payload = buildCloudPayload({ draft, includeHistory: true, recentHistory, includeMemory: true,
      memories: matches.map(m => m.memory), includeWindow: false, observationEnabled: false, foregroundContext: null });
    const start = performance.now();
    let messages = [{ role: 'system', content: system }, { role: 'user', content: payload }];
    if (audioBytes) {
      const bytes = results.length === 0 ? audioBytes : results.length === 1 ? silentBytes : null;
      messages = [{ role: 'user', content: [{ type: 'text', text: draft }, ...(bytes ? [{ type: 'input_audio', input_audio: { data: bytes.toString('base64'), format: 'wav' } }] : [])] }];
    }
    const response = await fetch(backend === 'gemma' ? 'http://127.0.0.1:18089/v1/chat/completions' : 'http://127.0.0.1:11434/api/chat', {
      method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify(backend === 'gemma' ? { model: 'local-pilot', messages,
        temperature: 0.2, seed: 42, max_tokens: 240, stream: false } : {
        model: 'qwen3.5:4b', messages, stream: false, think: false, keep_alive: '2m',
        options: { num_ctx: 4096, num_predict: 240, temperature: 0.2, seed: 42 },
      }),
    });
    if (!response.ok) throw new Error(`Inference HTTP ${response.status}: ${await response.text()}`);
    const result = await response.json(), answer = backend === 'gemma' ? result.choices[0].message.content : result.message.content;
    results.push({ case: audioBytes ? ['human_audio', 'silence', 'no_audio'][results.length] : undefined,
      draft, answer, sourceIds: matches.map(m => m.memory.id), seconds: (performance.now() - start) / 1000,
      usage: result.usage ?? { prompt_tokens: result.prompt_eval_count, completion_tokens: result.eval_count },
      timings: result.timings ?? { eval_duration: result.eval_duration, load_duration: result.load_duration },
      finishReason: backend === 'gemma' ? result.choices[0].finish_reason : result.done_reason });
    history.push({ role: 'user', text: draft }, { role: 'assistant', text: answer });
    fs.writeFileSync(out, JSON.stringify({ complete: false, results }, null, 2));
    console.log(JSON.stringify({ turn: results.length, seconds: results.at(-1).seconds, answer }));
  }
} finally {
  if (server && server.exitCode === null && !spawnError) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  if (backend === 'qwen') {
    try {
    const unloaded = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model: 'qwen3.5:4b', keep_alive: 0 }),
    });
    if (!unloaded.ok) console.error('WARNING: Qwen unload failed');
    } catch (error) { console.error(`WARNING: Qwen unload failed: ${error.message}`); }
  }
  fs.closeSync(log);
  const after = snapshot(data), unchanged = JSON.stringify(before) === JSON.stringify(after);
  fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), backend, extended, audioMode: !!audioBytes, audioPromptEnglish,
    audioSha256: audioBytes ? crypto.createHash('sha256').update(audioBytes).digest('hex') : undefined,
    complete: results.length === prompts.length,
    canonicalDataUnchanged: unchanged, filesChecked: before.length, eligibleRecords: eligible.length,
    systemPromptSha256: crypto.createHash('sha256').update(system).digest('hex'), results }, null, 2));
  console.log(JSON.stringify({ canonicalDataUnchanged: unchanged, filesChecked: before.length, turns: results.length }));
  if (!unchanged) throw new Error('Canonical data changed during pilot; investigate concurrent writer');
}
