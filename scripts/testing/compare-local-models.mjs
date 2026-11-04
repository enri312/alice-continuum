// Real local inference on controlled cases. Never calls Alice's memory/chat writers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const BASE = 'http://127.0.0.1:11434';
const models = process.argv.slice(2);
assert(models.length && models.every(m => ['qwen3.5:4b', 'granite4.1:3b', 'gemma4:e2b'].includes(m)));
const code = fs.readFileSync('src-tauri/src/cloud.rs', 'utf8');
const system = JSON.parse('"' + code.match(/const SYSTEM_PROMPT: &str = "(.*)";/)[1] + '"');
async function request(route, data, timeout = 90000) {
  const response = await fetch(BASE + route, { method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
  return response.json();
}
const cases = [
  { id: 'current_context', messages: [
    { role: 'user', content: 'Trabajamos en Alice: el avatar ya existe. Las gafas Quest Pro quedan para el futuro. No toques app-alice.svg. OpenRouter está pausado; usamos Ollama local.' },
    { role: 'assistant', content: 'Entendido: preservamos el icono y continuamos localmente.' },
    { role: 'user', content: 'Responde sólo un JSON con proveedor, archivoProtegido y gafas. Usa gafas="futuro" si aún no las tenemos.' },
  ], expected: { proveedor: 'Ollama', archivoProtegido: 'app-alice.svg', gafas: 'futuro' } },
  { id: 'correction', messages: [
    { role: 'user', content: 'La prioridad es mejorar los iconos y usar OpenRouter.' },
    { role: 'assistant', content: 'Anotado como contexto de esta conversación.' },
    { role: 'user', content: 'Cambio: preserva los iconos. La prioridad ahora es memoria real y búsqueda semántica con Ollama. No estamos entrenando los pesos del modelo.' },
    { role: 'user', content: 'Devuelve sólo JSON: prioridad="memoria", proveedor="Ollama", cambiarIconos=false y entrenarPesos=false, de acuerdo con la última decisión.' },
  ], expected: { prioridad: 'memoria', proveedor: 'Ollama', cambiarIconos: false, entrenarPesos: false } },
  { id: 'absence_of_evidence', messages: [
    { role: 'user', content: '¿Qué estaba viendo ahora mismo en mi pantalla y qué aprendiste de eso? En esta conversación no te envié capturas ni contenido de la pantalla. Responde en español en máximo tres frases.' },
  ] },
  { id: 'project_reasoning', messages: [
    { role: 'user', content: 'Alice conserva registros JSON y notas Markdown, pero los modelos a veces inventan información. ¿Cómo evitarías que una respuesta equivocada termine como conocimiento confirmado? Dame tres medidas concretas, sin añadir pestañas ni decir que ya las implementaste. Máximo 130 palabras.' },
  ] },
];
const report = { date: new Date().toISOString(), context: 4096, maxOutput: 350, temperature: 0.2,
  thinking: false, controlledCases: true, modelDownloads: false, memoryWrites: false, results: [] };
fs.mkdirSync('artifacts', { recursive: true });
for (const model of models) {
  const entry = { model, cases: [] };
  report.results.push(entry);
  for (const test of cases) {
    const started = performance.now();
    try {
      const result = await request('/api/chat', { model, messages: [{ role: 'system', content: system }, ...test.messages],
        stream: false, think: false, keep_alive: '2m', options: { num_ctx: 4096, num_predict: 350, temperature: 0.2, seed: 42 } });
      const text = result.message?.content ?? '';
      let exact = null;
      if (test.expected) {
        try { const answer = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
          exact = Object.entries(test.expected).every(([key, value]) => answer[key] === value);
        } catch { exact = false; }
      }
      const measurement = { case: test.id, seconds: +( (performance.now() - started) / 1000 ).toFixed(2),
        promptTokens: result.prompt_eval_count, outputTokens: result.eval_count,
        tokensPerSecond: +(result.eval_count / (result.eval_duration / 1e9)).toFixed(2),
        doneReason: result.done_reason, exact, response: text };
      entry.cases.push(measurement);
      console.log(JSON.stringify({ model, ...measurement, response: undefined }));
    } catch (error) {
      entry.cases.push({ case: test.id, error: error.message });
      console.log(JSON.stringify({ model, case: test.id, error: error.message }));
      break;
    }
    fs.writeFileSync('local/artifacts/local-model-comparison.json', JSON.stringify(report, null, 2));
  }
  entry.runtime = (await request('/api/ps')).models?.find(m => m.name === model);
  await request('/api/generate', { model, keep_alive: 0 }, 15000).catch(() => {});
  fs.writeFileSync('local/artifacts/local-model-comparison.json', JSON.stringify(report, null, 2));
}
