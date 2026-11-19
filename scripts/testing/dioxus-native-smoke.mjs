// Windows integration acceptance: a real Tauri window/IPC, isolated synthetic data.
// Requires a current build served by a loopback preview. No personal stores/keys.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

if (process.platform !== 'win32') throw Error('Esta aceptación nativa requiere Windows y WebView2.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const preview = new URL(process.env.ALICE_PREVIEW_URL ?? 'http://127.0.0.1:4173/');
if (preview.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(preview.hostname)) throw Error('El preview debe ser HTTP de loopback.');
assert.ok((await fetch(preview, { signal: AbortSignal.timeout(5000) })).ok, 'Preview disponible');
const artifactRoot = path.join(root, 'runtime/artifacts/dioxus/native');
await fs.mkdir(artifactRoot, { recursive: true });
const artifacts = await fs.mkdtemp(path.join(artifactRoot, 'dioxus-native-'));
const data = path.join(artifacts, 'data');
await fs.mkdir(path.join(data, 'memory'), { recursive: true });
const records = ['a', 'b'].map(id => ({ id, kind: 'Conversación', intention: `Experiencia nativa ${id.toUpperCase()}: aprender Rust`,
  startedAt: '2026-11-15T12:00:00Z', finishedAt: '2026-11-15T12:05:00Z',
  memoryType: 'episodic', memoryStatus: 'confirmed', source: 'owner' }));
const sourcePath = path.join(data, 'memory/records.json');
await fs.writeFile(sourcePath, JSON.stringify(records));
const profileSource = 'Fuente ficticia aprobada para probar el perfil aislado.';
const profileSourcePath = path.join(data, 'memory', 'profile-fixture.txt');
await fs.writeFile(profileSourcePath, profileSource);
await fs.writeFile(path.join(data, 'memory', 'owner-profile.json'), JSON.stringify({
  schemaVersion: 1, ownerName: 'Propietario de prueba', confirmedBy: 'Propietario de prueba', confirmedAt: '2026-11-19T12:00:00Z',
  sourceFiles: [{ file: 'profile-fixture.txt', sha256: 'sha256:' + createHash('sha256').update(profileSource).digest('hex') }],
  records: [{ id: 'profile-fixture', kind: 'Perfil', intention: 'Perfil cartográfico', summary: profileSource,
    source: 'profile-fixture.txt', memoryStatus: 'confirmed' }],
}));
await fs.writeFile(path.join(data, 'memory/automatic-v1.json'), JSON.stringify({ schemaVersion: 1, enabled: false, records: [], decisions: [] }));
await fs.writeFile(path.join(data, 'memory/self-study-v1.json'), JSON.stringify({ schemaVersion: 1, enabled: false, biblicalTradition: 'catholic', phase: 'idle',
  lastStartedAt: null, lastCompletedAt: null, lastError: null, records: [] }));
const sourceHash = createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)); });
});
const binary = path.join(root, '.cargo-target/debug/alice-continuum.exe');
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/(api[_-]?key|token|secret|pass(word|wd)?|cookie|authorization|credential|proxy|access[_-]?key|private[_-]?key)/i.test(name)
    || /^(ALICE_|FISH_|OPENAI_|ANTHROPIC_|GEMINI_|XAI_|OPENROUTER_|DEEPSEEK_|WEBVIEW2_)/.test(name)) delete env[name];
}
Object.assign(env, { ALICE_PROJECT_ROOT: root, ALICE_DATA_DIR: data, ALICE_NATIVE_TEST_EXE: binary,
  CARGO_TARGET_DIR: path.join(root, '.cargo-target'), TEMP: artifacts, TMP: artifacts,
  WEBVIEW2_USER_DATA_FOLDER: path.join(artifacts, 'webview'),
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1` });
function processes() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "@(Get-Process -Name alice-continuum -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:ALICE_NATIVE_TEST_EXE } | ForEach-Object { [pscustomobject]@{ id=$_.Id; title=$_.MainWindowTitle; handle=$_.MainWindowHandle.ToInt64() } }) | ConvertTo-Json -Compress"],
  { env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error('No se pudo comprobar el proceso nativo.');
  if (!result.stdout.trim()) return [];
  const parsed = JSON.parse(result.stdout); return Array.isArray(parsed) ? parsed : [parsed];
}
assert.equal(processes().length, 0, 'Cierra Alice antes de la prueba para evitar dos instancias del mismo ejecutable.');
preview.searchParams.delete('screen');
const config = path.join(artifacts, 'tauri.json');
await fs.writeFile(config, JSON.stringify({ build: { beforeDevCommand: '', devUrl: preview.href },
  app: { windows: [{ label: 'main', title: 'Alice Continuum — PRUEBA AISLADA DIOXUS', width: 1000, height: 800, resizable: true }] } }));
const log = await fs.open(path.join(artifacts, 'tauri.log'), 'a');
const child = spawn(process.execPath, [path.join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'dev', '--no-watch', '--config', config],
  { cwd: root, env, windowsHide: true, stdio: ['ignore', log.fd, log.fd] });
let launchError; child.on('error', error => { launchError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw Error(`Tauri terminó con código ${child.exitCode}. Registro: ${artifacts}`);
    const value = await read(); if (value) return value; await pause(200);
  }
  throw Error(`Tiempo agotado: ${label}. Registro: ${artifacts}`);
}
let socket, send, native;
try {
  const target = await until(async () => {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) }).then(response => response.json());
      return targets.find(target => target.type === 'page' && target.url.startsWith(preview.origin));
    } catch { return null; }
  }, 'arranque de Tauri/WebView2', 600000);
  native = await until(async () => {
    const list = processes(); assert.ok(list.length <= 1, 'Una sola instancia nativa');
    return list.find(process => process.handle !== 0 && process.title.includes('PRUEBA AISLADA'));
  }, 'ventana nativa visible');
  socket = new WebSocket(target.webSocketDebuggerUrl); await once(socket, 'open');
  let nextId = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id); if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result);
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId, timer = setTimeout(() => { pending.delete(id); reject(Error(`Tiempo agotado: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value;
  };
  const screenshot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(artifacts, name), Buffer.from(shot.data, 'base64'));
  };
  const flowReady = () => until(() => evaluate('document.querySelectorAll(\'[data-flow-page-renderer="dioxus"] .flow-node\').length===11'), 'Flujo nativo Dioxus');
  const clickText = text => evaluate(`Array.from(document.querySelectorAll('.memory-associations button')).find(button=>button.textContent===${JSON.stringify(text)}).click()`);
  await until(() => evaluate('document.querySelector(".dashboard-reading-status")?.textContent==="Lecturas locales"'), 'Muestras reales de CPU y red en el Dashboard de inicio');
  assert.equal(await evaluate('document.querySelector("[data-navigation-renderer]")?.dataset.navigationRenderer'), 'dioxus');
  assert.equal(await evaluate('document.querySelector("[data-dashboard-renderer]").dataset.dashboardRenderer'), 'dioxus');
  const nativeReading = await evaluate('__TAURI_INTERNALS__.invoke("system_overview")');
  assert.ok(nativeReading.memory.totalBytes > 0 && nativeReading.disk.totalBytes > 0);
  assert.ok(Number.isFinite(nativeReading.cpuPercent) && nativeReading.cpuPercent >= 0 && nativeReading.cpuPercent <= 100);
  assert.ok(nativeReading.network.receivedBytesPerSecond >= 0 && nativeReading.network.transmittedBytesPerSecond >= 0);
  assert.equal(await evaluate('document.querySelectorAll(".dashboard-metric dd").length'), 6);
  await screenshot('dashboard-native.png');
  assert.equal(await evaluate('document.querySelectorAll(".alice-dashboard textarea,.alice-dashboard form").length'), 0);
  await evaluate('document.querySelector(".dashboard-shortcut").click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[data-conversation-renderer="dioxus"] #alice-message\'))'), 'Dashboard abre Conversación en Dioxus');
  await evaluate('document.querySelector(\'button[aria-label="Flujo cognitivo"]\').click()');
  await flowReady();
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.getAttribute("aria-label")==="Conversación con Alice").click()');
  await until(() => evaluate('Boolean(document.querySelector(".conversation-page #alice-message"))'), 'Conversación nativa abre con su entrada');
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-frame")).borderRadius'), '14px', 'Tema de consola cargado en Tauri');
  assert.equal(await evaluate('document.querySelectorAll(".screen-tab-icon svg").length'), 7, 'Iconos originales presentes');
  assert.equal(await evaluate('document.querySelectorAll(".screen-tabs button").length'), 7, 'Sin controles de navegación añadidos');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-heading"),"::before").content'), 'none', 'Sin aro decorativo');
  assert.equal(await evaluate('document.querySelectorAll(".conversation-secondary-panel[open]").length'), 0, 'Herramientas secundarias plegadas');
  await evaluate('document.querySelector("#alice-message").select()');
  await send('Input.insertText', { text: 'Prueba nativa de diseño sin enviar a un modelo.' });
  await evaluate('document.querySelector(".composer-footer button").click()');
  await until(() => evaluate('Boolean(document.querySelector(".send-review"))'), 'Revisión nativa del mensaje');
  assert.ok(await evaluate('document.querySelector(".payload-detail pre").textContent.includes("Prueba nativa de diseño")'));
  await evaluate('document.querySelector(".review-actions .secondary").click()');
  await until(() => evaluate('!document.querySelector(".send-review")'), 'Cancelar conserva el borrador sin enviar');
  await evaluate('window.scrollTo(0,0)');
  await screenshot('conversation-console-native.png');
  await evaluate('document.querySelector(".dashboard-entry").click()');
  await until(() => evaluate('Boolean(document.querySelector(".dashboard-shortcut"))'), 'Vuelve al Dashboard');
  await evaluate('document.querySelector(".dashboard-shortcut").click()');
  await until(() => evaluate('document.querySelector("#alice-message")?.value==="Prueba nativa de diseño sin enviar a un modelo."'), 'El borrador queda en Conversación al volver del Dashboard');
  await evaluate('document.querySelector(\'.screen-tabs button[data-tooltip="Memoria"]\').click()');
  await until(() => evaluate('Boolean(document.querySelector(".memory-storage.storage-native"))'), 'Lectura de recuerdos locales a través de la sesión Dioxus');
  const selectMemorySection = title => evaluate(`Array.from(document.querySelectorAll('.memory-section-nav button')).find(button=>button.querySelector('strong').textContent===${JSON.stringify(title)}).click()`);
  await selectMemorySection('Aprendizaje');
  const studyToggle = 'section[aria-labelledby="self-study-title"] input';
  const automaticToggle = 'section[aria-labelledby="automatic-memory-title"] input';
  const controlState = (selector, enabled) => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)})?.matches('input:enabled:${enabled ? 'checked' : 'not(:checked)'}'))`);
  await until(() => controlState(studyToggle, false), 'Autoestudio local consultado y pausado');
  await until(() => controlState(automaticToggle, false), 'Aprendizaje automático local consultado y pausado');
  for (const enabled of [true, false]) {
    await evaluate(`document.querySelector(${JSON.stringify(automaticToggle)}).click()`);
    await until(() => controlState(automaticToggle, enabled), 'Configuración nativa de aprendizaje confirmada');
    const automaticStore = JSON.parse(await fs.readFile(path.join(data, 'memory', 'automatic-v1.json'), 'utf8'));
    assert.equal(automaticStore.enabled, enabled);
    assert.deepEqual(automaticStore.records, []);
  }
  await screenshot('learning-session-native.png');
  await selectMemorySection('Recuerdos');
  await until(() => evaluate('document.querySelectorAll(".memory-record").length===2'), 'Dos recuerdos conservados en el archivo aislado');
  assert.ok(await evaluate('document.querySelector(".memory-list").textContent.includes("Experiencia nativa A")'));
  await evaluate('document.querySelector(\'.memory-subsection-nav button[aria-label^="Perfil, 1"]\').click()');
  await until(() => evaluate('document.querySelector(".owner-profile-panel .memory-record h3")?.textContent==="Perfil cartográfico"'), 'perfil confirmado de una fuente con SHA-256');
  await selectMemorySection('En sesión');
  await until(() => evaluate('Boolean(document.querySelector(".working-memory-panel.state-empty"))'), 'La memoria de trabajo nativa empieza vacía');
  assert.ok(await evaluate('document.querySelector(".working-memory-panel button.danger").disabled'));
  await screenshot('memory-session-native.png');
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.getAttribute("aria-label")==="Flujo cognitivo").click()');
  await flowReady();
  assert.equal(await evaluate('Boolean(globalThis.__TAURI_INTERNALS__?.invoke)'), true, 'Puente nativo real presente');
  await until(() => evaluate("['idle','ready'].includes(document.querySelector('.neuro-live')?.dataset.activityState)"), 'snapshot R3 del backend real validado por Rust');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  await evaluate('document.querySelector(\'.flow-node[aria-label^="Memoria:"]\').dispatchEvent(new MouseEvent("click",{bubbles:true}))');
  await until(() => evaluate('document.querySelector(".neuro-inspector h3")?.textContent==="Memoria"'), 'inspector nativo');
  assert.equal(await evaluate('document.querySelector(".flow-node.selected")?.getAttribute("aria-pressed")'), 'true');
  await evaluate('document.querySelector(".flow-heading").scrollIntoView({block:"start"})');
  await screenshot('flujo-conexiones.png');
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.getAttribute("aria-label")==="Estado y controles").click()');
  await until(() => evaluate('Boolean(document.querySelector(\'.state-controls-host[data-renderer="dioxus"] .internal-state\'))'), 'Estado Dioxus nativo');
  await until(() => evaluate('["ready","idle"].includes(document.querySelector(".neuro-live")?.dataset.activityState)'), 'R3 nativo de Estado validado en Rust');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll(".core-activity-provenance").length'), 1);
  await evaluate('document.querySelector(".state-controls-host").scrollIntoView({block:"start"})');
  const stateScreenshot = await send('Page.captureScreenshot', {format:'png'});
  await fs.writeFile(path.join(artifacts,'state-native.png'),Buffer.from(stateScreenshot.data,'base64'));
  await evaluate('document.querySelector(\'.screen-tabs button[data-tooltip="Actividad"]\').click()');
  await until(() => evaluate('document.querySelectorAll(\'[data-activity-renderer="dioxus"] .timeline-node\').length>0'), 'página de Actividad nativa Dioxus');
  await evaluate('document.querySelector(".cognitive-timeline").scrollIntoView({block:"start"})');
  await screenshot('timeline-native.png');
  await evaluate('Array.from(document.querySelectorAll(\'[role="tab"]\')).find(button=>button.textContent.includes("EVENT STREAM")).click()');
  await until(() => evaluate('Boolean(document.querySelector(".event-console"))'), 'flujo de eventos de sesión');
  assert.equal(await evaluate('document.querySelectorAll(".activity-page").length'),1,'Un solo contenedor de Actividad');
  const activityCount=await evaluate('document.querySelectorAll(".event-row:not(.event-header)").length');
  assert.ok(activityCount>0);
  assert.equal(await evaluate('Number(document.querySelector(\'[data-tooltip="Actividad"] .screen-count\').textContent)'),activityCount);
  await evaluate('(()=>{const input=document.querySelector(\'[aria-label="Buscar eventos"]\');input.value="NO_MATCH_NATIVE_ACTIVITY";input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await until(() => evaluate('Boolean(document.querySelector(".event-empty"))'), 'filtro de eventos en Rust');
  await evaluate('(()=>{const input=document.querySelector(\'[aria-label="Buscar eventos"]\');input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await until(() => evaluate(`document.querySelectorAll('.event-row:not(.event-header)').length===${activityCount}`), 'restaurar contenido tras filtrar');
  await screenshot('activity-events-native.png');
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Limpiar vista").click()');
  await evaluate('Array.from(document.querySelectorAll(\'[role="tab"]\')).find(button=>button.textContent.includes("COGNITIVE TIMELINE")).click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[data-activity-renderer="dioxus"] .timeline-empty\'))'), 'vaciado temporal reflejado sin escribir datos');
  await until(() => evaluate('document.querySelector(\'[data-tooltip="Actividad"] .screen-count\')?.textContent==="0"'), 'contador de pestaña sincronizado');
  await evaluate('document.querySelector(".dashboard-entry").click()');
  await until(() => evaluate('Array.from(document.querySelectorAll(".dashboard-assistant-summary dt")).some(dt=>dt.textContent==="Eventos de esta sesión"&&dt.nextElementSibling?.textContent==="0")'), 'Dashboard comparte la sesión vaciada');
  await evaluate('Array.from(document.querySelectorAll(".dashboard-link")).find(button=>button.textContent.includes("Ver actividad")).click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[data-activity-renderer="dioxus"] .timeline-empty\'))'), 'vaciado conservado al volver a Actividad');
  // A controlled pair ensures keyboard selection actually changes the inspector.
  await evaluate('Array.from(document.querySelectorAll(\'[role="tab"]\')).find(button=>button.textContent.includes("EVENT STREAM")).click()');
  await evaluate('document.querySelector(".core-system-selector .governance").click()');
  await until(()=>evaluate('Boolean(document.querySelector(\'button[aria-label="Auditoría y diagnóstico"]\'))'),'gobierno para aislar teclado');
  await until(()=>evaluate('document.querySelectorAll("#registry-panel .capability-domain button").length > 0'), 'inventario de capacidades nativo');
  await evaluate('document.querySelector(\'[aria-controls="permissions-panel"]\').click()');
  await until(()=>evaluate('document.querySelector("#permission-gateway-title").checkVisibility() && document.querySelector(".permission-status")?.textContent.includes("Permisos locales actualizados")'), 'lectura de permisos nativos');
  async function permissionButton(label) {
    const selector = `Array.from(document.querySelectorAll('#permissions-panel button')).find(b => b.textContent === ${JSON.stringify(label)} && b.checkVisibility() && !b.disabled)`;
    await until(() => evaluate(`Boolean(${selector})`), label);
    await evaluate(`${selector}.click()`);
  }
  await permissionButton('PREPARAR OBSERVACIÓN');
  await permissionButton('RECHAZAR');
  await until(()=>evaluate('document.querySelector(".permission-ledger")?.textContent.includes("RECHAZADA")'), 'rechazo registrado');
  await permissionButton('PREPARAR OBSERVACIÓN');
  await permissionButton('APROBAR PERMISO');
  assert.equal(await evaluate('__TAURI_INTERNALS__.invoke("get_foreground_context")'), null, 'La aprobación por sí sola no habilita metadatos');
  await permissionButton('REVOCAR');
  await until(()=>evaluate('document.querySelector(".permission-ledger")?.textContent.includes("Revocado")'), 'permiso revocado antes de ejecución');
  assert.equal(await evaluate('__TAURI_INTERNALS__.invoke("get_foreground_context")'), null, 'Con el permiso revocado no hay metadatos');
  await screenshot('gobernanza-permisos.png');
  await evaluate('document.querySelector(\'[aria-controls="registry-panel"]\').click()');
  await evaluate('Array.from(document.querySelectorAll("#registry-panel .bridge-grid button")).find(b=>b.querySelector("strong")?.textContent==="Controlar observación de ventana").click()');
  await screenshot('gobernanza-inventario.png');
  await evaluate('document.querySelector(".bridge-inspector button").click()');
  await until(()=>evaluate('Boolean(document.querySelector(\'[data-audit-renderer="dioxus"] .native-audit\'))&&!document.querySelector("[data-activity-renderer]")'),'auditoría en Dioxus');
  await until(()=>evaluate('document.querySelector(".native-audit")?.textContent.includes("Revocación")'), 'revocación visible en auditoría de la capacidad');
  assert.ok(await evaluate('Array.from(document.querySelectorAll(".native-event-row:not(.event-header)")).every(row=>row.children[3].title.startsWith("context.foreground.control /"))'));
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".native-event-row:not(.event-header)")).some(row=>row.children[2].textContent==="Ejecución")'), false);
  await evaluate('document.querySelector(\'.screen-tabs button[aria-label="Auditoría y diagnóstico"]\').click()');
  await until(()=>evaluate('!document.querySelector(".native-audit")?.textContent.includes("Capacidad seleccionada")'), 'la pestaña vuelve a la auditoría completa');
  await evaluate('document.querySelector("#diagnostic-tab").click()');
  await until(()=>evaluate('document.querySelectorAll(".diagnostic-check").length>0'), 'lecturas nativas de diagnóstico');
  assert.equal(await evaluate('document.querySelectorAll(".diagnostic-groups>section").length'),5);
  await screenshot('diagnostico-dioxus.png');
  const timelineRuntimeFile=(await fs.readdir(path.join(root,'Frontend/dist/assets'))).find(name=>/^runtime-.*\.js$/.test(name));
  assert.ok(timelineRuntimeFile);
  const timelineRuntimeUrl=new URL(`/assets/${timelineRuntimeFile}`,preview).href;
  await evaluate(`(async()=>{
    const runtime=await(await import(${JSON.stringify(timelineRuntimeUrl)})).loadActivityPageRuntime();
    const host=document.createElement('div');host.id='native-timeline-keyboard';document.body.append(host);
    const events=[1,2].map(sequence=>({id:'native-'+sequence,sequence,timestampMs:sequence*1000,timeLabel:'10:00:0'+sequence,module:'MEMORY',level:'INFO',node:'FIXTURE-'+sequence,payload:'Evento sintético '+sequence}));
    const payload={timeline:{selectedId:'',events},streamTimes:['10:00:01,000','10:00:02,000'],requestedView:'timeline',settings:null};
    const id=await new Promise(resolve=>{const mounted=runtime.mount(host.id,JSON.stringify(payload),()=>{},()=>queueMicrotask(()=>resolve(mounted)));});
    globalThis.__nativeTimelineFixture={runtime,id};
  })()`);
  await until(() => evaluate('document.querySelector("#native-timeline-keyboard .timeline-inspector span")?.textContent.includes("SEQ 00002")'), 'selección inicial del par sintético');
  await evaluate('document.querySelector("#native-timeline-keyboard .timeline-node").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(() => evaluate('document.querySelector("#native-timeline-keyboard .timeline-inspector span")?.textContent.includes("SEQ 00001")'), 'selección por teclado modifica el inspector nativo');
  await evaluate('__nativeTimelineFixture.runtime.unmount(__nativeTimelineFixture.id); document.getElementById("native-timeline-keyboard").remove(); delete globalThis.__nativeTimelineFixture');
  await evaluate('document.querySelector(".core-system-selector .cognitive").click()');
  await until(()=>evaluate('Boolean(document.querySelector(\'button[aria-label="Flujo cognitivo"]\'))'),'regreso al núcleo cognitivo');
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.getAttribute("aria-label")==="Flujo cognitivo").click()');
  await flowReady();
  await until(() => evaluate('document.querySelectorAll(".memory-associations select").length===2'), 'fuentes nativas');
  for (const [index, id] of ['a', 'b'].entries()) {
    await evaluate(`(()=>{const select=document.querySelectorAll('.memory-associations select')[${index}]; select.value=${JSON.stringify(id)}; select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await evaluate(`document.querySelectorAll('.memory-associations textarea')[${index}].focus()`);
    await send('Input.insertText', { text: 'Rust' });
  }
  await until(() => evaluate("Array.from(document.querySelectorAll('.memory-associations button')).find(button=>button.textContent==='Revisar relación')?.matches(':enabled')"), 'revisión habilitada');
  await clickText('Revisar relación');
  await until(() => evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar relación revisada"]\'))'), 'revisión real de citas');
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations article").length'), 0, 'Revisar no guarda');
  await clickText('Confirmar y guardar relación');
  await until(() => evaluate('document.querySelectorAll(".memory-associations article").length===1'), 'relación persistida por el backend real');
  await clickText('Retirar relación');
  await until(() => evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar cambio de relación"]\'))'), 'revisión de retirada');
  await clickText('Cancelar');
  assert.equal(await evaluate('document.querySelector(".memory-associations article button").textContent'), 'Retirar relación', 'Cancelar no retira');
  await screenshot('flow-native.png');
  await send('Page.reload');
  await until(() => evaluate('Boolean(document.querySelector(".dashboard-shortcut"))'), 'Dashboard tras recarga');
  await evaluate('document.querySelector(".dashboard-shortcut").click()');
  await until(() => evaluate('Boolean(document.querySelector(\'button[aria-label="Flujo cognitivo"]\'))'), 'Flujo disponible tras abrir Conversación');
  await evaluate('document.querySelector(\'button[aria-label="Flujo cognitivo"]\').click()');
  await flowReady();
  await until(() => evaluate('document.querySelectorAll(".memory-associations article").length===1'), 'relación conservada al recargar la ventana');
  await evaluate('document.querySelector(\'button[aria-label="Volumen cognitivo"]\').click()');
  await until(() => evaluate('Array.from(document.querySelectorAll(".volume-learning-metrics dt")).some(dt => dt.textContent === "Otros recuerdos" && dt.nextElementSibling?.textContent === "2")'), 'Volumen reconoce las dos fuentes episódicas después de recargar');
  await until(() => evaluate('document.querySelector(".volume-stats-growth")?.textContent.endsWith(" · 1 ASOCIACIÓN CONFIRMADA")'), 'Volumen proyecta la relación confirmada en Flujo');
  const profileCount = count => evaluate(`Array.from(document.querySelectorAll('.volume-learning-metrics dt')).some(dt => dt.textContent === 'Perfil del propietario' && dt.nextElementSibling?.textContent === '${count}')`);
  await until(() => profileCount(1), 'Volumen muestra el perfil confirmado');
  await fs.writeFile(profileSourcePath, profileSource + ' Cambio de prueba.');
  try {
    await evaluate('document.querySelector(".volume-learning-refresh button").click()');
    await until(() => profileCount(0), 'La fuente con SHA-256 distinto excluye el perfil de la proyección');
    assert.ok(await evaluate('document.querySelector(".volume-learning-source-states").textContent.includes("La fuente privada cambió")'));
  } finally {
    await fs.writeFile(profileSourcePath, profileSource);
  }
  await evaluate('document.querySelector(".volume-learning-refresh button").click()');
  await until(() => profileCount(1), 'La fuente válida permite recuperar el perfil');
  assert.equal(createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex'), sourceHash, 'Las fuentes sintéticas no se modifican');
  const result = { passed: true, nativeWindow: true, nativePid: native.id, realIpc: true, dashboardHostTelemetry: true, conversationDraftPreserved: true, memorySession: true, learningSession: true, verifiedProfile: true, nodes: 11,
    governanceRegistryAndPermissions: true, permissionDeniedApprovedRevoked: true, noObservationFromApproval: true, capabilityAuditFilter: true, r3Validated: true, timelineDioxusKeyboardAndClear: true, relationPersistedAndReloaded: true, volumeReflectsAssociation: true, sourceUnchanged: true, isolatedData: true };
  await fs.writeFile(path.join(artifacts, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Tauri nativo: Dashboard, telemetría local, borrador, Conversación, 11 nodos, R3, navegación y persistencia de relaciones comprobados con datos aislados. Evidencia: ${artifacts}`);
} catch (error) {
  if (send && socket?.readyState === WebSocket.OPEN) {
    try { const shot = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(artifacts, 'failure.png'), Buffer.from(shot.data, 'base64')); } catch { /* Keep original error. */ }
    try {
      const diagnostic = await send('Runtime.evaluate', { expression: `Promise.all(['load_memory','knowledge_graph_snapshot','knowledge_graph_associations'].map(async command=>{try{return {command,value:await __TAURI_INTERNALS__.invoke(command)}}catch(error){return {command,error:String(error)}}})).then(reads=>({panel:document.querySelector('.memory-associations')?.innerText,reads}))`, returnByValue: true, awaitPromise: true });
      await fs.writeFile(path.join(artifacts, 'failure.json'), JSON.stringify(diagnostic.result.value, null, 2));
    } catch { /* Synthetic diagnostics only; preserve the original failure. */ }
  }
  console.error(`Evidencia nativa: ${artifacts}`); throw error;
} finally {
  socket?.close();
  if (!native) {
    const candidates = processes().filter(process => process.title.includes('PRUEBA AISLADA DIOXUS'));
    if (candidates.length === 1) native = candidates[0];
  }
  // Stop only this test's executable, checking the exact path and returned PID.
  if (native) spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-Process -Id $env:ALICE_NATIVE_TEST_PID -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:ALICE_NATIVE_TEST_EXE } | Stop-Process'],
  { env: { ...env, ALICE_NATIVE_TEST_PID: String(native.id) }, windowsHide: true, stdio: 'ignore' });
  if (child.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  await log.close();
}
