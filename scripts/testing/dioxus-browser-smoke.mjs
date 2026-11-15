// Optional browser acceptance against a local production preview, with a fresh
// profile and no Tauri/data access. All artifacts stay in ignored local/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = process.env.ALICE_BROWSER_BIN;
if (!browser || !path.isAbsolute(browser)) throw Error('Define ALICE_BROWSER_BIN con la ruta absoluta de Edge/Chromium.');
const url = new URL(process.env.ALICE_PREVIEW_URL ?? 'http://127.0.0.1:4173/');
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('El ensayo sólo admite un preview HTTP de loopback.');
const artifacts = await fs.mkdtemp(path.join(root, 'local/dioxus-browser-'));
const profile = path.join(artifacts, 'profile');
const child = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let spawnError;
child.on('error', error => { spawnError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    const value = await read();
    if (value) return value;
    await pause(100);
  }
  throw Error(`Tiempo agotado: ${label}`);
}
let socket;
let send;
try {
  const port = await until(async () => {
    try { return (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
  }, 'inicio de navegador');
  assert.match(port, /^\d+$/);
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) }).then(response => response.json());
  const page = targets.find(target => target.type === 'page' && target.url === 'about:blank');
  assert.ok(page, 'Página aislada disponible');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await Promise.race([once(socket, 'open'), pause(5000).then(() => { throw Error('No se abrió CDP'); })]);
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result);
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`Tiempo agotado: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const ready = () => until(() => evaluate('Boolean(document.querySelector(\'[data-renderer="dioxus"] .flow-node\'))'), 'montaje Dioxus');
  const inspector = () => evaluate('document.querySelector(".neuro-inspector h3")?.textContent');
  const clickTab = label => evaluate(`Array.from(document.querySelectorAll("button")).find(button => button.getAttribute("aria-label") === ${JSON.stringify(label)})?.click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  url.searchParams.set('screen', 'flujo');
  await send('Page.navigate', { url: url.href });
  await ready();
  assert.equal(await evaluate('document.querySelectorAll(".flow-node").length'), 11);
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll(".core-activity-provenance").length'), 1);
  assert.equal(await evaluate('document.querySelector(".neuro-live")?.dataset.activityState'), 'unavailable');
  assert.equal(await evaluate('document.querySelector(".nucleus-page-description")?.textContent'), 'Relaciones funcionales entre percepción, memoria, espacio de trabajo y salida.');
  assert.equal(await inspector(), 'Entrada');
  await evaluate('document.querySelector(\'.flow-node[aria-label^="Memoria:"]\').dispatchEvent(new MouseEvent("click", {bubbles:true}))');
  await until(async () => (await inspector()) === 'Memoria', 'selección de memoria');
  await evaluate('document.querySelector(\'.flow-node[aria-label^="Lenguaje:"]\').focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(async () => (await inspector()) === 'Lenguaje', 'selección por teclado');
  await clickTab('Estado y controles');
  await until(() => evaluate('Boolean(document.querySelector(\'[data-renderer="dioxus"] .internal-state\'))'), 'Estado y controles');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelector(".nucleus-page-description")?.textContent'), 'Señales verificables, memoria recuperada y ajustes disponibles para el próximo envío.');
  await clickTab('Flujo cognitivo');
  await ready();
  assert.equal(await evaluate('document.querySelectorAll(".flow-node").length'), 11);
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll(".internal-state").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll("#associations-title").length'), 1);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(artifacts, 'flow-desktop.png'), Buffer.from(shot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 900, deviceScaleFactor: 1, mobile: false });
  await until(() => evaluate('window.innerWidth === 1000'), 'cambio de ancho');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Sin desbordamiento horizontal a 1000 px');
  const narrowShot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(artifacts, 'flow-1000.png'), Buffer.from(narrowShot.data, 'base64'));

  // Exercise real WASM updates independently of Tauri, using synthetic signals.
  const runtimeFile = (await fs.readdir(path.join(root, 'dist/assets'))).find(name => /^runtime-.*\.js$/.test(name));
  assert.ok(runtimeFile, 'Runtime generado disponible');
  const runtimeUrl = new URL(`/assets/${runtimeFile}`, url).href;
  await evaluate(`(async () => {
    const runtime = await (await import(${JSON.stringify(runtimeUrl)})).loadFlowRuntime();
    const container = document.createElement('div'); container.id = 'dioxus-smoke-signal'; document.body.append(container);
    const payload = {nodes:[{id:'flow-input',label:'Entrada',value:'0',detail:'Ejemplo ficticio',group:'input',activation:0,availability:'ready',x:10,y:50}],links:[],selectedId:'flow-input',hasActivity:false,activity:{status:'loading',signalPresent:false,auditHealthy:null,windowEventCount:0,windowMs:60000,overallSignal:0,method:null}};
    const id = await new Promise(resolve => { const mounted = runtime.mount(container.id,JSON.stringify(payload),()=>{},()=>queueMicrotask(()=>resolve(mounted))); });
    globalThis.__aliceSmoke = {runtime,id,payload};
  })()`);
  const signalState = () => evaluate('document.querySelector("#dioxus-smoke-signal .neuro-live")?.dataset.activityState');
  await until(async () => await signalState() === 'loading', 'R3 cargando');
  await evaluate("__aliceSmoke.payload.activity.status='ready'; __aliceSmoke.runtime.update(__aliceSmoke.id,JSON.stringify(__aliceSmoke.payload))");
  await until(async () => await signalState() === 'idle', 'R3 sin actividad');
  await evaluate("Object.assign(__aliceSmoke.payload.activity,{signalPresent:true,auditHealthy:false,windowEventCount:1,overallSignal:0.4,method:'r3-recency-motor-v2'}); __aliceSmoke.runtime.update(__aliceSmoke.id,JSON.stringify(__aliceSmoke.payload))");
  await until(async () => await signalState() === 'ready', 'R3 con señal');
  assert.equal(await evaluate('document.querySelector("#dioxus-smoke-signal .core-activity-provenance")?.dataset.auditState'), 'degraded');
  assert.equal(await evaluate('document.querySelector("#dioxus-smoke-signal .core-activity-provenance")?.textContent.includes("1 EVENTOS / 1 MIN · SEÑAL 0.400")'), true);
  assert.equal(await evaluate(`(() => { const invalid=structuredClone(__aliceSmoke.payload); invalid.activity.overallSignal=2; try { __aliceSmoke.runtime.update(__aliceSmoke.id,JSON.stringify(invalid)); return false; } catch { return true; } })()`), true, 'Rechaza señales inválidas');
  await evaluate("__aliceSmoke.runtime.unmount(__aliceSmoke.id); document.getElementById('dioxus-smoke-signal').remove(); delete globalThis.__aliceSmoke");

  // A failed WASM download must retain the React view and its selection on retry.
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setBlockedURLs', { urls: ['*.wasm'] });
  await send('Page.navigate', { url: url.href });
  await until(() => evaluate('document.body.textContent.includes("Vista de respaldo activa.")'), 'respaldo tras fallo de WASM');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll(".flow-node").length'), 11);
  await evaluate('document.querySelector(\'.flow-node[aria-label^="Memoria:"]\').dispatchEvent(new MouseEvent("click", {bubbles:true}))');
  await until(async () => await inspector() === 'Memoria', 'selección en respaldo');
  await send('Network.setBlockedURLs', { urls: [] });
  await evaluate('Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Reintentar").click()');
  await ready();
  assert.equal(await inspector(), 'Memoria', 'Conserva selección al recuperar Dioxus');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.body.textContent.includes("Vista de respaldo activa.")'), false);
  console.log(`Dioxus: montaje, clic, teclado, navegación, dos anchos, estados R3 y recuperación comprobados. Capturas: ${artifacts}`);
} finally {
  try { if (send && socket?.readyState === WebSocket.OPEN) await send('Browser.close'); } catch { /* Browser may close before acknowledging. */ }
  socket?.close();
  if (child.exitCode === null) child.kill();
}
