// Model/prompt experiments only, without local application handlers.
// No Fish, microphone or canonical Alice stores. The production reference
// shortcut is verified by the native conversation_reference/cloud tests.
// node scripts/testing/conversation-reference-eval.mjs --live --before <cloud.rs>
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildCloudPayload } from '../../src/core/conversation/cloud-payload.ts';

if (!process.argv.includes('--live')) throw Error('Usar --live para evaluar Gemma con ejemplos ficticios.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const output = option('--output') ? path.resolve(option('--output')) : path.join(root, 'local/artifacts/r9-reference-stop-rust-2026-11-03');
fs.mkdirSync(output, { recursive: true });
const endpoint = 'http://127.0.0.1:18089';
const fetchLocal = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(120_000), ...options });
const ps = await fetchLocal('http://127.0.0.1:11434/api/ps').then(r => r.json());
if (ps.models?.length) throw Error('Hay un modelo Ollama activo; no iniciar otro.');
const runtimePid = option('--runtime-pid');
if (runtimePid) {
  if (!/^\d+$/.test(runtimePid) || process.platform !== 'win32') throw Error('Se requiere un PID Windows explícito.');
  const identity = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${runtimePid}'; $owner=Get-CimInstance Win32_Process -Filter ('ProcessId='+$p.ParentProcessId); @{engine=$p.Name; command=$p.CommandLine; owner=$owner.ExecutablePath} | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }));
  if (identity.engine !== 'llama-server.exe' || !identity.command?.includes('--port 18089') || !identity.command?.includes('gemma-4-E2B-it-Q4_K_M.gguf') || path.resolve(identity.owner ?? '').toLowerCase() !== path.join(root,'.cargo-target/debug/alice-continuum.exe').toLowerCase()) throw Error('El PID no pertenece al motor de esta copia de Alice.');
} else try {
  await fetchLocal(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) });
  throw Error('Motor ocupado: no se adopta una sesión ajena.');
} catch (error) { if (error.message === 'Motor ocupado: no se adopta una sesión ajena.') throw error; }

function promptFrom(file) {
  const source = fs.readFileSync(file, 'utf8');
  const read = name => {
    const include = source.match(new RegExp(`const ${name}: &str = include_str!\\("([^"]+)"\\);`));
    if (include) return fs.readFileSync(path.resolve(path.dirname(file), include[1]), 'utf8');
    const match = source.match(new RegExp(`const ${name}: &str = ("(?:[^"\\\\]|\\\\.)*");`));
    return match ? JSON.parse(match[1]) : null;
  };
  const voiceBase = read('VOICE_SYSTEM_PROMPT');
  if (voiceBase) return { base: voiceBase, greeting: read('VOICE_GREETING_PROMPT') ?? '' };
  const base = read('SYSTEM_PROMPT');
  if (!base) throw Error(`No se pudo leer SYSTEM_PROMPT de ${file}`);
  const oral = read('VOICE_ORAL_PROMPT');
  if (oral) return { base: base + oral, greeting: read('VOICE_GREETING_PROMPT') ?? '' };
  const legacy = [...source.matchAll(/format!\(("(?:[^"\\]|\\.)*"), SYSTEM_PROMPT\)/g)]
    .map(match => JSON.parse(match[1])).find(text => text.includes('CONVERSACIÓN ORAL'));
  if (!legacy) throw Error('Falta el contrato oral anterior.');
  return { base: legacy.replace('{}', base), greeting: '' };
}

const cases = [
  { id: 'self-original', input: 'Hola, Alice, ¿me escuchas? Quiero saber para poder seguir avanzando con tu mejora', expected: 'Saludo cálido y mejora de Alice en primera persona, sin inventar módulos activos.' },
  { id: 'self-paraphrase', input: 'Alice, quiero pulir tu manera de conversar conmigo para que tus respuestas resulten más naturales.', expected: 'Su propia manera de conversar, no el desarrollo personal de Carlos.' },
  { id: 'owner', input: 'Alice, quiero mejorar mi manera de programar; me cuesta organizar mis funciones.', expected: 'Carlos está mejorando su programación; no Alice.' },
  { id: 'third-person', input: 'Alice, mi hermana Ana está mejorando su manera de explicar; quiero ayudarla.', expected: 'Ana está mejorando; Carlos quiere ayudar a Ana.' },
  { id: 'third-followup', history: [['user', 'Mi compañera Marta está practicando presentaciones.'], ['assistant', '¿Qué le está costando más a Marta?']], input: 'Me refiero a ella, no a ti. Su forma de hablar todavía suena rígida.', expected: 'Marta, no Alice; mantener el antecedente.' },
  { id: 'quoted', input: 'Mi hermano me dijo: «Quiero mejorar tu forma de explicar». ¿De quién estaba hablando?', expected: 'La forma de explicar de Carlos, destinatario de la cita.' },
  { id: 'correction', history: [['user', 'Quiero seguir avanzando con tu mejora.'], ['assistant', '¿Qué aspecto de tu desarrollo quieres revisar?']], input: 'No, me refiero a ti, Alice, a mejorar cómo conversas conmigo.', expected: 'Aceptar la corrección y hablar de sí misma en primera persona.' },
  { id: 'ambiguous', input: 'Hablé con Ana y Marta. Ella quiere cambiar su forma de hablar. ¿A quién me refiero con ella?', expected: 'Admitir que el antecedente es ambiguo, sin elegir arbitrariamente.' },
  { id: 'greeting-third', input: 'Hola, Alice. Mi hermana quiere que la ayude con sus clases de inglés.', expected: 'Saludo cálido; el tema sigue siendo la hermana, no el desarrollo de Alice.' },
  { id: 'less-questioning', history: [['user', 'Quiero seguir puliendo tu conversación.'], ['assistant', '¿Qué ajuste tienes en mente para mí?']], input: 'Evita hacerme otra pregunta al terminar cada respuesta; quiero algo más espontáneo.', expected: 'Aceptar el ajuste conversacional sin terminar con otra pregunta ni repetir un saludo.' },
];
if (process.argv.includes('--holdout')) {
  cases.splice(0, cases.length,
    { id:'quote-other-recipient',input:'Mi padre Luis le dijo a Ana: «Tu explicación necesita ejemplos». ¿De quién es la explicación?',expected:'De Ana; no de Carlos ni Alice.' },
    { id:'quote-owner-recipient',input:'Ayer mi vecina me comentó: «Tu voz se oye más tranquila». ¿Se refería a ti o a mí?',expected:'A Carlos, destinatario del comentario; no Alice.' },
    { id:'ambiguous-new-names',input:'Estuve con Beatriz y Claudia. Ella quiere aprender italiano. ¿Quién quiere aprender?',expected:'No se puede saber cuál de las dos; pedir esa aclaración.' },
    { id:'self-followup',history:[['user','Tus explicaciones son demasiado largas.'],['assistant','Puedo hacerlas más breves.']],input:'Eso es lo que quiero cambiar, para que me entiendas mejor.',expected:'Seguir hablando de explicaciones de Alice sin cambiar a otro proyecto.' },
    { id:'owner-new-topic',input:'Hoy quiero mejorar mi presentación para la universidad, no tu sistema.',expected:'Ayudar con la presentación de Carlos.' },
    { id:'no-question-needed',input:'Cuando no sepas un dato, dímelo directamente. No quiero que lo inventes.',expected:'Aceptar sin hacer otra pregunta ni inventar hechos.' });
}
const beforeIndex = process.argv.indexOf('--before');
const variants = beforeIndex >= 0
  ? [['before', promptFrom(path.resolve(process.argv[beforeIndex + 1]))], ['after', promptFrom(path.join(root, 'Backend/src-tauri/src/cloud.rs'))]]
  : [['after', promptFrom(path.join(root, 'Backend/src-tauri/src/cloud.rs'))]];
// Candidate prompts can be measured before changing the application's defaults.
const temperature = Number(option('--temperature') ?? '0.2');
if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) throw Error('Temperatura inválida.');
const thinkingBudget = option('--thinking-budget') === undefined ? -1 : Number(option('--thinking-budget'));
if (!Number.isInteger(thinkingBudget) || thinkingBudget < -1 || thinkingBudget > 512) throw Error('Presupuesto de razonamiento inválido.');
for (const [variant, prompts] of variants) {
  if (variant !== 'after') continue;
  if (option('--prompt-file')) prompts.base = fs.readFileSync(path.resolve(option('--prompt-file')), 'utf8');
  if (option('--greeting-file')) prompts.greeting = fs.readFileSync(path.resolve(option('--greeting-file')), 'utf8');
}
const log = fs.openSync(path.join(output, 'gemma-eval.log'), 'w');
const engine = runtimePid ? null : spawn('D:/Alice-model-evaluation/runtimes/llama-b10809/bin/llama-server.exe', [
  '-m', 'D:/Alice-model-evaluation/models/gemma4-e2b/gemma-4-E2B-it-Q4_K_M.gguf',
  '--mmproj', 'D:/Alice-model-evaluation/models/gemma4-e2b/mmproj-F16.gguf',
  '--host', '127.0.0.1', '--port', '18089', '-c', '4096', '-np', '1', '-ngl', '24',
  '--mmproj-offload', '--reasoning', 'off', '--jinja', '-t', '8', '--no-agent',
], { windowsHide: true, stdio: ['ignore', log, log] });
fs.closeSync(log);
let spawnError;
engine?.on('error', error => { spawnError = error; });
const results = [];
try {
  let ready = false;
  for (let tries = 0; tries < 180; tries++) {
    if (spawnError) throw spawnError;
    if (engine && engine.exitCode !== null) throw Error('El motor terminó antes de estar listo.');
    try { const r = await fetchLocal(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { ready = true; break; } } catch { /* Loading. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw Error('Gemma no estuvo listo dentro del plazo.');
  for (const [variant, prompts] of variants) {
    for (const test of cases) {
      const isGreeting = /^hola(?:\P{L}|$)/iu.test(test.input.replace(/^[\s¡¿]+/u, ''));
      const system = prompts.base + (isGreeting ? prompts.greeting : '');
      const history = test.history?.map(([role, text]) => `${role === 'user' ? 'Carlos' : 'Alice (respuesta anterior no verificada)'}: ${text}`).join('\n');
      const payload = variant === 'before'
        ? `${history ? `DIÁLOGO RECIENTE AUTORIZADO · LAS RESPUESTAS DE ALICE NO SON EVIDENCIA FACTUAL\n${history}\n\n` : ''}MENSAJE ACTUAL\n${test.input}`
        : buildCloudPayload({ draft: test.input, includeHistory: Boolean(history), includeAssistantDialogue: true,
          recentHistory: test.history?.map(([role, text]) => ({ role, text })) ?? [],
          includeMemory: false, memories: [], includeWindow: false, observationEnabled: false, foregroundContext: null });
      const started = performance.now();
      const response = await fetchLocal(`${endpoint}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        model: 'gemma-4-E2B-it-Q4_K_M', stream: false, temperature, seed: 42, max_tokens: 240,
        ...(process.argv.includes('--thinking') ? { reasoning_effort: 'low', chat_template_kwargs: { enable_thinking: true }, reasoning_budget_tokens: thinkingBudget, max_tokens: thinkingBudget < 0 ? 1200 : 240 + thinkingBudget } : {}),
        messages: process.argv.includes('--structured-dialogue')
          ? [{role:'system',content:system},...(test.history??[]).map(([role,text])=>({role,content:text})),{role:'user',content:test.input}]
          : [{ role: 'system', content: system }, { role: 'user', content: payload }],
      }) });
      if (!response.ok) throw Error(`Gemma HTTP ${response.status}`);
      const result = await response.json();
      const entry = { variant, ...test, response: result.choices?.[0]?.message?.content, finishReason: result.choices?.[0]?.finish_reason, elapsedMs: Math.round(performance.now() - started), usage: result.usage, reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens };
      results.push(entry);
      fs.writeFileSync(path.join(output, 'reference-results.json'), JSON.stringify(results, null, 2));
      console.log(`${variant}/${test.id}: ${entry.response}`);
    }
  }
} finally { engine?.kill(); }
