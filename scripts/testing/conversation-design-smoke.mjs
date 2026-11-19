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
    const memoryFixture = sessionStorage.getItem('alice-fixture-memory') === 'ready';
    const studyLessons = memoryFixture ? [
      { lessonId:'prueba-disponible', title:'proyectocomun disponible', passes:1, lastPassed:true, active:true },
      { lessonId:'prueba-repaso', title:'proyectocomun pendiente', passes:0, lastPassed:false, active:true },
      { lessonId:'prueba-retirada', title:'proyectocomun retirada', passes:1, lastPassed:true, active:false },
    ].map(lesson => ({...lesson,id:'study:'+lesson.lessonId,track:'logic',domain:'mathematics',
      content:lesson.title,sourceUrl:'https://example.invalid/fixture',sourceTitle:'Fuente ficticia',
      lessonSha256:'sha256:'+'b'.repeat(64),studiedAt:'2026-11-19T12:00:00Z',attempts:1})) : [];
    let selfStudy = {schemaVersion:1,enabled:false,biblicalTradition:'catholic',phase:'disabled',
      lastStartedAt:null,lastCompletedAt:null,lastError:null,records:studyLessons};
    const automaticMemory = {schemaVersion:1,enabled:false,records:[],activeCount:0,lastOutcome:null};
    let records = memoryFixture ? [
      {id:'legacy',kind:'Conversación',intention:'Recuerdo anterior',summary:'Texto inicial',
        startedAt:'2026-11-19T12:00:00.000Z',finishedAt:'2026-11-19T12:00:01.000Z'},
      {id:'open',kind:'Conversación',intention:'proyectocomun sesión abierta',startedAt:'2026-11-19T12:00:10.000Z'},
    ] : [];
    const workingMemoryBase = {schemaVersion:1,maximumMessages:12,maximumCharacters:72000,ttlSeconds:7200,persisted:false};
    let foregroundGrant = {
      schemaVersion:1,grantId:'foreground_grant_fixture',requestId:'foreground_request_fixture',
      previewDigest:'sha256:'+'c'.repeat(64),capabilityId:'context.foreground.control',operation:'setContextObservationEnabled',
      mode:'session',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+240000).toISOString(),
      remainingUses:null,state:'approved',
    };
    let windowReads = 0;
    for(const method of ['getUserMedia','getDisplayMedia']) if(navigator.mediaDevices) navigator.mediaDevices[method]=async()=>{__devices++;throw Error('No physical devices in design acceptance');};
    globalThis.__TAURI_INTERNALS__={transformCallback:()=>0,invoke:async(cmd,args={})=>{
      __calls.push({cmd,args:structuredClone(args)});
      if(cmd==='cloud_status')return {providers:[
        {id:'ollama',label:'Motor de prueba local',configured:true,defaultModel:'fixture-model',protocol:'synthetic',retentionMode:'no service'},
        {id:'llamacpp',label:'Gemma de prueba',configured:false,defaultModel:'gemma-4-E2B-it-Q4_K_M',protocol:'synthetic',retentionMode:'no service'},
      ]};
      if(cmd==='local_runtime_status' || cmd==='stop_local_runtime')return {running:false};
      if(cmd==='start_local_runtime'){
        if(globalThis.__holdGemmaStart) await new Promise(resolve=>{globalThis.__releaseGemmaStart=resolve;});
        return {running:true};
      }
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
      if(cmd==='load_memory')return {existed:memoryFixture,storagePath:'synthetic-only/records.json',sessions:structuredClone(records)};
      if(cmd==='owner_profile_status')return {state:'missing',storagePath:'synthetic-only/owner-profile.json',sourceFiles:[],records:[]};
      if(cmd==='core_activity_snapshot' && globalThis.__volumeSignalMode){
        const generatedAtMs=Date.now()- (globalThis.__volumeSignalMode==='stale' ? 20_000 : 0);
        return {schemaVersion:2,generatedAtMs,method:'r3-recency-motor-v2',heuristic:true,windowMs:300000,auditHealthy:true,
          visibleEventCount:3,windowEventCount:3,latestEventAtMs:generatedAtMs-300,overallSignal:.4,
          regions:['perception','permission','memory','language','workspace','output','motor'].map(id=>{
            const active=id==='memory'||id==='workspace';
            return {id,label:id,eventCount:active ? 1 : 0,signal:active ? .4 : 0,lastEventAtMs:active ? generatedAtMs-300 : null};
          }),
          links:[['permission','perception'],['perception','workspace'],['memory','workspace'],['language','workspace'],['workspace','output']]
            .map(([from,to])=>({id:from+'-'+to,from,to,evidenceCount:from==='memory' ? 1 : 0,signal:from==='memory' ? .4 : 0})),
        };
      }
      if(cmd==='self_study_status'){
        if(globalThis.__failStudyRead) throw Error('Lectura de autoestudio interrumpida');
        if(globalThis.__volumeStudyRecord && studyLessons.length) return {...selfStudy,records:[
          ...selfStudy.records,{...studyLessons[0],id:'study:volumen-prueba',lessonId:'volumen-prueba',
            title:'Lección añadida con Volumen abierto',content:'Contenido ficticio de la nueva lección'},
        ]};
        return selfStudy;
      }
      if(cmd==='automatic_memory_status')return automaticMemory;
      if(cmd==='set_self_study_enabled' && memoryFixture){
        selfStudy = {...selfStudy,enabled:args.input.enabled,phase:args.input.enabled?'idle':'disabled'};
        return selfStudy;
      }
      if(cmd==='save_memory' && memoryFixture){
        if(globalThis.__rejectSave) throw Error('Escritura de prueba rechazada');
        records = structuredClone(args.sessions);
        return 'synthetic-only/records.json';
      }
      if(cmd==='working_memory_status' && memoryFixture)return {...workingMemoryBase,state:'active',generation:41,exchanges:[{
        exchangeId:'00000000-0000-4000-8000-000000000041',userText:'Hola',assistantText:'Hola',createdAt:'2026-11-19T12:00:01.000Z',
        provider:'ollama',model:'fixture-model',source:'cloudConversation',
      }],exchangeCount:1,messageCount:2,characterCount:8,expiresInSeconds:7000,lastActivityAt:'2026-11-19T12:00:01.000Z'};
      if(cmd==='clear_working_memory' && memoryFixture){
        if(args.input.expectedGeneration!==41 || args.input.confirmed!==true) throw Error('Vaciado de RAM sin revisión');
        return {snapshot:{...workingMemoryBase,state:'empty',generation:42,exchanges:[],exchangeCount:0,messageCount:0,
          characterCount:0,expiresInSeconds:null,lastActivityAt:null},auditHealthy:true,warning:null};
      }
      if(cmd==='permission_gateway_status' && globalThis.__observationFixture){
        const snapshot = {
          schemaVersion:1,generatedAt:new Date().toISOString(),requests:[],grants:[foregroundGrant],
          policy:{denyByDefault:true,persistentGrants:false,r2DecisionCommandsExposed:true,r2ExecutionCommandsExposed:true},
          limits:{highRiskDecisionTtlSeconds:60,standardDecisionTtlSeconds:300,maximumSessionDurationSeconds:300},
        };
        if(globalThis.__holdReviewPermission){
          globalThis.__holdReviewPermission=false;
          await new Promise(resolve=>{globalThis.__releaseReviewPermission=resolve;});
        }
        return snapshot;
      }
      if(cmd==='execute_context_observation_grant' && globalThis.__observationFixture && args.input.grantId===foregroundGrant.grantId){
        foregroundGrant = {...foregroundGrant,state:'active'};
        return {grant:foregroundGrant,enabled:true};
      }
      if(cmd==='revoke_permission_grant' && globalThis.__observationFixture && args.input.grantId===foregroundGrant.grantId){
        foregroundGrant = {...foregroundGrant,state:'revoked'};
        return foregroundGrant;
      }
      if(cmd==='get_foreground_context' && globalThis.__observationFixture){
        if(++windowReads===1)return {processName:'editor-aislado.exe',windowTitle:'Ejemplo autorizado'};
        await new Promise(resolve=>{globalThis.__releaseWindow=resolve;});
        return {processName:'lectura-antigua.exe',windowTitle:'Respuesta tardía de prueba'};
      }
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
    ['configuracion','settings','.settings-page'],
    ['planificador','planner','.task-registry'],
    ['nucleo','volume','.volume-workbench'],
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
  assert.equal(await evaluate('document.querySelector("[data-settings-renderer]")?.dataset.settingsRenderer'),'dioxus');
  assert.ok(await evaluate('(() => { const help = document.querySelector(".settings-page .context-toggle small"); return help && getComputedStyle(help).whiteSpace === "normal" && help.scrollWidth <= help.clientWidth; })()'), 'la ayuda del historial se lee completa');
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
  await evaluate('globalThis.__holdGemmaStart=true');
  await click('.runtime-start');
  await until(()=>evaluate('typeof __releaseGemmaStart==="function" && document.querySelector(".runtime-stop")?.textContent==="Cancelar inicio / apagar"'),'Gemma permite cancelar un inicio pendiente');
  await click('.runtime-stop');
  await until(()=>evaluate('document.querySelector(".settings-runtime [role=status]")?.textContent.includes("Gemma apagado")'),'apagado confirmado');
  await evaluate('globalThis.__holdGemmaStart=false; __releaseGemmaStart()');
  await until(()=>evaluate('document.querySelector(".runtime-start")?.matches(":enabled")'),'inicio anterior liberado');
  await awaitSavedModel('modelo-actualizado');
  await click('.runtime-start');
  await until(()=>evaluate('document.querySelector(".settings-provider-list [aria-checked=true]")?.textContent.includes("Gemma de prueba") && document.querySelector(".settings-model-field input").readOnly'),'Gemma queda seleccionado con modelo fijo');
  assert.ok(await evaluate('Array.from(document.querySelectorAll(".settings-provider-list [role=radio]")).find(button=>button.textContent.includes("Motor de prueba local")).disabled'));
  await click('.runtime-stop');
  await awaitSavedModel('fixture-model');
  assert.equal(await evaluate('__calls.filter(({cmd})=>cmd==="start_voice_session").length'),0,'Iniciar Gemma no enciende la voz');
  await click('.core-system-selector .cognitive');
  await ready();
  await until(()=>evaluate('document.querySelectorAll(".chat-message").length===12'),'historial guardado al reabrir');
  assert.ok(await evaluate('document.querySelector(".chat-message").textContent.includes("Mensaje guardado 1")'));

  await evaluate('sessionStorage.setItem("alice-fixture-memory","ready")');
  const memoryUrl = new URL(url);
  memoryUrl.searchParams.set('screen','memoria');
  await send('Page.navigate',{url:memoryUrl.href});
  await until(()=>evaluate('Boolean(document.querySelector(".memory-storage.storage-native"))'),'memoria persistida al arrancar');
  const memorySection = title => evaluate(`Array.from(document.querySelectorAll('.memory-section-nav button')).find(button=>button.querySelector('strong').textContent===${JSON.stringify(title)}).click()`);
  await memorySection('Recuerdos');
  await until(()=>evaluate('document.querySelector(".memory-record h3")?.textContent==="Recuerdo anterior"'),'registro heredado');
  await click('.memory-record .memory-actions button');
  await evaluate('document.querySelector(".memory-editor textarea").select()');
  await send('Input.insertText',{text:'Texto revisado'});
  await evaluate('globalThis.__rejectSave=true');
  await click('.memory-editor .primary');
  await until(()=>evaluate('document.querySelector(".memory-operation-message")?.textContent.includes("Escritura de prueba rechazada")'),'error de guardado visible');
  assert.equal(await evaluate('document.querySelector(".memory-editor textarea").value'),'Texto revisado');
  await evaluate('globalThis.__rejectSave=false');
  await click('.memory-editor .primary');
  await until(()=>evaluate('document.querySelector(".memory-record .memory-body > p")?.textContent==="Texto revisado"'),'registro actualizado tras confirmación nativa simulada');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="save_memory").length'),2);
  await memorySection('En sesión');
  await until(()=>evaluate('Boolean(document.querySelector(".working-memory-panel.state-active"))'),'RAM activa');
  await evaluate('window.confirm=()=>true');
  await click('.working-memory-panel .danger');
  await until(()=>evaluate('Boolean(document.querySelector(".working-memory-panel.state-empty"))'),'RAM vaciada');
  const ramReads = await evaluate('__calls.filter(call=>call.cmd==="working_memory_status").length');
  await until(()=>evaluate(`__calls.filter(call=>call.cmd==="working_memory_status").length > ${ramReads}`),'sondeo previo al vaciado regresa con generación antigua');
  assert.ok(await evaluate('document.querySelector(".working-memory-panel.state-empty button.danger").disabled'));
  await memorySection('Recuerdos');
  assert.equal(await evaluate('document.querySelector(".memory-record .memory-body > p").textContent'),'Texto revisado');

  await memorySection('Aprendizaje');
  const studySwitch = 'section[aria-labelledby=self-study-title] input[type=checkbox]';
  const automaticSwitch = 'section[aria-labelledby=automatic-memory-title] input[type=checkbox]';
  const studyControl = prop => evaluate(`document.querySelector(${JSON.stringify(studySwitch)})?.${prop}`);
  await until(()=>evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(studySwitch + ',' + automaticSwitch)})).filter(control=>!control.disabled).length===2`),'dos fuentes nativas simuladas disponibles');
  assert.equal(await studyControl('checked'),false);
  assert.equal(await evaluate('__calls.filter(({cmd})=>cmd.startsWith("set_")).length'),0,'Consultar las fuentes no cambia su configuración');
  assert.equal(await evaluate('__calls.filter(({cmd,args})=>cmd==="plugin:event|listen" && args.event==="self-study-updated").length'),1,'Una suscripción al autoestudio');
  await click(studySwitch);
  await until(async()=>await studyControl('checked') && !await studyControl('disabled'),'preferencia aceptada por autoestudio');
  assert.equal(await evaluate('__calls.filter(({cmd})=>cmd==="set_self_study_enabled").length'),1);
  await evaluate('globalThis.__failStudyRead=true');
  await click('.screen-tabs button[data-tooltip="Volumen cognitivo"]');
  await until(()=>evaluate('Boolean(document.querySelector(".volume-learning-refresh button"))'),'acceso a estado de aprendizaje en Volumen');
  await click('.volume-learning-refresh button');
  await until(()=>evaluate('document.querySelector(".volume-learning-source-states > div")?.dataset.state==="error"'),'aviso de lectura fallida');
  await click('.screen-tabs button[data-tooltip="Memoria"]');
  await until(()=>evaluate('Boolean(document.querySelector(".memory-section-nav"))'),'volver a Memoria');
  await memorySection('Aprendizaje');
  await until(()=>studyControl('checked'),'se conserva la última preferencia confirmada');
  assert.ok(await evaluate('document.querySelector(\'section[aria-labelledby=self-study-title] [role=alert]\').textContent.includes("Lectura de autoestudio interrumpida")'));
  await evaluate('globalThis.__failStudyRead=false; globalThis.__volumeSignalMode="live"');
  await click('.screen-tabs button[data-tooltip="Volumen cognitivo"]');
  await until(()=>evaluate('Boolean(document.querySelector(".volume-learning-refresh button"))'),'reintentar lectura');
  await click('.volume-learning-refresh button');
  await until(()=>evaluate('document.querySelector(".volume-learning-source-states > div")?.dataset.state==="ready"'),'recuperar la fuente sin reiniciar');

  await until(()=>evaluate('Array.from(document.querySelectorAll(".volume-learning-metrics dt")).some(dt=>dt.textContent==="Autoestudio registrado" && dt.nextElementSibling?.textContent==="3")'),'Volumen presenta también las lecciones pendientes y retiradas');
  assert.equal(await evaluate('document.querySelector("[data-volume-renderer]")?.dataset.volumeRenderer'),'dioxus');
  await until(()=>evaluate('document.querySelector(".volume-learning-observed span")?.textContent.includes("Desde esta apertura")'),'punto de partida de cambios');
  assert.equal(await evaluate('document.querySelector(".volume-learning-observed strong").textContent'),'0 nuevos · 0 actualizados');
  await evaluate('globalThis.__volumeStudyRecord=true');
  await click('.volume-learning-refresh button');
  await until(()=>evaluate('document.querySelector(".volume-learning-burst")?.textContent.includes("Lección añadida con Volumen abierto")'),'cambio registrado mientras la escena sigue abierta');
  assert.ok(await evaluate('document.querySelector(".volume-learning-changes ul li").textContent.includes("Lección añadida con Volumen abierto")'));
  await evaluate('globalThis.__volumeStudyRecord=false');
  await click('.volume-learning-refresh button');
  await until(()=>evaluate('document.querySelector(".volume-learning-changes ul li").textContent.includes("Fuera de esta vista")'),'el registro sale de la proyección sin contar como nuevo');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Volumen sin desborde en pantalla angosta');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
  await until(()=>evaluate('(()=>{const canvas=document.querySelector(".traceable-volume canvas");return canvas?.width>300 && canvas.getContext("2d").getImageData(canvas.width/2,canvas.height/2,1,1).data[3]>0;})()'),'Canvas 2D dibuja la escena de Volumen');
  const readRecordedCounters = () => evaluate('Array.from(document.querySelectorAll(".volume-signal-metrics dd")).slice(0,3).map(item=>item.textContent)');
  await until(()=>evaluate('document.querySelector(".volume-signal-console")?.dataset.state==="live"'),'volumen con evidencia R3 reciente');
  const recordedCounters = await readRecordedCounters();
  assert.deepEqual(recordedCounters,['3','1','0.400']);
  await click('.volume-signal-modes [data-mode=demo]');
  await until(()=>evaluate('Boolean(document.querySelector(".volume-demo-badge"))'),'demostración señalada en el lienzo');
  assert.deepEqual(await readRecordedCounters(),recordedCounters);
  assert.equal(await evaluate('document.querySelectorAll(".volume-signal-route-list [data-demo=true][data-animating=true]").length'),0,'se respeta movimiento reducido');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await until(()=>evaluate('document.querySelectorAll(".volume-signal-route-list [data-demo=true][data-animating=true]").length>0'),'se habilita el movimiento ilustrativo');
  await click('.volume-signal-tools button');
  await until(()=>evaluate('document.querySelector(".volume-signal-console").dataset.paused==="true"'),'pausa de la demostración');
  await click('.volume-signal-modes button:first-of-type');
  await until(()=>evaluate('!document.querySelector(".volume-demo-badge")'),'volver a las señales registradas');
  await click('.volume-signal-tools button');
  await until(()=>evaluate('document.querySelectorAll(".volume-signal-route-list [data-animating=true]").length===1'),'señal registrada respaldada por evidencia');
  await evaluate('globalThis.__volumeSignalMode="stale"');
  await until(()=>evaluate('document.querySelector(".volume-signal-console").dataset.state==="stale"'),'una muestra vieja deja de animar');
  assert.equal(await evaluate('document.querySelectorAll(".volume-signal-route-list [data-animating=true]").length'),0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await click('.volume-camera-modes button:last-of-type');
  await until(()=>evaluate('Boolean(document.querySelector(".traceable-volume.mode-pan canvas:focus"))'),'mover conserva el foco en el lienzo');
  await click('[aria-label="Acercar volumen"]');
  await until(()=>evaluate('document.querySelector(".volume-camera-actions output").textContent==="118%"'),'zoom de cámara');
  await click('[aria-label="Restablecer vista"]');
  await until(()=>evaluate('document.querySelector(".volume-camera-actions output").textContent==="100%"'),'restablecer cámara');
  await evaluate('document.querySelector(".traceable-volume canvas").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'=',code:'Equal'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'=',code:'Equal'});
  await until(()=>evaluate('document.querySelector(".volume-camera-actions output").textContent==="115%"'),'zoom con teclado');
  const sceneSignature = () => evaluate(`(()=>{const canvas=document.querySelector('.traceable-volume canvas');
    const sample=document.createElement('canvas'); sample.width=sample.height=48;
    sample.getContext('2d').drawImage(canvas,0,0,48,48); return sample.toDataURL();})()`);
  const origin = await evaluate(`(()=>{const canvas=document.querySelector('.traceable-volume canvas');
    canvas.scrollIntoView({block:'center'}); const bounds=canvas.getBoundingClientRect();
    return {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};})()`);
  const beforeDrag = await sceneSignature();
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...origin,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:origin.x+56,y:origin.y+25,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:origin.x+56,y:origin.y+25,button:'left',buttons:0,clickCount:1});
  assert.notEqual(await sceneSignature(),beforeDrag,'arrastrar con Mover desplaza el dibujo');
  await click('.observatory-search summary');
  await evaluate(`(()=>{const select=document.querySelector('.observatory-select select');select.value=[...select.options].find(option=>option.textContent.includes('proyectocomun retirada')).value;select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(()=>evaluate('document.querySelector(".volume-inspector-rail")?.textContent.includes("Retirado del contexto")'),'ficha de una lección retirada');
  assert.equal(await evaluate('document.querySelector(".volume-memory-appearance")?.dataset.state'),'withdrawn');
  await click('.volume-inspector-heading button');
  await until(()=>evaluate('!document.querySelector(".volume-inspector-rail") && Boolean(document.querySelector(".traceable-volume canvas:focus"))'),'cierre accesible de ficha');
  await screenshot('volumen-dioxus.png');
  await evaluate('globalThis.__volumeSignalMode=null');
  await click('.screen-tabs button[data-tooltip="Conversación"]');
  await ready();
  await input('proyectocomun');
  await click('.conversation-context-drawer>summary');
  const matches = '.memory-retrieval-preview article';
  await until(()=>evaluate(`document.querySelector(${JSON.stringify(matches)})?.textContent.includes("proyectocomun disponible")`),'Conversación recupera la lección aprobada');
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(matches)}).length`),1,'Se excluyen la sesión abierta y las lecciones inaplicables');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="send_cloud_message").length'),0,'Consultar el catálogo no envía datos');

  await evaluate('globalThis.__observationFixture=true');
  const buttonNamed = label => `Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()===${JSON.stringify(label)} && !button.disabled && button.checkVisibility())`;
  const clickNamed = async label => {
    await until(()=>evaluate(`Boolean(${buttonNamed(label)})`),label);
    await evaluate(`${buttonNamed(label)}.click()`);
  };
  const showPermissions = async label => {
    await clickNamed(label);
    await until(()=>evaluate('Boolean(document.querySelector(\'[aria-controls="permissions-panel"]\'))'),'ruta de permisos');
    await click('[aria-controls="permissions-panel"]');
  };
  const goToConversationContext = async () => {
    await click('.core-system-selector .cognitive');
    await ready();
    await click('.conversation-context-drawer>summary');
  };
  await showPermissions('Configurar observador en Gateway');
  await until(()=>evaluate(`Boolean(${buttonNamed('ACTIVAR')})`),'permiso aprobado espera la activación');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="get_foreground_context").length'),0,'Aprobar no lee la ventana');
  await clickNamed('ACTIVAR');
  await goToConversationContext();
  await until(()=>evaluate('Boolean(document.querySelector(".conversation-observer-state.active")) && document.querySelector(".conversation-context-drawer").textContent.includes("editor-aislado.exe")'),'muestra sólo la ventana autorizada');
  await until(()=>evaluate('typeof __releaseWindow==="function"'),'segunda lectura permanece pendiente');
  await input('Consulta de prueba con contexto autorizado.');
  await evaluate('Array.from(document.querySelectorAll(".conversation-context-drawer .context-toggle")).find(label=>label.querySelector("strong")?.textContent==="Ventana actual").querySelector("input").click()');
  await click('.composer-footer button');
  await until(()=>evaluate('document.querySelector(".payload-detail pre")?.textContent.includes("editor-aislado.exe")'),'permiso y ventana incluidos en la revisión');
  await evaluate('globalThis.__holdReviewPermission=true');
  await click('.review-actions .primary');
  await until(()=>evaluate('typeof __releaseReviewPermission==="function"'),'se comprueba R2 de nuevo antes de enviar');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="send_cloud_message").length'),0,'Envío bloqueado mientras se valida el permiso');
  await showPermissions('Administrar observador en Gateway');
  await clickNamed('REVOCAR');
  await until(()=>evaluate('document.querySelector(".permission-ledger").textContent.includes("Revocado")'),'revocación confirmada');
  await evaluate('__releaseWindow(); __releaseReviewPermission();');
  await goToConversationContext();
  await until(()=>evaluate('document.querySelector(".conversation-observer-state")?.textContent.includes("INACTIVO")'),'observador inactivo al volver');
  assert.equal(await evaluate('document.querySelector(".conversation-context-drawer").textContent.includes(".exe")'),false,'Una lectura tardía no restaura contexto');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="get_foreground_context").length'),2,'Revocar detiene las consultas');
  await until(()=>evaluate('document.querySelector(".composer-footer button")?.matches(":enabled")'),'el turno cancelado libera el compositor');
  assert.equal(await evaluate('__calls.filter(call=>call.cmd==="send_cloud_message").length'),0,'El permiso anterior no autoriza el envío');

  assert.deepEqual(failures,[],'Sin excepciones de navegador');
  const external=network.filter(raw=>/^https?:/.test(raw)&&new URL(raw).origin!==url.origin);
  assert.deepEqual(external,[],'Sin dependencias de red externas');
  assert.ok(network.some(raw=>raw.includes('/fonts/proposal04/sora-latin.woff2')));
  assert.ok(network.some(raw=>raw.includes('/fonts/proposal04/jetbrains-mono-latin.woff2')));
  await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify({passed:true,syntheticIpc:true,realModel:false,physicalDevices:false,sizes,themedScreens,externalRequests:external,uncaughtExceptions:failures,reviewCancelEditConfirmError:true,localDocument:true,inputDiagnostic:true,dioxusRetryWithoutReact:true,keyboardAndCarousel:true,conversationSession:true,memorySession:true,learningSession:true,memoryCatalog:true,volumeCanvasAndControls:true,volumeLearningChanges:true,volumeSignalFreshness:true,observationRevokesPendingRead:true,revocationBlocksReviewedSend:true},null,2));
  console.log('Dashboard Dioxus, Conversación y marco de consola en las 15 pantallas comprobados con IPC sintético. Evidencia: '+artifacts);
  await send('Browser.close');
} catch(error) {
  if(send&&socket?.readyState===WebSocket.OPEN){try{const r=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(artifacts,'failure.png'),Buffer.from(r.data,'base64'));}catch{}}
  await fs.writeFile(path.join(artifacts,'failure.json'),JSON.stringify({error:String(error),exceptions:failures},null,2));
  console.error('Evidencia: '+artifacts);throw error;
} finally { socket?.close(); if(browser.exitCode===null)browser.kill(); }
