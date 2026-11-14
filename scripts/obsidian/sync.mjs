/** Private, one-way projection. JSON remains the application's source of truth. */
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "alice-continuum-obsidian-sync";
const MANAGED = "Alice (sincronizado)";
const MARKER = ".alice-obsidian-owner";
const MANIFEST = ".alice-obsidian-manifest.json";
const SOURCE_LIMIT = 8 * 1024 * 1024;
const NOTE_LIMIT = 512 * 1024;
const SOURCE_LABELS = ["recuerdos confirmados", "recuerdos automaticos", "perfil"];
const STUDY_TRACKS = ["arithmetic", "algebra", "geometry", "trigonometry", "calculus", "linear-algebra", "probability", "statistics", "logic", "biblical-history", "emotional-intelligence", "empathy", "solidarity", "humility", "critical-thinking", "ethics"];
const STUDY_LABELS = { arithmetic: "Aritmética", algebra: "Álgebra", geometry: "Geometría", trigonometry: "Trigonometría", calculus: "Cálculo", "linear-algebra": "Álgebra lineal", probability: "Probabilidad", statistics: "Estadística", logic: "Lógica", "biblical-history": "Historia bíblica católica", "emotional-intelligence": "Psicología e inteligencia emocional", empathy: "Empatía", solidarity: "Solidaridad", humility: "Humildad", "critical-thinking": "Pensamiento crítico", ethics: "Ética" };
const STUDY_PHASES = { idle: "Preparado para estudiar", studying: "Estudiando", completed: "Ciclo aprobado", partial: "Ciclo con ejercicios para repasar", deferred: "Estudio aplazado", error: "Requiere revisar el motor o los datos", disabled: "Pausado" };
const inFlight = new Map();
class SyncError extends Error {}
const fail = (message) => { throw new SyncError(message); };
const hash = (value) => createHash("sha256").update(value).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;

async function statOrMissing(file) {
  try { return await fs.lstat(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

// Check every ancestor, including configured roots: junctions must not redirect
// private reads or writes outside the chosen project/data directory.
async function noLinks(file) {
  const absolute = path.resolve(file);
  const root = path.parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await statOrMissing(current);
    if (!stat) break;
    if (stat.isSymbolicLink()) fail("Se rechazo un enlace simbolico en las rutas de sincronizacion.");
  }
}

async function readBounded(file, maximum, label) {
  await noLinks(file);
  const stat = await statOrMissing(file);
  if (!stat) return null;
  if (!stat.isFile() || stat.size > maximum) fail(`Fuente no admitida o demasiado grande: ${label}.`);
  const bytes = await fs.readFile(file);
  if (bytes.length > maximum) fail(`Fuente demasiado grande: ${label}.`);
  return bytes;
}

async function readJson(file, label, maximum = SOURCE_LIMIT) {
  const bytes = await readBounded(file, maximum, label);
  if (bytes === null) return null;
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail(`JSON o UTF-8 no valido: ${label}.`); }
}

function records(value, maximum, label, required) {
  if (!Array.isArray(value) || value.length > maximum) fail(`Lista de registros no valida: ${label}.`);
  const ids = new Set();
  for (const record of value) {
    if (!object(record) || !text(record.id) || record.id.length > 512
      || ids.has(record.id.trim()) || required.some((key) => !text(record[key]))) {
      fail(`Registro incompleto o identificador duplicado: ${label}.`);
    }
    ids.add(record.id.trim());
  }
  return value;
}

function validateConfirmed(value) {
  if (value === null) return [];
  const list = records(value, 10_000, SOURCE_LABELS[0], ["kind", "intention", "startedAt"]);
  for (const record of list) {
    if (!["Facultad", "Proyecto", "Investigacion", "Investigación", "Juego", "Conversacion", "Conversación", "Enseñanza"].includes(record.kind)) {
      fail("Tipo de recuerdo confirmado no admitido.");
    }
    for (const [key, allowed] of Object.entries({
      memoryType: ["semantic", "procedural", "preference", "episodic"],
      memoryStatus: ["confirmed", "conflict", "archived"],
      accessibilityStatus: ["accessible", "dormant"],
      suppressionStatus: ["suppressed"], archiveStatus: ["archived"], deletionStatus: ["scheduled"],
    })) {
      if (record[key] != null && !allowed.includes(record[key])) fail("Estado de recuerdo confirmado no admitido.");
    }
    for (const key of ["summary", "nextStep", "source", "finishedAt"]) {
      if (record[key] != null && typeof record[key] !== "string") fail("Texto de recuerdo confirmado no valido.");
    }
  }
  return list;
}

function validateAutomatic(value) {
  if (value === null) return [];
  if (!object(value) || value.schemaVersion !== 1 || typeof value.enabled !== "boolean"
    || !Array.isArray(value.decisions) || value.decisions.length > 1000) fail("Documento de memoria automatica no valido.");
  const list = records(value.records, 2000, SOURCE_LABELS[1], ["evidence", "content", "memoryType", "reason", "sourceExchangeId", "sourceSha256", "createdAt", "updatedAt"]);
  for (const record of list) {
    if (typeof record.active !== "boolean" || typeof record.ownerCorrected !== "boolean"
      || !["semantic", "procedural", "preference", "episodic"].includes(record.memoryType)
      || !Number.isInteger(record.importance) || record.importance < 1 || record.importance > 5
      || !/^sha256:[a-f0-9]{64}$/i.test(record.sourceSha256)
      || [...record.evidence].length > 320 || [...record.content].length > 1000) fail("Registro automatico no valido.");
  }
  return list;
}

function validateProfile(value) {
  if (value === null) return [];
  if (!object(value) || value.schemaVersion !== 1 || !text(value.ownerName)
    || !text(value.confirmedBy) || !text(value.confirmedAt)
    || !Array.isArray(value.sourceFiles) || value.sourceFiles.length === 0 || value.sourceFiles.length > 64
    || value.sourceFiles.some((source) => !object(source) || !text(source.file) || !/^sha256:[a-f0-9]{64}$/i.test(source.sha256))) {
    fail("Documento de perfil no valido.");
  }
  const list = records(value.records, 64, SOURCE_LABELS[2], ["kind", "intention", "summary", "source", "memoryStatus"]);
  if (list.length === 0 || list.some((record) => record.kind !== "Perfil" || record.memoryStatus !== "confirmed")) fail("Registros de perfil no validos.");
  return list;
}

function validateStudy(value) {
  if (value === null) return [];
  const keys = ["schemaVersion", "enabled", "biblicalTradition", "phase", "lastStartedAt", "lastCompletedAt", "lastError", "records"];
  const recordKeys = ["id", "lessonId", "track", "domain", "title", "content", "sourceUrl", "sourceTitle", "lessonSha256", "studiedAt", "attempts", "passes", "lastPassed", "active"];
  const exactKeys = (item, allowed) => object(item) && Object.keys(item).length === allowed.length && allowed.every(key => Object.hasOwn(item, key));
  const date = item => typeof item === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(item) && Number.isFinite(Date.parse(item));
  const bounded = (item, maximum) => text(item) && [...item].length <= maximum;
  const uint = item => Number.isSafeInteger(item) && item >= 0 && item <= 0xffff_ffff;
  const source = item => {
    if (!bounded(item, 2048)) return false;
    try { const url = new URL(item); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
  };
  if (!exactKeys(value, keys) || value.schemaVersion !== 1 || typeof value.enabled !== "boolean" || value.biblicalTradition !== "catholic"
    || !["idle", "studying", "completed", "partial", "deferred", "error", "disabled"].includes(value.phase)
    || ![value.lastStartedAt, value.lastCompletedAt].every(item => item === null || date(item))
    || !(value.lastError === null || bounded(value.lastError, 2000))) fail("Documento de autoestudio no valido.");
  const list = records(value.records, 48, "autoestudio", ["lessonId", "track", "domain", "title", "content", "sourceUrl", "sourceTitle", "lessonSha256", "studiedAt"]);
  for (const record of list) {
    if (!exactKeys(record, recordKeys) || !/^[a-z0-9-]{1,96}$/.test(record.lessonId) || record.id !== `study:${record.lessonId}`
      || !STUDY_TRACKS.includes(record.track) || record.domain !== (STUDY_TRACKS.indexOf(record.track) < 9 ? "mathematics" : record.track)
      || !bounded(record.title, 240) || !bounded(record.content, 8000) || !bounded(record.sourceTitle, 300) || !source(record.sourceUrl)
      || !/^sha256:[a-f0-9]{64}$/i.test(record.lessonSha256) || !date(record.studiedAt)
      || !uint(record.attempts) || !uint(record.passes) || record.attempts < 1 || record.passes > record.attempts
      || typeof record.active !== "boolean" || typeof record.lastPassed !== "boolean" || (record.lastPassed && record.passes === 0)) fail("Leccion de autoestudio invalida o materia fuera del alcance.");
  }
  return list;
}

function safeRelative(relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\\") || path.posix.isAbsolute(relative)) fail("Ruta administrada no valida.");
  for (const part of relative.split("/")) {
    if (!part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part)
      || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) fail("Ruta administrada no valida.");
  }
  if (!relative.toLowerCase().endsWith(".md")) fail("Extension administrada no valida.");
  return relative;
}

function fence(value) {
  const content = String(value);
  const runs = content.match(/`+/g) ?? [];
  const delimiter = "`".repeat(runs.reduce((longest, run) => Math.max(longest, run.length + 1), 3));
  return `${delimiter}text\n${content}\n${delimiter}\n`;
}
const alias = (value) => String(value).replace(/[^\p{L}\p{N} .,_:-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 110) || "Nota";
const wiki = (relative, title) => `[[${MANAGED}/${relative.slice(0, -3)}|${alias(title)}]]`;
const inertHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function recordNote(label, source, record) {
  const states = [
    `Vigencia: ${record.memoryStatus ?? "sin evaluacion explicita"}`,
    `Accesibilidad: ${record.accessibilityStatus ?? "sin evaluacion explicita"}`,
    `Supresion: ${record.suppressionStatus ?? "sin supresion declarada"}`,
    `Archivo: ${record.archiveStatus ?? (record.memoryStatus === "archived" ? "archived" : "sin archivo declarado")}`,
  ];
  if (typeof record.active === "boolean") {
    states.push(`Uso automatico: ${record.active ? "activo" : "retirado del contexto"}`);
    states.push(`Correccion del propietario: ${record.ownerCorrected ? "si" : "no"}`);
  }
  return `# ${label}\n\nCopia de consulta del proyecto. Editar esta nota no cambia la memoria de Alice.\n`
    + `Los estados se conservan como datos; esta vista no incorpora recuerdos al contexto.\n\n`
    + `## Tema\n\n${fence(record.intention ?? record.content)}\n`
    + `## Contenido\n\n${fence(record.summary ?? record.content ?? "Sin resumen guardado.")}\n`
    + `## Estado en Alice\n\n${fence(states.join("\n"))}\n`
    + `## Procedencia\n\n${fence(record.source ?? record.sourceExchangeId ?? "Ver registro tecnico.")}\n`
    + `## Fuente de almacenamiento\n\n${fence(source)}\n## Registro tecnico\n\n${fence(JSON.stringify(record, null, 2))}`;
}

async function walkNotes(directory, relative = "", result = [], depth = 0) {
  if (depth > 16) fail("Las notas existentes superan la profundidad admitida.");
  await noLinks(directory);
  const stat = await statOrMissing(directory);
  if (!stat) return result;
  if (!stat.isDirectory()) fail("La carpeta de notas existentes no es valida.");
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink() || entry.name === ".obsidian") continue;
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walkNotes(path.join(directory, entry.name), rel, result, depth + 1);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      if (result.length >= 500) fail("Las notas existentes superan el limite de 500.");
      const bytes = await readBounded(path.join(directory, entry.name), NOTE_LIMIT, "nota existente");
      try { result.push([rel, new TextDecoder("utf-8", { fatal: true }).decode(bytes)]); }
      catch { fail("Una nota existente no contiene UTF-8 valido."); }
    }
  }
  return result;
}

async function prepare(dataRoot) {
  const memory = path.join(dataRoot, "memory");
  const [confirmedSource, automaticSource, profileSource, studySource] = await Promise.all([
    readJson(path.join(memory, "records.json"), SOURCE_LABELS[0]),
    readJson(path.join(memory, "automatic-v1.json"), SOURCE_LABELS[1]),
    readJson(path.join(memory, "owner-profile.json"), SOURCE_LABELS[2]),
    readJson(path.join(memory, "self-study-v1.json"), "autoestudio"),
  ]);
  const confirmed = validateConfirmed(confirmedSource);
  const automatic = validateAutomatic(automaticSource);
  const profile = validateProfile(profileSource);
  const study = validateStudy(studySource);
  const legacy = await walkNotes(path.join(memory, "notes"));
  if (legacy.reduce((sum, [, content]) => sum + Buffer.byteLength(content), 0) > 16 * 1024 * 1024) fail("Las notas existentes superan el limite total de 16 MiB.");
  const legacySessions = confirmedSource === null && (await statOrMissing(path.join(memory, "sessions.json")))?.isFile();
  const files = new Map();
  const caseNames = new Set();
  const add = (relative, content) => {
    safeRelative(relative);
    const key = relative.toLowerCase();
    if (caseNames.has(key)) fail("Dos notas producen la misma ruta de destino.");
    caseNames.add(key);
    files.set(relative, content);
  };
  const index = ["# Recuerdos sincronizados", "", "Vista privada de los datos del proyecto. La sincronizacion es de Alice hacia Obsidian.",
    "", "## Origen de los recuerdos", "", fence(memory),
    `- ${wiki("Mapa de la memoria.md", "Mapa de la memoria guardada")}`, "",
    "Editar una copia genera un conflicto; mover la nota fuera de esta carpeta permite conservarla como nota manual.",
    "Los recuerdos retirados, en reposo, suprimidos o archivados mantienen sus estados. Esta vista no decide su recuperacion.", ""];
  for (const [label, folder, source, list] of [
    ["Recuerdo registrado", "Recuerdos registrados", "memory/records.json", confirmed],
    ["Recuerdo automatico", "Recuerdos automaticos", "memory/automatic-v1.json", automatic],
    ["Dato de perfil", "Perfil", "memory/owner-profile.json", profile],
  ]) {
    index.push(`## ${folder} (${list.length})`, "");
    for (const record of [...list].sort((a, b) => a.id.localeCompare(b.id))) {
      const relative = `${folder}/${hash(record.id)}.md`;
      add(relative, recordNote(label, source, record));
      index.push(`- ${wiki(relative, record.intention ?? record.content)}`);
    }
    if (list.length === 0) index.push("Sin registros en esta fuente.");
    index.push("");
  }
  // The profile header also preserves owner confirmation and source references.
  if (profileSource !== null) {
    const header = { ...profileSource };
    delete header.records;
    add("Perfil/Confirmacion del perfil.md", `# Confirmacion del perfil\n\n${fence(JSON.stringify(header, null, 2))}`);
  }
  index.push(`## Autoestudio (${study.length})`, "", "Fuentes del curriculo permitido; no son declaraciones de Carlos ni recuerdos confirmados por el propietario.", "");
  for (const record of [...study].sort((a, b) => a.id.localeCompare(b.id))) {
    const relative = `Autoestudio/${hash(record.id)}.md`;
    const eligible = record.active && record.lastPassed && record.passes > 0;
    add(relative, `# Leccion de autoestudio\n\nCopia de consulta. Editar esta nota no cambia el aprendizaje de Alice.\n\n`
      + `Estado para conversacion: ${eligible ? "activa; ultimo ejercicio aprobado" : "fuera del contexto; retirada o ultimo ejercicio no aprobado"}.\n`
      + "Aprobar un ejercicio no demuestra dominio general ni verifica todos los hechos de la fuente.\n\n"
      + `## Tema\n\n${fence(record.title)}\n## Contenido\n\n${fence(record.content)}\n## Fuente\n\n${fence(`${record.sourceTitle}\n${record.sourceUrl}\n${record.lessonSha256}`)}\n`
      + `## Registro completo\n\n${fence(JSON.stringify(record, null, 2))}`);
    index.push(`- ${wiki(relative, record.title)} (${eligible ? "disponible" : "fuera del contexto"})`);
  }
  if (studySource !== null) {
    const progress = "Autoestudio/Progreso del curriculo.md";
    add(progress, "# Progreso del curriculo\n\nAutoestudio de fuentes curadas, separado de las declaraciones del propietario.\n\n"
      + `Tradicion biblica: catolica. Estado: ${STUDY_PHASES[studySource.phase]}. Autoestudio: ${studySource.enabled ? "habilitado" : "pausado"}.\n\n`
      + "| Materia | Lecciones registradas | Disponibles para conversacion | Intentos | Aprobados |\n| --- | ---: | ---: | ---: | ---: |\n"
      + STUDY_TRACKS.map(track => {
        const list = study.filter(record => record.track === track);
        return `| ${STUDY_LABELS[track]} | ${list.length} | ${list.filter(record => record.active && record.lastPassed && record.passes > 0).length} | ${list.reduce((sum, record) => sum + record.attempts, 0)} | ${list.reduce((sum, record) => sum + record.passes, 0)} |`;
      }).join("\n") + "\n\nLos resultados solo comprueban los ejercicios realizados, no el dominio general de una materia.\n");
    index.push("", `- ${wiki(progress, "Progreso del curriculo")}`, "");
  } else index.push("Sin registros de autoestudio en esta fuente.", "");
  for (const [relative, content] of legacy) add(`Fuentes existentes/${relative}`, inertHtml(content));
  add("Mapa de la memoria.md", "# Mapa de la memoria guardada\n\nOrigen de los datos que muestra esta boveda:\n\n" + fence(memory)
    + "\n| Origen | Funcion | Registros o notas |\n| --- | --- | ---: |\n"
    + `| records.json | Recuerdos y ensenanzas registrados | ${confirmed.length} |\n`
    + `| automatic-v1.json | Selecciones automaticas de conversaciones | ${automatic.length} |\n`
    + `| owner-profile.json | Perfil confirmado del propietario | ${profile.length} |\n`
    + `| self-study-v1.json | Lecciones e intentos de autoestudio | ${study.length} |\n`
    + `| notes/ | Fuentes Markdown existentes | ${legacy.length} |\n\n`
    + "Los respaldos, revisiones, auditorias e indices conservan sus funciones en la carpeta original. No se vuelven a importar como recuerdos nuevos.\n\n"
    + (legacySessions ? "Existe sessions.json de una version anterior y todavia falta records.json. Abre Alice para validar la migracion; esta vista no duplica ni migra esos datos por su cuenta.\n\n"
      : "sessions.json y sus respaldos pertenecen al formato anterior. Alice migra sessions.json solo cuando records.json no existe, conservando la fuente.\n\n")
    + `${wiki("Recuerdos sincronizados.md", "Consultar recuerdos y fuentes")}\n`);
  index.push(`## Fuentes existentes (${legacy.length})`, "", ...legacy.map(([relative]) => `- ${wiki(`Fuentes existentes/${relative}`, path.posix.basename(relative, ".md"))}`), "");
  add("Recuerdos sincronizados.md", index.join("\n"));
  return { files, memoryPath: memory, confirmedCount: confirmed.length, automaticCount: automatic.length, profileCount: profile.length, studyCount: study.length, legacyNoteCount: legacy.length };
}

function validateManifest(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.owner !== OWNER || !object(value.files)
    || Object.keys(value.files).length > 13_000) fail("El manifiesto administrado no es valido.");
  const seen = new Set();
  for (const [relative, digest] of Object.entries(value.files)) {
    safeRelative(relative);
    if (seen.has(relative.toLowerCase()) || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) fail("El manifiesto administrado contiene rutas o huellas invalidas.");
    seen.add(relative.toLowerCase());
  }
  return value.files;
}

async function atomicWrite(file, content) {
  await noLinks(file);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await noLinks(file);
  const temporary = path.join(path.dirname(file), `.alice-sync-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, content, { flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

async function seedVault(vaultPath) {
  for (const [relative, content] of [
    ["Inicio.md", `# Cerebro de Alice\n\nBoveda privada de la memoria guardada en data/memory.\n\n- ${wiki("Recuerdos sincronizados.md", "Recuerdos sincronizados")}\n- ${wiki("Mapa de la memoria.md", "Mapa de la memoria guardada")}\n\nLa sincronizacion va desde Alice hacia Obsidian. Los JSON siguen siendo la fuente de la aplicacion.\nEditar las copias no cambia los recuerdos; crear notas manuales fuera de Alice (sincronizado).\n`],
    [".obsidian/app.json", "{}\n"],
  ]) {
    const file = path.join(vaultPath, ...relative.split("/"));
    await noLinks(file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await noLinks(file);
    try { await fs.writeFile(file, content, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
}

async function synchronize(options) {
  if (!object(options) || !text(options.projectRoot) || (options.dataRoot !== undefined && !text(options.dataRoot))) fail("Se requiere una ruta de proyecto valida.");
  const projectRoot = path.resolve(options.projectRoot);
  const dataRoot = path.resolve(options.dataRoot ?? process.env.ALICE_DATA_DIR ?? path.join(projectRoot, "data"));
  await noLinks(projectRoot);
  await noLinks(dataRoot);
  if (!(await statOrMissing(projectRoot))?.isDirectory()) fail("La carpeta del proyecto no existe.");
  const prepared = await prepare(dataRoot); // Validate every source before writing anything.
  const vaultPath = path.join(dataRoot, "obsidian");
  const managed = path.join(vaultPath, MANAGED);
  await noLinks(managed);
  const managedStat = await statOrMissing(managed);
  if (managedStat && !managedStat.isDirectory()) fail("El destino administrado no es una carpeta.");
  const marker = await readBounded(path.join(managed, MARKER), 256, "marcador administrado");
  let previous = {};
  if (marker !== null) {
    if (marker.toString("utf8") !== `${OWNER}\n`) fail("La carpeta administrada pertenece a otra fuente.");
    const manifest = await readJson(path.join(managed, MANIFEST), "manifiesto administrado", 2 * 1024 * 1024);
    if (manifest === null) fail("Falta el manifiesto administrado; se conservaron las notas.");
    previous = validateManifest(manifest);
  } else if (managedStat && (await fs.readdir(managed)).length > 0) {
    fail("El destino contiene notas sin marcador de propiedad; se conservaron sin cambios.");
  }
  const current = new Map();
  for (const relative of new Set([...Object.keys(previous), ...prepared.files.keys()])) {
    const file = path.join(managed, ...relative.split("/"));
    const bytes = await readBounded(file, 16 * 1024 * 1024, "nota administrada");
    if (bytes !== null && previous[relative] === undefined) fail("Una nota manual ocupa una ruta administrada; se conservo sin cambios.");
    if (bytes !== null && hash(bytes) !== previous[relative]) fail("Hay una nota administrada editada manualmente; moverla fuera de Alice (sincronizado) antes de reintentar.");
    current.set(relative, bytes === null ? null : hash(bytes));
  }
  const next = Object.fromEntries([...prepared.files].map(([relative, content]) => [relative, hash(content)]));
  let changed = marker === null || JSON.stringify(previous) !== JSON.stringify(next);
  await fs.mkdir(managed, { recursive: true });
  for (const [relative, content] of prepared.files) {
    if (current.get(relative) !== next[relative]) {
      await atomicWrite(path.join(managed, ...relative.split("/")), content);
      changed = true;
    }
  }
  for (const relative of Object.keys(previous)) {
    if (!prepared.files.has(relative) && current.get(relative) !== null) {
      await noLinks(path.join(managed, ...relative.split("/")));
      await fs.unlink(path.join(managed, ...relative.split("/")));
      changed = true;
    }
  }
  if (changed) {
    await atomicWrite(path.join(managed, MANIFEST), `${JSON.stringify({ schemaVersion: 1, owner: OWNER, files: next }, null, 2)}\n`);
    if (marker === null) await atomicWrite(path.join(managed, MARKER), `${OWNER}\n`);
  }
  await seedVault(vaultPath);
  const { files: _files, ...counts } = prepared;
  return { vaultPath, ...counts, changed };
}

/** Export validated sources without modifying the application's JSON stores. */
export async function syncObsidianVault(options) {
  const key = path.resolve(options?.dataRoot ?? process.env.ALICE_DATA_DIR ?? path.join(options?.projectRoot ?? ".", "data"));
  const earlier = inFlight.get(key) ?? Promise.resolve();
  const pending = earlier.catch(() => {}).then(() => synchronize(options)).catch((error) => {
    if (error instanceof SyncError) throw error;
    throw new SyncError("No se pudo actualizar la boveda de Obsidian; se conservaron las fuentes originales.");
  });
  inFlight.set(key, pending);
  try { return await pending; }
  finally { if (inFlight.get(key) === pending) inFlight.delete(key); }
}

/** Background development helper; no overlapping polls and no process keepalive. */
export function startObsidianSync(options) {
  let closed = false;
  let pending;
  let lastError;
  const tick = () => {
    if (closed || pending) return;
    pending = (async () => {
      try { await syncObsidianVault(options); lastError = undefined; }
      catch (error) {
        if (lastError !== error.message) console.error(`[Obsidian] ${error.message}`);
        lastError = error.message;
      } finally { pending = undefined; }
    })();
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, 2000);
  timer.unref();
  return { async close() { closed = true; clearInterval(timer); await pending; } };
}

async function cli() {
  const options = { projectRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..") };
  let watch = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--watch") watch = true;
    else if (argument === "--project-root" || argument === "--data-root") {
      const value = args[++index];
      if (!value || value.startsWith("--")) fail("Falta una ruta en las opciones de sincronizacion.");
      options[argument === "--project-root" ? "projectRoot" : "dataRoot"] = value;
    } else fail("Opcion de sincronizacion no admitida.");
  }
  const result = await syncObsidianVault(options);
  const { vaultPath: _vaultPath, ...counts } = result;
  console.log(JSON.stringify(counts));
  if (watch) {
    const watcher = startObsidianSync(options);
    const keepalive = setInterval(() => {}, 60_000);
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await watcher.close(); clearInterval(keepalive); });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => { console.error(`[Obsidian] ${error instanceof SyncError ? error.message : "No se pudo sincronizar la boveda."}`); process.exitCode = 1; });
}
