// Synthetic English speech fixture; actual model inference, not a microphone/Spanish test.
import fs from 'node:fs';
const root='artifacts/gemma-evaluation';
const wav=fs.readFileSync(root+'/speech.wav');
const silent=Buffer.from(wav);
// Keep WAV structure, zero only PCM data. System.Speech writes signed 16-bit PCM.
let dataOffset=-1,dataLength=0;
for(let p=12;p+8<=silent.length;) {
 const length=silent.readUInt32LE(p+4);
 if(silent.toString('ascii',p,p+4)==='data'){dataOffset=p+8;dataLength=length;break;}
 p+=8+length+(length%2);
}
if(dataOffset<0 || dataOffset+dataLength>silent.length) throw Error('Invalid WAV');
silent.fill(0,dataOffset,dataOffset+dataLength);
async function api(route,body){const r=await fetch('http://127.0.0.1:11434'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);return r.json();}
if((await api('/api/ps')).models.length)throw Error('Another model is loaded');
const report={date:new Date().toISOString(),fixture:'Windows Zira synthetic English speech; not live microphone or Spanish speech',memoryWrites:false,results:[]};
const save=()=>fs.writeFileSync(root+'/audio-results.json',JSON.stringify(report,null,2));
for(const model of ['gemma4:e2b','gemma4:e4b']) {
 try {
  await api('/api/chat',{model,messages:[{role:'user',content:'Responde OK.'}],think:false,stream:false,keep_alive:'5m',options:{num_ctx:4096,num_predict:10}});
  for(const kind of ['speech','silence','no_audio']){
   const content=[{type:'text',text:'Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.'}];
   if(kind!=='no_audio')content.push({type:'input_audio',input_audio:{data:(kind==='speech'?wav:silent).toString('base64'),format:'wav'}});
   const t=performance.now();
   try {
    const r=await api('/v1/chat/completions',{model,messages:[{role:'user',content}],temperature:0,max_tokens:100,reasoning_effort:'none',stream:false});
    const row={model,kind,seconds:+((performance.now()-t)/1000).toFixed(2),usage:r.usage,finishReason:r.choices?.[0]?.finish_reason,answer:r.choices?.[0]?.message?.content};
    report.results.push(row);console.log(JSON.stringify(row));
   }catch(e){report.results.push({model,kind,error:e.message});console.log(model,kind,e.message);}
   save();
  }
 } finally {await api('/api/generate',{model,keep_alive:0});save();}
}
