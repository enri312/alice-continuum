// Offline, one-shot analysis. Never starts a model or opens an Alice data store.
import { spawnSync } from 'node:child_process';
import { closeSync, fstatSync, openSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const worker = path.join(root, 'Backend/adapters/r8_rerank_report.py');
const MAX_INPUT = 1024 * 1024;
const reportKeys = ['realConfirmedProfileRecords', 'lexicalTop1', 'lexicalTop3', 'gemmaRerankTop1',
  'gemmaRerankTop3', 'totalRerankLatencyMs', 'meanRerankLatencyMs', 'sourcePreserved', 'indexPersisted'];

export function resolveRerankPython(options = {}) {
  const executable = options.pythonExecutable ?? process.env.ALICE_PYTHON_BIN ?? path.join(root,
    process.platform === 'win32' ? 'runtime/venv/Scripts/python.exe' : 'runtime/venv-linux/bin/python');
  if (typeof executable !== 'string' || !path.isAbsolute(executable)) throw Error('Python requiere una ruta absoluta.');
  try { if (!statSync(executable).isFile()) throw Error(); }
  catch { throw Error('Falta Python para el informe R8; configura runtime/venv o ALICE_PYTHON_BIN.'); }
  return executable;
}

export function createRerankReport(request, options = {}) {
  return runReport(Buffer.from(JSON.stringify(request)), request, options);
}

function runReport(input, request, options) {
  const executable = resolveRerankPython(options);
  if (input.length > MAX_INPUT) throw Error('El informe R8 supera 1 MiB de entrada.');
  const timeout = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 10000) throw Error('Tiempo de informe R8 invalido.');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(api[_-]?key|token|secret|pass(word|wd)?|cookie|authorization|credential|proxy|access[_-]?key|private[_-]?key)/i.test(name)
    && !/^(ALICE_|FISH_|OPENAI_|ANTHROPIC_|GEMINI_|XAI_|OPENROUTER_|DEEPSEEK_)/.test(name)));
  const result = spawnSync(executable, ['-I', '-B', worker], {
    cwd: root, input, env, windowsHide: true, timeout, maxBuffer: 16 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.error?.code === 'ETIMEDOUT') throw Error('Python supero el tiempo del informe R8.');
  if (result.error || result.status !== 0) throw Error('Python no pudo generar el informe R8; no se ha guardado ningun informe.');
  try {
    const report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.stdout));
    if (!report || Object.keys(report).sort().join(',') !== [...reportKeys].sort().join(',')
      || report.realConfirmedProfileRecords !== request.rankings.length
      || report.totalRerankLatencyMs !== request.totalRerankLatencyMs
      || report.sourcePreserved !== request.sourcePreserved || report.indexPersisted !== false
      || !Number.isInteger(report.meanRerankLatencyMs) || report.meanRerankLatencyMs < 0
      || report.meanRerankLatencyMs > request.totalRerankLatencyMs
      || ['lexicalTop1', 'lexicalTop3', 'gemmaRerankTop1', 'gemmaRerankTop3']
        .some(key => typeof report[key] !== 'number' || !Number.isFinite(report[key]) || report[key] < 0 || report[key] > 1)) throw Error();
    return report;
  } catch { throw Error('Python devolvio un informe R8 invalido.'); }
}

function cli() {
  if (process.argv.length !== 4 || process.argv[2] !== '--input') throw Error('Uso: npm run eval:r8:report -- --input <rankings.json>');
  const descriptor = openSync(path.resolve(process.argv[3]), 'r');
  let input, request;
  try {
    if (!fstatSync(descriptor).isFile()) throw Error('La entrada R8 debe ser un archivo.');
    const bytes = Buffer.alloc(MAX_INPUT + 1);
    let size = 0, read;
    while (size < bytes.length && (read = readSync(descriptor, bytes, size, bytes.length - size, null)) > 0) size += read;
    if (size > MAX_INPUT) throw Error('El informe R8 supera 1 MiB de entrada.');
    input = bytes.subarray(0, size);
    request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input));
    // Send the original bytes so Python can reject duplicate keys as well.
  } finally { closeSync(descriptor); }
  console.log(JSON.stringify(runReport(input, request, {}), null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(); } catch { console.error('No se pudo generar el informe R8. Revisa la entrada y la ruta absoluta de Python.'); process.exitCode = 1; }
}
