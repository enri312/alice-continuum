// Actual local inference with controlled fixtures; never writes Alice's memories.
import fs from 'node:fs';
const root='artifacts/gemma-evaluation';
const profile=process.argv[2]??'default';
if(!['default','image1120','image1120-gpu'].includes(profile))throw Error('Unknown evaluation profile');
const image=fs.readFileSync(root+'/vision.png').toString('base64');
const wav=fs.readFileSync(root+'/speech.wav');
const silent=Buffer.from(wav);
for(let p=12;p+8<=silent.length;){const n=silent.readUInt32LE(p+4);if(silent.toString('ascii',p,p+4)==='data'){silent.fill(0,p+8,p+8+n);break;}p+=8+n+(n%2);}
const text=t=>({type:'text',text:t});
const audio=b=>({type:'input_audio',input_audio:{data:b.toString('base64'),format:'wav'}});
const vision={type:'image_url',image_url:{url:'data:image/png;base64,'+image}};
const cases=[
 {id:'vision_en',content:[vision,text('Read the project name, status and numeric code in this image, and identify both colored shapes. Do not guess.')],contains:['Faro','PAUSADO','7319','red','blue']},
 {id:'vision_es',content:[vision,text('Responde en español. Lee el nombre del proyecto, estado y código de la imagen, y describe las dos figuras. No inventes.')],contains:['Faro','PAUSADO','7319','rojo','azul']},
 {id:'audio',content:[text('Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.'),audio(wav)],contains:['blue','bicycle','library','47']},
 {id:'silence',content:[text('Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.'),audio(silent)],contains:['NO_SPEECH']},
 {id:'no_audio',content:[text('Transcribe the supplied audio exactly. If there is no intelligible speech or no audio, reply NO_SPEECH. Do not guess.')],contains:['NO_SPEECH']},
 {id:'evidence',content:[text('Fuentes de prueba: [E1] El usuario prefiere explicaciones en español. [E2] Una respuesta anterior del modelo afirmó que el usuario vive en Lima, sin evidencia. [E3] El usuario corrigió: no vivo en Lima; no indiqué mi ciudad. Responde JSON con idioma, ciudad (null si desconocida), fuenteIdioma y fuenteCiudad usando IDs. No conviertas una respuesta del modelo en un hecho.')]},
 {id:'correction',content:[text('El proyecto Faro tenía presupuesto 18, color azul y entrega martes. Después de revisar, el dueño corrigió: presupuesto 27 y entrega jueves. El color no cambia. No autorizó borrar archivos. Responde JSON con color, presupuesto, entrega y borrarArchivos.')],contains:['azul','27','jueves','false']},
];
const report={date:new Date().toISOString(),profile,engine:'llama.cpp b10809 CUDA 12.4',model:'unsloth/gemma-4-E2B-it-GGUF Q4_K_M',fixture:'controlled image, Windows Zira English speech; not a real microphone or Spanish speech test',memoryWrites:false,results:[]};
for(const test of cases){
 const t=performance.now();
 try{
  const r=await fetch('http://127.0.0.1:18089/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'alice-evaluation',messages:[{role:'user',content:test.content}],temperature:0.2,seed:42,max_tokens:220,stream:false,chat_template_kwargs:{enable_thinking:false}}),redirect:'error',signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0,300)}`);
  const data=await r.json();const answer=data.choices?.[0]?.message?.content??'';
  const row={id:test.id,seconds:+((performance.now()-t)/1000).toFixed(2),answer,usage:data.usage,timings:data.timings,finishReason:data.choices?.[0]?.finish_reason,containsExpected:test.contains?.every(x=>answer.toLowerCase().includes(x.toLowerCase()))??null};
  report.results.push(row);console.log(JSON.stringify(row));
 }catch(e){report.results.push({id:test.id,error:e.message});console.log(test.id,e.message);}
 fs.writeFileSync(root+'/llama-results-'+profile+'.json',JSON.stringify(report,null,2));
}
