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
  await send('Page.enable');
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

  // Simulated IPC only: this browser has no native bridge or access to stores.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    globalThis.isTauri = true;
    globalThis.__relationCalls = [];
    globalThis.__relationFixture = {revision:7,associations:[
      {id:'active',revision:1,withdrawn:false,sourcesCurrent:true,evidence:[{recordId:'a'},{recordId:'b'}]},
      {id:'withdrawn',revision:1,withdrawn:true,sourcesCurrent:true,evidence:[{recordId:'a'},{recordId:'c'}]},
      {id:'blocked',revision:1,withdrawn:true,sourcesCurrent:false,evidence:[{recordId:'b'},{recordId:'c'}]},
      {id:'stale',revision:1,withdrawn:false,sourcesCurrent:false,evidence:[{recordId:'a'},{recordId:'d'}]}
    ]};
    globalThis.__TAURI_INTERNALS__ = {
      transformCallback: () => 0,
      invoke: async (cmd,args={}) => {
        __relationCalls.push({cmd,args:structuredClone(args)});
        if(cmd==='knowledge_graph_snapshot') return {nodes:[]};
        if(cmd==='load_memory') return {existed:true,storagePath:'synthetic-only/records.json',sessions:[
          {id:'a',kind:'Enseñanza',intention:'Experiencia A',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'b',kind:'Enseñanza',intention:'Experiencia B',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'c',kind:'Enseñanza',intention:'Experiencia C',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'d',kind:'Enseñanza',intention:'Experiencia <D>',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'}]};
        if(cmd==='knowledge_graph_associations') return structuredClone(__relationFixture);
        if(cmd==='set_knowledge_graph_association_withdrawn') {
          if(globalThis.__failRelationWrite) { globalThis.__failRelationWrite=false; throw Error('Fallo sintético de relación'); }
          if(args.confirmed!==true || args.expectedRevision!==__relationFixture.revision) throw Error('Confirmación o revisión inválida');
          const relation=__relationFixture.associations.find(item=>item.id===args.id);
          if(!relation) throw Error('Relación desconocida');
          relation.withdrawn=args.withdrawn; __relationFixture.revision++; return null;
        }
        throw Error('Servicio no incluido en la simulación: '+cmd);
      }
    };
  ` });
  await send('Page.navigate', { url: url.href });
  await until(() => evaluate('globalThis.isTauri === true'), 'instalación de IPC ficticio');
  const relationsReady = () => until(() => evaluate('document.querySelectorAll(\'[data-relations-renderer="dioxus"] article\').length === 4'), 'lista Dioxus con IPC ficticio');
  await relationsReady();
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations h4").length'), 1);
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations article button")).map(button=>button.disabled)'), [false,false,true,false]);
  assert.equal(await evaluate('document.querySelector(".memory-associations").textContent.includes("Experiencia <D>")'), true);
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations article d").length'), 0, 'Los títulos se muestran como texto');
  const writes = () => evaluate('__relationCalls.filter(call=>call.cmd==="set_knowledge_graph_association_withdrawn")');
  await evaluate('document.querySelectorAll(".memory-associations article button")[0].click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar cambio de relación"]\'))'), 'revisión antes de escribir');
  assert.equal((await writes()).length, 0, 'Seleccionar no escribe');
  await evaluate('Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Cancelar").click()');
  assert.equal((await writes()).length, 0, 'Cancelar no escribe');
  await evaluate('document.querySelectorAll(".memory-associations article button")[1].click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar cambio de relación"]\'))'), 'revisión de restauración');
  await evaluate('Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Confirmar cambio").click()');
  await until(async () => (await writes()).length === 1, 'confirmación explícita');
  assert.deepEqual((await writes())[0].args, {id:'withdrawn',withdrawn:false,expectedRevision:7,confirmed:true});
  await until(() => evaluate('document.querySelectorAll(".memory-associations article button")[1]?.textContent === "Retirar relación"'), 'lista actualizada después de confirmar');
  await evaluate('globalThis.__failRelationWrite=true; document.querySelectorAll(".memory-associations article button")[0].click()');
  await until(() => evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar cambio de relación"]\'))'), 'revisión con error simulado');
  await evaluate('Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Confirmar cambio").click()');
  await until(() => evaluate('document.querySelector(".memory-associations [role=alert]")?.textContent.includes("Fallo sintético")'), 'error comunicado');
  assert.equal(await evaluate('__relationFixture.associations[0].withdrawn'), false);
  await evaluate('document.querySelector(".memory-associations h4").scrollIntoView({block:"center"})');
  const relationsShot = await send('Page.captureScreenshot', {format:'png'});
  await fs.writeFile(path.join(artifacts, 'saved-relations.png'), Buffer.from(relationsShot.data, 'base64'));

  await send('Network.setBlockedURLs', { urls: ['*.wasm'] });
  await send('Page.navigate', { url: url.href });
  await until(() => evaluate('document.body.textContent.includes("Lista de respaldo activa.")'), 'lista de respaldo');
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations article").length'), 4);
  await send('Network.setBlockedURLs', { urls: [] });
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Reintentar lista").click()');
  await relationsReady();
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations h4").length'), 1);
  assert.equal((await writes()).length, 0, 'Reintentar no escribe');
  console.log(`Dioxus: navegación, estados R3, lista, confirmaciones con IPC ficticio y recuperación comprobados. Capturas: ${artifacts}`);
} catch (error) {
  if (send && socket?.readyState === WebSocket.OPEN) {
    try {
      const state = await send('Runtime.evaluate', {expression:'JSON.stringify({text:document.body.innerText,calls:globalThis.__relationCalls,tauri:globalThis.isTauri})',returnByValue:true});
      await fs.writeFile(path.join(artifacts, 'failure.json'), state.result.value ?? '{}');
      console.error(`Estado de prueba aislada: ${artifacts}`);
    } catch { /* Preserve the original failure. */ }
  }
  throw error;
} finally {
  try { if (send && socket?.readyState === WebSocket.OPEN) await send('Browser.close'); } catch { /* Browser may close before acknowledging. */ }
  socket?.close();
  if (child.exitCode === null) child.kill();
}
