// Synthetic test phrases only. Keys/profile stay in the process and never in logs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const output=path.resolve('artifacts/conversation-session-2026-11-04');
const stored=name=>process.env[name]||execFileSync('powershell.exe',['-NoProfile','-Command',`[Console]::Write([Environment]::GetEnvironmentVariable('${name}','User'))`],{encoding:'utf8',windowsHide:true}).trim();
const key=stored('FISH_API_KEY'), reference=stored('ALICE_FISH_REFERENCE_ID');
if(!key||!reference)throw Error('Falta configuración local de voz; no se generaron muestras.');
fs.writeFileSync(path.join(output,'fixture-meta.json'),JSON.stringify({ready:false,source:'Fish s2.1-pro-free · español'}));
const texts=['Hola, Alice. Quiero mejorar tu forma de conversar.','Me refiero a ti, Alice, a tus respuestas.','Detén la conversación, Alice.'];
const timings=[];
for(let index=0;index<texts.length;index++){
  const wav=path.join(output,`fixture-${index}.wav`);
  const original=path.join(output,`fixture-sapi-${index}.wav`);
  if(fs.existsSync(wav)&&!fs.existsSync(original))fs.copyFileSync(wav,original);
  const started=performance.now();
  const response=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:`Bearer ${key}`,model:'s2.1-pro-free','Content-Type':'application/json'},body:JSON.stringify({text:`[warm, conversational] ${texts[index]}`,reference_id:reference,format:'mp3',temperature:0.6,latency:'balanced',prosody:{speed:1,normalize_loudness:true},normalize:true}),signal:AbortSignal.timeout(240000)});
  if(!response.ok)throw Error(`El proveedor no generó la muestra ${index}: HTTP ${response.status}`);
  const mp3=path.join(output,`fixture-spanish-${index}.mp3`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>12*1024*1024)throw Error('La muestra excede el límite.');
  fs.writeFileSync(mp3,bytes);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',mp3,'-ac','1','-ar','48000',wav],{windowsHide:true,stdio:'ignore'});
  timings.push({index,text:texts[index],durationMs:Math.round(performance.now()-started)});
  console.log(`Muestra española ${index+1}/3 preparada.`);
}
fs.writeFileSync(path.join(output,'fixture-meta.json'),JSON.stringify({ready:true,source:'Fish s2.1-pro-free · español',timings},null,2));
