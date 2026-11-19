// Production UI in an isolated browser. IPC and answers below are synthetic.
// Never opens devices, calls a model, or reads personal data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDioxusVoice } from './dioxus-voice-smoke.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const url = new URL(process.env.ALICE_PREVIEW_URL ?? 'http://127.0.0.1:4173/');
url.searchParams.delete('screen');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname), 'Preview local');
assert.ok((await fetch(url)).ok, 'Compila y sirve el proyecto antes de esta prueba');
const artifactRoot = path.join(root, 'runtime/artifacts/conversation-design');
await fs.mkdir(artifactRoot, { recursive:true });
const artifacts = await fs.mkdtemp(path.join(artifactRoot, 'proposal04-'));
const browser = spawn(process.env.ALICE_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  `--user-data-dir=${path.join(artifacts, 'profile')}`, '--remote-debugging-port=0', 'about:blank',
], { windowsHide:true, stdio:'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, label) {
  for (let i=0; i<150; i++) { const result=await read(); if (result) return result; await pause(100); }
  throw Error('Tiempo agotado: '+label);
}
let socket, send;
const network = [], failures = [];
try {
  const port = await until(async()=>{try{return (await fs.readFile(path.join(artifacts,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return null;}}, 'navegador');
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  socket = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl); await once(socket,'open');
  let next=0; const pending=new Map();
  socket.addEventListener('message', event=>{
    const message=JSON.parse(event.data);
    if (message.method==='Network.requestWillBeSent') network.push(message.params.request.url);
    if (message.method==='Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    const request=pending.get(message.id); if(!request)return;
    pending.delete(message.id); clearTimeout(request.timer);
    message.error?request.reject(Error(message.error.message)):request.resolve(message.result);
  });
  send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++next, timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP: '+method));},15000);
    pending.set(id,{resolve,reject,timer}); socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const ready=()=>until(()=>evaluate('Boolean(document.querySelector(\'[data-conversation-renderer="dioxus"] #alice-message\'))'),'Conversación en Dioxus');
  const input=async text=>{
    // Review deliberately moves focus after rendering; finish that before typing.
    await pause(150);
    await evaluate('document.querySelector("#alice-message").focus()');
    assert.equal(await evaluate('document.activeElement?.id'),'alice-message');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
    await send('Input.insertText',{text});
  };
  const screenshot=async name=>{
    const size=await evaluate('({width:document.documentElement.clientWidth,height:document.documentElement.scrollHeight})');
    const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...size,scale:1}});
    await fs.writeFile(path.join(artifacts,name),Buffer.from(r.data,'base64'));
  };
  const navigationLayout=()=>evaluate(`Array.from(document.querySelectorAll('.screen-tabs button')).map(button=>{
    const icon=button.querySelector('.screen-tab-icon'),label=button.querySelector('.screen-tab-label');
    const card=button.getBoundingClientRect(),picture=icon.getBoundingClientRect(),caption=label.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(label);
    return {text:label.textContent,cardHeight:card.height,iconTop:picture.top,iconHeight:picture.height,
      labelTop:caption.top,lineTop:range.getClientRects()[0]?.top,
      iconOffset:(picture.left+picture.width/2)-(card.left+card.width/2),
      labelOffset:(caption.left+caption.width/2)-(card.left+card.width/2),
      gap:caption.top-picture.bottom,labelFits:label.scrollHeight<=label.clientHeight+1&&label.scrollWidth<=label.clientWidth+1};
  })`);
  const checkNavigation=async (width, expectedCount=7)=>{
    const layout=await navigationLayout();
    assert.equal(layout.length,expectedCount);
    for(const item of layout){
      assert.ok(Math.abs(item.iconOffset)<1,'Icono centrado a '+width+' px: '+JSON.stringify(item));
      assert.ok(Math.abs(item.labelOffset)<1,'Etiqueta centrada: '+item.text);
      assert.ok(item.gap>=6,'Separación entre imagen y etiqueta: '+item.text);
      assert.ok(item.labelFits,'Etiqueta completa: '+item.text+' a '+width+' px');
      assert.ok(Math.abs(item.cardHeight-layout[0].cardHeight)<1,'Altura uniforme');
      assert.ok(Math.abs(item.iconTop-layout[0].iconTop)<1,'Fila de iconos alineada');
      assert.ok(Math.abs(item.labelTop-layout[0].labelTop)<1,'Fila de etiquetas alineada');
      assert.ok(Math.abs(item.lineTop-layout[0].lineTop)<1,'Primera línea de texto alineada');
    }
    return layout;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    globalThis.isTauri=true; globalThis.__calls=[]; globalThis.__devices=0; globalThis.__rejectSend=false;
    for(const method of ['getUserMedia','getDisplayMedia']) if(navigator.mediaDevices) navigator.mediaDevices[method]=async()=>{__devices++;throw Error('No physical devices in design acceptance');};
    globalThis.__TAURI_INTERNALS__={transformCallback:()=>0,invoke:async(cmd,args={})=>{
      __calls.push({cmd,args:structuredClone(args)});
      if(cmd==='cloud_status')return {providers:[{id:'ollama',label:'Motor de prueba local',configured:true,defaultModel:'fixture-model',protocol:'synthetic',retentionMode:'no service'}]};
      if(cmd==='conversation_history_status'){
        const stored = sessionStorage.getItem('alice-fixture-history') === 'ready';
        const exchanges = stored ? Array.from({length:7}, (_, index) => ({
          exchangeId:'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0'),
          responseId:'fixture-saved-'+index,userText:'Mensaje guardado '+index,assistantText:'Respuesta guardada '+index,
          createdAt:'2026-11-19T12:00:00.000Z',provider:'ollama',model:'fixture-model',source:'assistantConversation',
        })) : [];
        return {
          schemaVersion:1,state:stored?'ready':'missing',storageExists:stored,
          revisionId:stored?'00000000-0000-4000-8000-000000000099':null,updatedAt:stored?'2026-11-19T12:00:01.000Z':null,
          exchanges,exchangeCount:exchanges.length,messageCount:exchanges.length*2,maximumExchanges:1000,
          persisted:true,automaticMemoryPromotion:false,error:null,
        };
      }
      if(cmd==='system_overview')return {cpuPercent:34,memory:{usedBytes:6*1024**3,totalBytes:16*1024**3},disk:{usedBytes:180*1024**3,totalBytes:500*1024**3},network:{receivedBytesPerSecond:150000,transmittedBytesPerSecond:12000},power:{pluggedIn:true,batteryPercent:76},uptimeSeconds:273600};
      if(cmd==='load_memory')return {existed:false,storagePath:'synthetic-only/records.json',sessions:[]};
      if(cmd==='plugin:event|listen')return 1;
      if(cmd==='plugin:event|unlisten')return null;
      if(cmd==='preview_document')return {status:'ok',sourceSha256:'a'.repeat(64),totalPages:1,chunks:[{page:1,startChar:0,endChar:45,text:'<img src=x onerror="globalThis.__injected=true">'}]};
      if(cmd==='send_cloud_message'){
        if(__rejectSend)throw Error('Fallo sintético de aceptación');
        return {text:'Respuesta sintética: interfaz comprobada.',provider:'ollama',model:'fixture-model',responseId:'fixture-response',inputTokens:0,outputTokens:0,workingMemory:null,workingMemoryError:null,conversationHistory:null,conversationHistoryError:null};
      }
      throw Error('Comando fuera de esta prueba: '+cmd);
    }};
  `});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:url.href});
  await until(()=>evaluate('document.querySelector(".dashboard-reading-status")?.textContent==="Lecturas locales"'), 'Dashboard de inicio con métricas de prueba');
  assert.ok(await evaluate('document.querySelector(\'[data-navigation-renderer="dioxus"] #alice-page-outlet[data-route=dashboard]\')'),'Dashboard montado en la navegación Dioxus');
  assert.equal(await evaluate('document.querySelector("[data-dashboard-renderer]").dataset.dashboardRenderer'),'dioxus');
  await evaluate('document.fonts.ready');
  assert.equal(await evaluate('document.querySelectorAll(".alice-dashboard textarea,.alice-dashboard form").length'),0,'La escritura vive en Conversación');
  assert.equal(await evaluate('document.querySelectorAll(".dashboard-assistant-summary dd").length'),3);
  assert.equal(await evaluate('document.querySelector(".dashboard-gauge-value strong").textContent'),'38 %');
  assert.equal(await evaluate('document.querySelectorAll(".dashboard-shortcut img").length'),4);
  assert.equal(await evaluate('__calls.filter(({cmd})=>cmd==="send_cloud_message").length'),0);
  await screenshot('dashboard-desktop.png');
  for (const width of [390,320]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    await until(()=>evaluate(`innerWidth===${width}`), 'Dashboard redimensionado a '+width+' px');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'), 'Dashboard sin desborde a '+width+' px');
  }
  await screenshot('dashboard-narrow.png');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await click('.dashboard-shortcut'); await ready();
  assert.equal(await evaluate('document.querySelectorAll(".send-review").length'),0);
  await input('Borrador en Conversación');
  await click('.dashboard-entry');
  await until(()=>evaluate('Boolean(document.querySelector(".dashboard-assistant"))'),'Regreso al Dashboard');
  await click('.dashboard-shortcut'); await ready();
  assert.equal(await evaluate('document.querySelector("#alice-message").value'),'Borrador en Conversación');
  assert.equal(await evaluate('__calls.filter(({cmd})=>cmd==="send_cloud_message").length'),0,'Navegar conserva el borrador sin enviarlo');
  const conversationUrl = new URL(url); conversationUrl.searchParams.set('screen','identificacion');
  await send('Page.navigate',{url:conversationUrl.href}); await ready(); await evaluate('document.fonts.ready');
  await until(()=>evaluate('document.querySelector(".conversation-status").textContent.includes("Motor de prueba local")'),'estado real del adaptador simulado');
  assert.equal(await evaluate('document.querySelectorAll(".screen-tab-icon svg").length'),7);
  assert.equal(await evaluate('document.querySelector(".icon-identification svg").dataset.visualStyle'),'titanio-optico');
  assert.equal(await evaluate('document.querySelector(".icon-identification svg").dataset.motion'),'static');
  assert.ok(await evaluate(`(()=>{const svg=document.querySelector('.icon-identification svg');
    return [...svg.querySelectorAll('[id]')].every(node=>node.id.startsWith('alice-identification-')&&document.querySelectorAll('#'+node.id).length===1)
      && [...svg.outerHTML.matchAll(/url\\(#([^)]*)\\)/g)].every(match=>svg.querySelector('#'+match[1]));})()`),'Gradientes y referencias SVG propios sin colisiones');
  const iconBounds=await evaluate(`(()=>{const r=document.querySelector('.icon-identification').getBoundingClientRect();return {x:r.x-8,y:r.y-8,width:r.width+16,height:r.height+16,scale:3};})()`);
  const iconShot=await send('Page.captureScreenshot',{format:'png',clip:iconBounds});
  await fs.writeFile(path.join(artifacts,'conversation-icon-detail.png'),Buffer.from(iconShot.data,'base64'));
  assert.equal(await evaluate('document.querySelectorAll(".screen-tabs button").length'),7,'Sólo las pestañas originales, sin flechas añadidas');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-heading"),"::before").content'),'none','Sin aro decorativo');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-heading")).clipPath'),'inset(50%)','Encabezado técnico compacto como antes');
  assert.equal(await evaluate('document.querySelectorAll(".conversation-secondary-panel[open],.conversation-context-drawer[open]").length'),0);
  assert.ok(await evaluate('document.fonts.check(\'500 14px "Sora"\')&&document.fonts.check(\'500 14px "JetBrains Mono"\')'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-frame")).borderRadius'),'14px');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".composer")).display'),'flex');
  await checkNavigation(1280);
  assert.equal(await evaluate('document.querySelector(".composer-footer button").disabled'),true);
  await input('Prueba visual: empatía y álgebra.');
  assert.ok(await evaluate('getComputedStyle(document.querySelector(".composer-footer .primary")).backgroundImage.includes("73, 182, 225")'),'Acción principal con el acabado de consola');
  await click('.composer-footer button');
  await until(()=>evaluate('Boolean(document.querySelector(".send-review"))'),'revisión previa');
  assert.equal(await evaluate('__calls.filter(c=>c.cmd==="send_cloud_message").length'),0,'Revisar no envía');
  assert.ok(await evaluate('document.querySelector(".payload-detail pre").textContent.includes("Prueba visual: empatía y álgebra.")'));
  await click('.review-actions .secondary');
  await until(()=>evaluate('!document.querySelector(".send-review")'),'cancelar la revisión');
  await click('.composer-footer button');
  await input('Mensaje editado: escuchar con atención.');
  await until(()=>evaluate('!document.querySelector(".send-review")'),'editar invalida la autorización anterior');
  await click('.composer-footer button');
  await until(()=>evaluate('Boolean(document.querySelector(".review-actions .primary"))'),'confirmar revisión actual');
  await click('.review-actions .primary');
  await until(()=>evaluate('document.querySelectorAll(".chat-message").length===2'),'respuesta sintética');
  assert.equal(await evaluate('__calls.filter(c=>c.cmd==="send_cloud_message").length'),1);
  assert.equal(await evaluate('__calls.find(c=>c.cmd==="send_cloud_message").args.request.message'),'Mensaje editado: escuchar con atención.');
  await until(()=>evaluate('document.querySelector("#alice-message").value===""'),'limpiar el borrador después de enviar');
  await screenshot('conversation-desktop.png');
  await click('.conversation-context-drawer>summary');
  await input('Prueba del estado de error.');
  await evaluate('__rejectSend=true');
  await click('.composer-footer button');
  await until(()=>evaluate('Boolean(document.querySelector(".review-actions .primary"))'),'confirmar mensaje de prueba');
  await click('.review-actions .primary');
  await until(()=>evaluate('document.querySelector(".cloud-error")?.textContent.includes("Fallo sintético")'),'error visible sin perder el borrador');
  assert.equal(await evaluate('document.querySelector("#alice-message").value'),'Prueba del estado de error.');
  await click('.conversation-secondary-panel:nth-of-type(2)>summary');
  await until(()=>evaluate('Boolean(document.querySelector(".document-preview input"))'),'lector local');
  await evaluate(`(() => {
    const file = new File(['texto de prueba'], 'prueba.txt', { type: 'text/plain' });
    const data = new DataTransfer();
    data.items.add(file);
    const input = document.querySelector('.document-preview input');
    input.files = data.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await until(()=>evaluate('!document.querySelector(".document-preview button").disabled'),'archivo listo para revisión');
  assert.equal(await evaluate('__calls.filter(c=>c.cmd==="preview_document").length'),0,'Seleccionar el archivo no autoriza leerlo');
  await click('.document-preview button');
  await until(()=>evaluate('document.querySelector(".document-preview pre")?.textContent.includes("<img")'),'documento mostrado como texto');
  assert.equal(await evaluate('Boolean(document.querySelector(".document-preview img") || globalThis.__injected)'),false);
  await click('.document-preview button:nth-of-type(2)');
  await until(()=>evaluate('!document.querySelector(".document-preview pre")'),'descartar vista previa');
  await click('.conversation-secondary-panel:nth-of-type(2)>summary');
  await click('.conversation-secondary-panel:first-of-type>summary');
  await until(()=>evaluate('document.querySelector(".identification-received strong")?.textContent==="Prueba del estado de error."'),'analizar entrada local');
  const diagnosticButton = label => evaluate(`Array.from(document.querySelectorAll(".identification-controls button")).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  await diagnosticButton('Congelar diagnóstico');
  await input('Texto para segunda lectura.');
  assert.equal(await evaluate('document.querySelector(".identification-received strong")?.textContent'),'Prueba del estado de error.');
  await diagnosticButton('Actualizar en vivo');
  await until(()=>evaluate('document.querySelector(".identification-received strong")?.textContent==="Texto para segunda lectura."'),'reanudar el diagnóstico');
  await input('Prueba del estado de error.');
  await click('.conversation-secondary-panel:first-of-type>summary');
  const sizes=[];
  for(const width of [1280,1024,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(150);
    const size=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
    assert.ok(size.scroll<=size.width+1,'Sin desborde: '+JSON.stringify(size));
    size.navigation=await checkNavigation(width);sizes.push(size);
  }
  await click('.conversation-context-drawer>summary');
  await screenshot('conversation-mobile.png');
  const scrollBefore=await evaluate('document.querySelector(".screen-tabs").scrollLeft');
  await evaluate('document.querySelector(".screen-tabs").scrollBy({left:200,behavior:"instant"})');
  await until(()=>evaluate(`document.querySelector('.screen-tabs').scrollLeft>${scrollBefore}`),'el desplazamiento nativo conserva acceso a las pestañas');
  await evaluate('document.querySelector(".screen-tabs").scrollLeft=0');
  await evaluate('document.querySelector(\'[aria-label="Estado y controles"]\').focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(()=>evaluate('Boolean(document.querySelector(\'[data-renderer="dioxus"] .internal-state\'))'),'teclado abre Estado Dioxus');
  assert.equal(await evaluate('document.querySelector(".shell").classList.contains("is-conversation")'),false);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-frame")).borderRadius'),'14px','Estado comparte el marco de consola');
  await click('.screen-tabs button[aria-label="Conversación con Alice"]'); await ready();
  assert.equal(await evaluate('document.querySelector("#alice-message").value'),'Prueba del estado de error.','Navegar conserva el borrador');
  assert.equal(await evaluate('document.querySelectorAll(".chat-message").length'),2,'Navegar conserva el chat');
  assert.equal(await evaluate('__devices'),0);
  const themedScreens = [];
  const screenCounts = {
    identificacion:7, nucleo:7, flujo:7, estado:7, planificador:7, memoria:7, actividad:7,
    rostro:3, cuerpo:3, avatar:3, puentes:5, auditoria:5, habilidades:5, procedimientos:5, configuracion:5,
  };
  for (const [screen, tabCount] of Object.entries(screenCounts)) {
    const target = new URL(url); target.searchParams.set('screen', screen);
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:target.href});
    await until(()=>evaluate(`Boolean(document.querySelector('main[data-screen="${screen}"] .core-system-content > *'))`), 'Página '+screen);
    assert.equal(await evaluate('document.querySelector("[data-navigation-renderer]")?.dataset.navigationRenderer'),'dioxus');
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".core-system-frame")).borderRadius'),'14px','Marco de consola en '+screen);
    assert.equal(await evaluate('document.querySelectorAll(".screen-tab-icon svg").length'),tabCount,'SVG presentes en '+screen);
    assert.equal(await evaluate('document.querySelectorAll(".screen-tabs [aria-current=page]").length'),1,'Selección original en '+screen);
    await checkNavigation(1280, tabCount);
    if (screen === 'puentes') {
      assert.equal(await evaluate('document.querySelector(".core-system-selector .governance strong").textContent'), 'NÚCLEO DE GOBERNANZA');
      assert.equal(await evaluate('document.querySelectorAll(".bridge-console").length'), 0);
      await click('[aria-controls="permissions-panel"]');
      assert.ok(await evaluate('document.querySelector("#registry-panel").hidden && document.querySelector("#permission-gateway-title").checkVisibility()'));
      await click('[aria-controls="registry-panel"]');
      assert.ok(await evaluate('document.querySelector("#permissions-panel").hidden && document.querySelector(".bridge-layout").checkVisibility()'));
      await click('.governance-audit-link');
      await until(()=>evaluate('Boolean(document.querySelector(\'[data-audit-renderer="dioxus"] .native-audit\'))'), 'El enlace abre Auditoría en Dioxus');
      await click('.activity-view-tabs button:nth-of-type(2)');
      await until(()=>evaluate('document.querySelector(".passive-diagnostic")?.checkVisibility()'),'diagnóstico pasivo visible');
      await click('.screen-tabs button[aria-label="Capacidades y permisos"]');
      await until(()=>evaluate('Boolean(document.querySelector("#registry-panel"))'),'Regreso al inventario');
    }
    if (['memoria','estado','avatar','puentes','configuracion'].includes(screen)) {
      await screenshot('console-'+screen+'.png');
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
    await checkNavigation(390, tabCount);
    themedScreens.push(screen);
  }
  for (const [legacy, screen] of [['face','rostro'], ['body','cuerpo']]) {
    const target = new URL(url);
    target.searchParams.set('screen', 'puentes');
    target.searchParams.set('bridgeView', legacy);
    await send('Page.navigate',{url:target.href});
    await until(()=>evaluate(`Boolean(document.querySelector('[data-navigation-renderer=dioxus] main[data-screen="${screen}"] .core-system-content > *'))`), 'acceso anterior '+legacy);
  }
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  for (const [screen, renderer, component] of [
    ['identificacion','conversation','#alice-message'],
    ['auditoria','audit','.native-audit'],
  ]) {
    await send('Network.setBlockedURLs',{urls:['*.wasm']});
    const target = new URL(url); target.searchParams.set('screen',screen);
    await send('Page.navigate',{url:target.href});
    const unavailable = `[data-${renderer}-renderer=error]`;
    await until(()=>evaluate(`Boolean(document.querySelector(${JSON.stringify(unavailable)}))`), 'el fallo WASM ofrece reintento para '+screen);
    assert.equal(await evaluate('document.querySelector("[data-navigation-renderer]")?.dataset.navigationRenderer'),'error');
    assert.equal(await evaluate(`Boolean(document.querySelector(${JSON.stringify(component)}))`),false,'La ruta React queda inactiva');
    await send('Network.setBlockedURLs',{urls:[]});
    await click(unavailable+' button');
    await until(()=>evaluate(`Boolean(document.querySelector(${JSON.stringify(`[data-${renderer}-renderer=dioxus] ${component}`)}))`),'recuperar Dioxus en '+screen);
    await click('[data-navigation-renderer="error"] > .shell > [role=alert] button');
    await until(()=>evaluate(`Boolean(document.querySelector('[data-navigation-renderer=dioxus] main[data-screen="${screen}"] ${component}'))`),'recuperar la navegación en '+screen);
  }
  const voicePage = new URL(url); voicePage.searchParams.set('screen', 'identificacion');
  await send('Page.navigate',{url:voicePage.href});
  await ready();
  await assertDioxusVoice({ evaluate, click, until });

  const settingsUrl = new URL(url);
  settingsUrl.searchParams.set('screen','configuracion');
  const selectionKey = 'alice-cognitive-core-cloud-selection-v1';
  const modelInput = '.settings-model-field input';
  const historyToggle = '.settings-card[aria-labelledby=conversation-display-title] input';
  const awaitSavedModel = model => until(() => evaluate(`document.querySelector('.settings-provider-list [aria-checked=true]')?.textContent.includes('Motor de prueba local')
    && document.querySelector(${JSON.stringify(modelInput)})?.value === ${JSON.stringify(model)}`), 'preferencia de modelo ' + model);
  await evaluate(`sessionStorage.setItem('alice-fixture-history','ready');
    localStorage.setItem(${JSON.stringify(selectionKey)}, JSON.stringify({provider:'ollama',model:'modelo-previo'}));`);
  await send('Page.navigate',{url:settingsUrl.href});
  await awaitSavedModel('modelo-previo');
  await evaluate(`const field = document.querySelector(${JSON.stringify(modelInput)}); field.focus(); field.select();`);
  await send('Input.insertText',{text:'modelo-actualizado'});
  await until(()=>evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(selectionKey)})).model === 'modelo-actualizado'`),'guardar el modelo con la clave existente');
  await click(historyToggle);
  await click('.core-system-selector .cognitive');
  await ready();
  await until(()=>evaluate('document.querySelectorAll(".chat-message").length===14'),'historial completo desde Configuración');
  assert.ok(await evaluate('document.querySelector(".chat-message").textContent.includes("Mensaje guardado 0")'));
  await send('Page.reload');
  await awaitSavedModel('modelo-actualizado');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(historyToggle)}).checked`),false,'La vista completa se aplica durante la sesión');
  await click('.core-system-selector .cognitive');
  await ready();
  await until(()=>evaluate('document.querySelectorAll(".chat-message").length===12'),'historial guardado al reabrir');
  assert.ok(await evaluate('document.querySelector(".chat-message").textContent.includes("Mensaje guardado 1")'));

  assert.deepEqual(failures,[],'Sin excepciones de navegador');
  const external=network.filter(raw=>/^https?:/.test(raw)&&new URL(raw).origin!==url.origin);
  assert.deepEqual(external,[],'Sin dependencias de red externas');
  assert.ok(network.some(raw=>raw.includes('/fonts/proposal04/sora-latin.woff2')));
  assert.ok(network.some(raw=>raw.includes('/fonts/proposal04/jetbrains-mono-latin.woff2')));
  await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify({passed:true,syntheticIpc:true,realModel:false,physicalDevices:false,sizes,themedScreens,externalRequests:external,uncaughtExceptions:failures,reviewCancelEditConfirmError:true,localDocument:true,inputDiagnostic:true,dioxusRetryWithoutReact:true,keyboardAndCarousel:true,conversationSession:true},null,2));
  console.log('Dashboard Dioxus, Conversación y marco de consola en las 15 pantallas comprobados con IPC sintético. Evidencia: '+artifacts);
  await send('Browser.close');
} catch(error) {
  if(send&&socket?.readyState===WebSocket.OPEN){try{const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(artifacts,'failure.png'),Buffer.from(r.data,'base64'));}catch{}}
  await fs.writeFile(path.join(artifacts,'failure.json'),JSON.stringify({error:String(error),exceptions:failures},null,2));
  console.error('Evidencia: '+artifacts);throw error;
} finally { socket?.close(); if(browser.exitCode===null)browser.kill(); }
