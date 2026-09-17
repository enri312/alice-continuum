// Compare identical local image via native and compatible endpoints. No memory writes.
import fs from 'node:fs';
const root='artifacts/gemma-evaluation';
const image=fs.readFileSync(root+'/vision.png').toString('base64');
async function api(route,body){const r=await fetch('http://127.0.0.1:11434'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${(await r.text()).slice(0,200)}`);return r.json();}
if((await api('/api/ps')).models.length)throw Error('Another model is loaded');
const report=[];
const prompt='Describe the attached image. Read the project name, status and numeric code. Identify the two colored shapes. Do not guess if unreadable.';
for(const model of ['gemma4:e2b','gemma4:e4b','qwen3.5:4b']) {
 try {
  const t=performance.now();
  let r;
  if(model.startsWith('gemma')){
   await api('/api/chat',{model,messages:[{role:'user',content:'OK'}],think:false,stream:false,keep_alive:'5m',options:{num_ctx:4096,num_predict:5}});
   r=await api('/v1/chat/completions',{model,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,'+image}},{type:'text',text:prompt}]}],reasoning_effort:'none',temperature:0.2,max_tokens:180,stream:false});
  }else r=await api('/api/chat',{model,messages:[{role:'user',content:prompt,images:[image]}],think:false,stream:false,keep_alive:'5m',options:{num_ctx:4096,num_predict:180,temperature:0.2}});
  const row={model,endpoint:model.startsWith('gemma')?'/v1/chat/completions':'/api/chat',seconds:(performance.now()-t)/1000,answer:r.choices?.[0]?.message?.content??r.message?.content,usage:r.usage,promptTokens:r.prompt_eval_count};
  report.push(row);console.log(JSON.stringify(row));
 }catch(e){report.push({model,error:e.message});console.log(model,e.message);}
 finally{await api('/api/generate',{model,keep_alive:0});fs.writeFileSync(root+'/vision-control.json',JSON.stringify(report,null,2));}
}
