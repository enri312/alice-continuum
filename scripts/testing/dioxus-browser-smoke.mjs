// Optional browser acceptance against a local production preview, with a fresh
// profile and no Tauri/data access. All artifacts stay in ignored runtime/.
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
const artifactRoot = path.join(root, 'runtime/artifacts/dioxus/browser');
await fs.mkdir(artifactRoot, { recursive: true });
const artifacts = await fs.mkdtemp(path.join(artifactRoot, 'dioxus-browser-'));
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
  const confirmationReady = label => until(() => evaluate(`Array.from(document.querySelectorAll('[data-confirmation-renderer="dioxus"] [role="region"]')).some(element=>element.getAttribute('aria-label')===${JSON.stringify(label)})`), `confirmación Dioxus: ${label}`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
  url.searchParams.set('screen', 'flujo');
  await send('Page.navigate', { url: url.href });
  await ready();
  assert.equal(await evaluate('document.querySelector("[data-flow-page-renderer]")?.dataset.flowPageRenderer'), 'dioxus', 'Página de Flujo completa en Dioxus');
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
  const runtimeFile = (await fs.readdir(path.join(root, 'Frontend/dist/assets'))).find(name => /^runtime-.*\.js$/.test(name));
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
    globalThis.__coreMode = 'idle';
    globalThis.__coreActivityCalls = 0;
    globalThis.__corePending = 0;
    globalThis.__coreMaxPending = 0;
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
        if(cmd==='core_activity_snapshot') {
          __coreActivityCalls++; __corePending++; __coreMaxPending=Math.max(__coreMaxPending,__corePending);
          const mode=__coreMode;
          try {
            if(mode==='hold') await new Promise(resolve=>globalThis.__releaseCore=resolve);
            if(mode==='failure') throw Error('Fallo R3 ficticio');
            const active=mode==='active'||mode==='hold';
            const regions=['perception','permission','memory','language','workspace','output','motor'].map(id=>{
              const signaled=active&&['perception','permission','workspace','motor'].includes(id);
              return {id,label:id,eventCount:signaled?1:0,signal:signaled?0.3:0,lastEventAtMs:signaled?1000:null};
            });
            const links=[['permission-perception','permission','perception'],['perception-workspace','perception','workspace'],['memory-workspace','memory','workspace'],['language-workspace','language','workspace'],['workspace-output','workspace','output']].map(([id,from,to])=>({id,from,to,evidenceCount:active&&id==='permission-perception'?1:0,signal:active&&id==='permission-perception'?0.3:0}));
            const snapshot={schemaVersion:2,generatedAtMs:1000,method:'r3-recency-motor-v2',heuristic:true,windowMs:300000,auditHealthy:!active,visibleEventCount:1,windowEventCount:1,latestEventAtMs:active?1000:null,overallSignal:active?0.3:0,regions,links};
            if(mode==='invalid') snapshot.private='campo no permitido';
            return snapshot;
          } finally { __corePending--; }
        }
        if(cmd==='knowledge_graph_snapshot') return {nodes:[
          {evidenceUse:'episodeOnly',recordVersion:2,lifecycle:{recordId:'a',recordSha256:'sha256:'+'a'.repeat(64)}},
          {evidenceUse:'episodeOnly',recordVersion:3,lifecycle:{recordId:'b',recordSha256:'sha256:'+'b'.repeat(64)}},
          {evidenceUse:'notAnEpisode',recordVersion:1,lifecycle:{recordId:'c',recordSha256:'sha256:'+'c'.repeat(64)}}
        ]};
        if(cmd==='load_memory') return {existed:true,storagePath:'synthetic-only/records.json',sessions:[
          {id:'a',kind:'Enseñanza',intention:'Experiencia A',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'b',kind:'Enseñanza',intention:'Experiencia B',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'c',kind:'Enseñanza',intention:'Experiencia C',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'},
          {id:'d',kind:'Enseñanza',intention:'Experiencia <D>',startedAt:'2026-11-14T10:00:00Z',finishedAt:'2026-11-14T10:01:00Z'}]};
        if(cmd==='knowledge_graph_associations') return structuredClone(__relationFixture);
        if(cmd==='preview_knowledge_graph_association') {
          const evidence=args.evidence;
          if(evidence?.length!==2 || evidence[0].recordId===evidence[1].recordId) throw Error('Fuentes ficticias inválidas');
          for(const item of evidence) {
            const id=item.recordId;
            if(!['a','b'].includes(id) || item.recordVersion!==(id==='a'?2:3) || item.recordSha256!=='sha256:'+id.repeat(64)
              || !item.quote?.trim() || !('Experiencia '+id.toUpperCase()).includes(item.quote)) throw Error('Cita ficticia no coincide con la fuente');
          }
          if(globalThis.__holdSourcePreview) await new Promise(resolve=>globalThis.__releaseSourcePreview=resolve);
          return null;
        }
        if(cmd==='confirm_knowledge_graph_association') {
          if(args.confirmed!==true || args.expectedRevision!==__relationFixture.revision) throw Error('Confirmación ficticia inválida');
          __relationFixture.associations.push({id:'new',revision:1,withdrawn:false,sourcesCurrent:true,evidence:args.evidence});
          __relationFixture.revision++; return null;
        }
        if(cmd==='set_knowledge_graph_association_withdrawn') {
          if(globalThis.__holdRelationWrite) await new Promise(resolve=>globalThis.__releaseRelationWrite=resolve);
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
  assert.equal(await evaluate('document.querySelector("[data-flow-page-renderer]")?.dataset.flowPageRenderer'), 'dioxus');
  assert.equal(await evaluate('document.querySelector("[data-associations-renderer]")?.dataset.associationsRenderer'), 'dioxus', 'Controlador y panel de relaciones en Rust/Dioxus');
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations h4").length'), 1);
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations article button")).map(button=>button.disabled)'), [false,false,true,false]);
  assert.equal(await evaluate('document.querySelector(".memory-associations").textContent.includes("Experiencia <D>")'), true);
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations article d").length'), 0, 'Los títulos se muestran como texto');
  const writes = () => evaluate('__relationCalls.filter(call=>call.cmd==="set_knowledge_graph_association_withdrawn")');
  await evaluate('document.querySelectorAll(".memory-associations article button")[0].click()');
  await confirmationReady('Confirmar cambio de relación');
  assert.equal((await writes()).length, 0, 'Seleccionar no escribe');
  await evaluate('Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Cancelar").click()');
  assert.equal((await writes()).length, 0, 'Cancelar no escribe');
  await evaluate('document.querySelectorAll(".memory-associations article button")[1].click()');
  await confirmationReady('Confirmar cambio de relación');
  assert.equal(await evaluate('document.querySelector(\'[aria-label="Confirmar cambio de relación"] p\').textContent'), '¿Restaurar esta relación? No modifica recuerdos y conserva las revisiones anteriores.');
  await evaluate('document.querySelector(\'[aria-label="Confirmar cambio de relación"]\').scrollIntoView({block:"center"})');
  const confirmationShot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(path.join(artifacts,'confirmation-change.png'),Buffer.from(confirmationShot.data,'base64'));
  await evaluate('globalThis.__holdRelationWrite=true; const button=Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Confirmar cambio"); button.click(); button.click()');
  await until(async () => (await writes()).length === 1, 'confirmación explícita');
  await until(() => evaluate('(() => { const buttons=Array.from(document.querySelectorAll(\'[aria-label="Confirmar cambio de relación"] button\')); return buttons.length===2 && buttons.every(button=>button.disabled); })()'), 'confirmación ocupada bloquea confirmar y cancelar');
  assert.equal((await writes()).length,1,'Doble clic no duplica la solicitud');
  await until(() => evaluate('typeof globalThis.__releaseRelationWrite === "function"'), 'guardado ficticio suspendido');
  await evaluate('globalThis.__holdRelationWrite=false; __releaseRelationWrite()');
  assert.deepEqual((await writes())[0].args, {id:'withdrawn',withdrawn:false,expectedRevision:7,confirmed:true});
  await until(() => evaluate('document.querySelectorAll(".memory-associations article button")[1]?.textContent === "Retirar relación"'), 'lista actualizada después de confirmar');
  await evaluate('globalThis.__failRelationWrite=true; document.querySelectorAll(".memory-associations article button")[0].click()');
  await confirmationReady('Confirmar cambio de relación');
  await evaluate('Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent==="Confirmar cambio").click()');
  await until(() => evaluate('document.querySelector(".memory-associations [role=alert]")?.textContent.includes("Fallo sintético")'), 'error comunicado');
  assert.equal(await evaluate('__relationFixture.associations[0].withdrawn'), false);
  await evaluate('document.querySelector(".memory-associations h4").scrollIntoView({block:"center"})');
  const relationsShot = await send('Page.captureScreenshot', {format:'png'});
  await fs.writeFile(path.join(artifacts, 'saved-relations.png'), Buffer.from(relationsShot.data, 'base64'));

  const sourceFormReady = () => until(() => evaluate('document.querySelectorAll(\'[data-source-form-renderer="dioxus"] select\').length === 2'), 'formulario Dioxus');
  const sourceSelector = index => `.memory-associations select[aria-label="Experiencia ${index + 1}"]`;
  const quoteSelector = index => `.memory-associations textarea[aria-label="Cita ${index + 1}"]`;
  const selectSource = (index, id) => evaluate(`(() => {const element=document.querySelector(${JSON.stringify(sourceSelector(index))}); element.value=${JSON.stringify(id)}; element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const typeQuote = async (index, text) => {
    await evaluate(`(() => {const element=document.querySelector(${JSON.stringify(quoteSelector(index))}); element.focus(); element.select();})()`);
    await send('Input.insertText', {text});
  };
  const previewEnabled = () => evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Revisar relación")?.matches(":enabled")');
  const previewCalls = () => evaluate('__relationCalls.filter(call=>call.cmd==="preview_knowledge_graph_association")');
  const sourceWrites = () => evaluate('__relationCalls.filter(call=>call.cmd==="confirm_knowledge_graph_association")');
  const clickText = text => evaluate(`Array.from(document.querySelectorAll(".memory-associations button")).find(button=>button.textContent===${JSON.stringify(text)}).click()`);
  await sourceFormReady();
  assert.deepEqual(await evaluate('Array.from(document.querySelector(\'select[aria-label="Experiencia 1"]\').options).map(option=>option.value)'),['','a','b']);
  assert.equal(await previewEnabled(), false);
  await selectSource(0, 'a');
  await selectSource(1, 'a');
  await until(() => evaluate('document.querySelectorAll(".memory-associations details").length === 2'), 'lectura de entradas originales');
  await typeQuote(0, 'Experiencia A');
  await typeQuote(1, 'Experiencia A');
  assert.equal(await previewEnabled(), false, 'Dos fuentes iguales no se revisan');
  await selectSource(1, 'b');
  await until(() => evaluate('document.querySelector(\'textarea[aria-label="Cita 2"]\').value === ""'), 'limpieza de cita al cambiar fuente');
  await typeQuote(1, 'Experiencia B');
  await until(previewEnabled, 'revisión de dos fuentes distintas');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations pre")).map(item=>item.textContent)'), ['Experiencia A','Experiencia B']);
  await evaluate('document.querySelector(".memory-associations details summary").click()');
  assert.equal(await evaluate('document.querySelector(".memory-associations details").open'),true);
  assert.equal((await sourceWrites()).length, 0);
  await evaluate('globalThis.__holdSourcePreview=true');
  await clickText('Revisar relación');
  await until(() => evaluate('document.querySelector(".memory-associations fieldset").matches(":disabled")'), 'bloqueo durante revisión');
  assert.deepEqual((await previewCalls())[0].args.evidence, [
    {recordId:'a',recordVersion:2,recordSha256:'sha256:'+'a'.repeat(64),quote:'Experiencia A'},
    {recordId:'b',recordVersion:3,recordSha256:'sha256:'+'b'.repeat(64),quote:'Experiencia B'},
  ]);
  await until(() => evaluate('typeof globalThis.__releaseSourcePreview === "function"'), 'revisión ficticia suspendida');
  await evaluate('globalThis.__holdSourcePreview=false; __releaseSourcePreview()');
  await confirmationReady('Confirmar relación revisada');
  assert.equal((await sourceWrites()).length, 0, 'Revisar no guarda');
  await until(previewEnabled,'fin de revisión');
  await selectSource(1,'a');
  await until(() => evaluate('!document.querySelector(\'[aria-label="Confirmar relación revisada"]\')'), 'cambiar fuente invalida revisión');
  assert.equal(await previewEnabled(),false);
  await selectSource(1,'b');
  await typeQuote(1,'Experiencia B');
  await until(previewEnabled,'nueva cita después de cambiar fuente');
  await clickText('Revisar relación');
  await confirmationReady('Confirmar relación revisada');
  await until(previewEnabled,'fin de nueva revisión');
  await typeQuote(0, 'Experiencia');
  await until(() => evaluate('!document.querySelector(\'[aria-label="Confirmar relación revisada"]\')'), 'editar invalida revisión anterior');
  await clickText('Revisar relación');
  await confirmationReady('Confirmar relación revisada');
  await until(previewEnabled,'formulario disponible después de revisar');
  await evaluate('document.querySelector(".memory-associations fieldset").scrollIntoView({block:"center"})');
  const sourceShot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(path.join(artifacts,'source-form.png'),Buffer.from(sourceShot.data,'base64'));
  await clickText('Confirmar y guardar relación');
  await until(async () => (await sourceWrites()).length === 1, 'guardado sólo después de confirmar');
  assert.equal((await sourceWrites())[0].args.confirmed, true);
  assert.equal((await sourceWrites())[0].args.expectedRevision, 8);
  await until(() => evaluate('document.querySelectorAll(".memory-associations article").length === 5'), 'nueva relación ficticia en lista');
  await typeQuote(0,'texto inexistente');
  await until(previewEnabled,'cita pendiente de validación nativa');
  await clickText('Revisar relación');
  await until(() => evaluate('document.querySelector(".memory-associations [role=alert]")?.textContent.includes("no coincide")'), 'cita no literal rechazada');
  assert.equal(await evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar relación revisada"]\'))'),false);
  assert.equal((await sourceWrites()).length,1);

  // Leaving while a preview is in flight must not deliver a response to a new session.
  await typeQuote(0,'Experiencia A');
  await until(previewEnabled,'nueva revisión antes de navegar');
  await evaluate('globalThis.__holdSourcePreview=true; delete globalThis.__releaseSourcePreview');
  await clickText('Revisar relación');
  await until(() => evaluate('typeof globalThis.__releaseSourcePreview === "function"'), 'revisión pendiente antes de salir');
  await clickTab('Estado y controles');
  await until(() => evaluate('Boolean(document.querySelector(\'[data-renderer="dioxus"] .internal-state\'))'), 'salida del controlador de asociaciones');
  await evaluate('globalThis.__holdSourcePreview=false; __releaseSourcePreview()');
  await clickTab('Flujo cognitivo');
  await ready(); await sourceFormReady();
  assert.equal(await evaluate('document.querySelector("[data-associations-renderer]")?.dataset.associationsRenderer'), 'dioxus');
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations textarea")).map(element=>element.value)'),['','']);
  assert.equal(await evaluate('Boolean(document.querySelector(\'[aria-label="Confirmar relación revisada"]\'))'),false,'La respuesta anterior no crea una revisión en la nueva sesión');
  assert.equal((await sourceWrites()).length,1,'Navegar y recibir una respuesta tardía no guarda');

  // Real Rust/browser timer with fictitious IPC: a slow read spans two ticks.
  const activityState = () => evaluate('document.querySelector(".neuro-live")?.dataset.activityState');
  await until(async () => await activityState()==='idle','R3 de procedimientos sin señal');
  await evaluate("__coreMode='hold'; delete globalThis.__releaseCore");
  await until(() => evaluate('typeof __releaseCore === "function"'),'lectura R3 suspendida');
  const heldCalls=await evaluate('__coreActivityCalls');
  await pause(10_200);
  assert.equal(await evaluate('__coreActivityCalls'),heldCalls,'Dos intervalos no superponen otra lectura R3');
  assert.equal(await evaluate('__coreMaxPending'),1,'Una sola lectura nativa pendiente');
  await evaluate("__coreMode='active'; __releaseCore()");
  await until(async () => await activityState()==='ready','señal R3 validada en Rust');
  assert.equal(await evaluate('document.querySelector(".core-activity-provenance")?.dataset.auditState'),'degraded');
  const nodeSignal = label => evaluate(`document.querySelector('.flow-node[aria-label^="${label}:"]')?.style.getPropertyValue('--signal')`);
  assert.equal(await nodeSignal('Entrada'),'0.3');
  assert.equal(await nodeSignal('Cuerpo manual'),'0.3');
  assert.equal(await nodeSignal('Rostro'),'0');
  assert.equal(await nodeSignal('Social'),'0');
  assert.equal(await evaluate('document.querySelector(".flow-connections path")?.style.getPropertyValue("--signal")'),'0.3');
  const activityShot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(path.join(artifacts,'flow-page-r3.png'),Buffer.from(activityShot.data,'base64'));
  await evaluate("__coreMode='invalid'");
  await until(async () => await activityState()==='unavailable','snapshot inválido retira la señal anterior');
  assert.equal(await nodeSignal('Entrada'),'0');
  assert.equal(await evaluate('Array.from(document.querySelectorAll(".flow-connections path")).every(path=>path.style.getPropertyValue("--signal")==="0")'),true);
  await evaluate("__coreMode='idle'");
  await until(async () => await activityState()==='idle','recuperación R3 sin señal inventada');

  // Unmount clears the timer; an old response cannot attach to the next session.
  await evaluate("__coreMode='hold'; delete globalThis.__releaseCore");
  await until(() => evaluate('typeof __releaseCore === "function"'),'lectura antes de desmontar Flujo');
  await evaluate('document.querySelector(\'.screen-tabs button[data-tooltip="Actividad"]\').click()');
  await until(() => evaluate('!document.querySelector("[data-flow-page-renderer]")'),'Flujo desmontado');
  const afterUnmount=await evaluate('__coreActivityCalls');
  await pause(5_200);
  assert.equal(await evaluate('__coreActivityCalls'),afterUnmount,'No quedan sondeos de Flujo al cambiar de pantalla');
  await evaluate("__coreMode='idle'");
  await clickTab('Flujo cognitivo'); await ready(); await sourceFormReady();
  await until(async () => await activityState()==='idle','sesión nueva sin señal');
  await evaluate('__releaseCore()');
  await until(() => evaluate('__corePending===0'),'respuesta de sesión anterior descartada');
  assert.equal(await activityState(),'idle','La respuesta activa anterior no cambia el estado de la sesión nueva');
  assert.equal((await sourceWrites()).length,1,'Sondear y navegar no guarda relaciones');

  await send('Network.setBlockedURLs', { urls: ['*.wasm'] });
  await send('Page.navigate', { url: url.href });
  await until(() => evaluate('document.body.textContent.includes("Lista de respaldo activa.")'), 'lista de respaldo');
  assert.equal(await evaluate('document.querySelector("[data-flow-page-renderer]")?.dataset.flowPageRenderer'),'react','Página anterior sólo como recuperación');
  assert.equal(await evaluate('document.querySelector("[data-associations-renderer]")?.dataset.associationsRenderer'), 'react', 'Recuperación con controlador anterior sólo tras fallo de carga');
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations article").length'), 4);
  await until(() => evaluate('document.body.textContent.includes("Formulario de respaldo activo.")'), 'formulario de respaldo');
  await evaluate('document.querySelectorAll(".memory-associations article button")[0].click()');
  await until(() => evaluate('document.body.textContent.includes("Confirmación de respaldo activa.")'), 'confirmación de respaldo');
  assert.equal((await writes()).length,0,'Abrir confirmación de respaldo no escribe');
  await selectSource(0,'a'); await selectSource(1,'b');
  await typeQuote(0,'Experiencia A'); await typeQuote(1,'Experiencia B');
  await until(previewEnabled,'edición en respaldo');
  await send('Network.setBlockedURLs', { urls: [] });
  await clickText('Reintentar confirmación');
  await confirmationReady('Confirmar cambio de relación');
  assert.equal((await writes()).length,0,'Recuperar confirmación no escribe');
  await clickText('Cancelar');
  await until(() => evaluate('!document.querySelector(\'[aria-label="Confirmar cambio de relación"]\')'), 'cancelar después de recuperar');
  await clickText('Reintentar formulario');
  await sourceFormReady();
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations select")).map(element=>element.value)'),['a','b']);
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".memory-associations textarea")).map(element=>element.value)'),['Experiencia A','Experiencia B']);
  assert.equal((await previewCalls()).length,0,'Recuperar el formulario no revisa automáticamente');
  assert.equal((await sourceWrites()).length,0,'Recuperar el formulario no guarda');
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Reintentar lista").click()');
  await relationsReady();
  assert.equal(await evaluate('document.querySelectorAll(".memory-associations h4").length'), 1);
  assert.equal((await writes()).length, 0, 'Reintentar no escribe');
  // State page: Rust owns its timer and metric projection as well as the renderer.
  await until(() => evaluate('__corePending===0'), 'lecturas previas terminadas');
  await evaluate("__coreMode='hold'; __coreMaxPending=0; delete globalThis.__releaseCore");
  await clickTab('Estado y controles');
  const stateReady = () => until(() => evaluate('Boolean(document.querySelector(\'.state-controls-host[data-renderer="dioxus"] .internal-state\'))'), 'Estado Dioxus');
  await stateReady();
  await until(() => evaluate('typeof __releaseCore === "function"'), 'lectura de Estado suspendida');
  const stateHeld = await evaluate('__coreActivityCalls');
  await pause(10_200);
  assert.equal(await evaluate('__coreActivityCalls'), stateHeld, 'Estado no superpone lecturas durante dos intervalos');
  assert.equal(await evaluate('__coreMaxPending'), 1);
  await evaluate("__coreMode='active'; __releaseCore()");
  await until(async () => await activityState()==='ready', 'Estado proyecta señal R3');
  const metricValue = label => evaluate(`document.querySelector('.metric-row[aria-label^="${label}:"] .state-value-output')?.textContent`);
  assert.equal(await metricValue('Curiosidad'), '0.300');
  assert.equal(await metricValue('Fatiga'), '0.050');
  assert.equal(await metricValue('Frustración'), '0.850');
  assert.equal(await evaluate('document.querySelectorAll(".state-behavior-range:enabled").length'), 2, 'Sólo dos ajustes disponibles');
  const rangeValue = () => evaluate('document.querySelector(\'.state-behavior-range[aria-label^="Creatividad."]\')?.value');
  const beforeRange = Number(await rangeValue());
  const key = beforeRange > 0 ? 'ArrowLeft' : 'ArrowRight';
  await evaluate('document.querySelector(\'.state-behavior-range[aria-label^="Creatividad."]\').focus()');
  await send('Input.dispatchKeyEvent', {type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='ArrowLeft'?37:39});
  await send('Input.dispatchKeyEvent', {type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='ArrowLeft'?37:39});
  await until(async () => Math.abs(Number(await rangeValue())-beforeRange)>0.005, 'ajuste por teclado conserva aplicación a la sesión');
  const changedRange = await rangeValue();
  await evaluate('document.querySelector(".retrieved-row").click()');
  await until(async () => await inspector()==='Memoria recuperada', 'inspector de recuperación real');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll(".core-activity-provenance").length'), 1);
  await evaluate('document.querySelector(".state-controls-host").scrollIntoView({block:"start"})');
  const stateShot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(path.join(artifacts,'state-page-r3.png'),Buffer.from(stateShot.data,'base64'));
  await evaluate("__coreMode='invalid'");
  await until(async () => await activityState()==='unavailable', 'Estado retira señal inválida');
  assert.equal(await rangeValue(), changedRange, 'Un fallo R3 no pierde el ajuste conversacional');
  await evaluate("__coreMode='hold'; delete globalThis.__releaseCore");
  await until(() => evaluate('typeof __releaseCore === "function"'), 'lectura de Estado antes de salir');
  await evaluate('document.querySelector(\'.screen-tabs button[data-tooltip="Actividad"]\').click()');
  await until(() => evaluate('!document.querySelector(".state-controls-host")'), 'Estado desmontado');
  const stateStopped = await evaluate('__coreActivityCalls');
  await pause(5_200);
  assert.equal(await evaluate('__coreActivityCalls'), stateStopped, 'Salir cancela el sondeo de Estado');
  await evaluate("__coreMode='idle'");
  await clickTab('Estado y controles'); await stateReady();
  await until(async () => await activityState()==='idle', 'sesión nueva de Estado');
  await evaluate('__releaseCore()');
  await until(() => evaluate('__corePending===0'), 'respuesta anterior de Estado descartada');
  assert.equal(await activityState(),'idle');
  assert.equal(await rangeValue(), changedRange, 'El ajuste compartido permanece al navegar');
  await send('Network.setBlockedURLs',{urls:['*.wasm']});
  url.searchParams.set('screen','estado');
  await send('Page.navigate',{url:url.href});
  await until(() => evaluate('document.body.textContent.includes("Vista de respaldo activa.")'), 'recuperación de Estado');
  await until(() => evaluate('Boolean(document.querySelector(".retrieved-row"))'), 'contenido de recuperación de Estado');
  await evaluate('document.querySelector(".retrieved-row").click()');
  await until(async () => await inspector()==='Memoria recuperada', 'selección en respaldo de Estado');
  await send('Network.setBlockedURLs',{urls:[]});
  await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent==="Reintentar").click()');
  await stateReady();
  assert.equal(await inspector(),'Memoria recuperada','Reintentar conserva la selección del respaldo');
  assert.equal(await evaluate('document.querySelectorAll(".nucleus-page-header").length'),1);
  console.log(`Dioxus: Estado y Flujo, sondeos R3 Rust sin solapamiento, desmontaje, señales, ajustes, asociaciones, teclado y recuperación comprobados con IPC ficticio. Capturas: ${artifacts}`);
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
