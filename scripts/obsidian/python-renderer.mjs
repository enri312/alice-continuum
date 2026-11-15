import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('../../Backend/adapters/obsidian_note_formatter.py', import.meta.url));
const MAX_INPUT = 8 * 1024 * 1024;
const MAX_OUTPUT = 32 * 1024 * 1024;

// Node retains policy and JS serialization; Python receives only prepared strings.
export function prepareNoteJob(id, label, storage, record) {
  const states = [`Vigencia: ${record.memoryStatus ?? 'sin evaluacion explicita'}`,
    `Accesibilidad: ${record.accessibilityStatus ?? 'sin evaluacion explicita'}`,
    `Supresion: ${record.suppressionStatus ?? 'sin supresion declarada'}`,
    `Archivo: ${record.archiveStatus ?? (record.memoryStatus === 'archived' ? 'archived' : 'sin archivo declarado')}`];
  if (typeof record.active === 'boolean') {
    states.push(`Uso automatico: ${record.active ? 'activo' : 'retirado del contexto'}`);
    states.push(`Correccion del propietario: ${record.ownerCorrected ? 'si' : 'no'}`);
  }
  return { id, label, storage, states, topic: String(record.intention ?? record.content),
    content: String(record.summary ?? record.content ?? 'Sin resumen guardado.'),
    provenance: String(record.source ?? record.sourceExchangeId ?? 'Ver registro tecnico.'),
    technicalJson: JSON.stringify(record, null, 2) };
}

function runBatch(jobs, options) {
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, notes: jobs }));
  if (bytes.length > MAX_INPUT) throw Error('El lote para Python supera 8 MiB; no se ha escrito la boveda.');
  const executable = options.pythonExecutable ?? process.env.ALICE_PYTHON_BIN ?? path.join(options.projectRoot,
    process.platform === 'win32' ? 'runtime/venv/Scripts/python.exe' : 'runtime/venv-linux/bin/python');
  if (typeof executable !== 'string' || !path.isAbsolute(executable)) throw Error('Python requiere una ruta absoluta.');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/(api[_-]?key|token|secret|pass(word|wd)?|cookie|authorization|credential|proxy|access[_-]?key|private[_-]?key)/i.test(name)
    && !/^(ALICE_|FISH_|OPENAI_|ANTHROPIC_|GEMINI_|XAI_|OPENROUTER_|DEEPSEEK_)/.test(name)));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-I', '-B', worker], { cwd: options.projectRoot, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let failure;
    let size = 0;
    const chunks = [];
    const stop = message => { failure ??= Error(message); child.kill(); };
    const interrupt = () => stop('Formateo Python cancelado; no se ha escrito la boveda.');
    const timeout = setTimeout(() => stop('Python supero 10 segundos; no se ha escrito la boveda.'), 10000);
    process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
    child.once('error', () => { failure = Error('No se pudo iniciar Python; revisa runtime/venv o ALICE_PYTHON_BIN.'); });
    child.stdin.on('error', () => {});
    child.stderr.on('data', () => {}); // Consume without leaking note text or traceback details.
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_OUTPUT) stop('La respuesta Python supera 32 MiB; no se ha escrito la boveda.');
      else chunks.push(chunk);
    });
    child.once('close', code => {
      clearTimeout(timeout); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
      if (failure) return reject(failure);
      if (code !== 0) return reject(Error('Python rechazo el lote; no se ha escrito la boveda.'));
      try {
        const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        if (!result || Object.keys(result).sort().join(',') !== 'notes,schemaVersion' || result.schemaVersion !== 1
          || !Array.isArray(result.notes) || result.notes.length !== jobs.length
          || result.notes.some((note, index) => !note || Object.keys(note).sort().join(',') !== 'id,markdown'
            || note.id !== jobs[index].id || typeof note.markdown !== 'string')) throw Error();
        resolve(result.notes.map(note => note.markdown));
      } catch { reject(Error('Respuesta Python invalida; no se ha escrito la boveda.')); }
    });
    child.stdin.end(bytes);
  });
}

export async function renderNotesWithPython(jobs, options) {
  const notes = [];
  // At most one short-lived worker per batch, never one per note or per poll.
  for (let index = 0; index < jobs.length; index += 1000) notes.push(...await runBatch(jobs.slice(index, index + 1000), options));
  return notes;
}
