const token = '__TOKEN__';
const el = id => document.getElementById(id);
let recorder, stream, chunks = [], take, timer, active = false, cancelled = false, processing = false, closed = false;
const message = text => { el('state').textContent = text; };
function release() { clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); stream = null; }
function buttons() {
  if (closed) { document.querySelectorAll('button').forEach(b => b.disabled = true); return; }
  el('start').disabled = active || processing || !!take;
  el('finish').disabled = !active || !recorder || recorder.state !== 'recording';
  el('discard').disabled = processing || (!active && !take);
  el('transcribe').disabled = !take || processing || active;
  el('copy').disabled = !el('text').value.trim();
}
el('start').onclick = async () => {
  active = true; cancelled = false; buttons(); message('Solicitando permiso de micrófono…');
  try {
    if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) throw Error('Usá Edge o Chrome para este piloto WebM.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (cancelled) { release(); active = false; buttons(); return; }
    chunks = []; el('text').value = '';
    recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      release(); active = false;
      take = cancelled ? null : new Blob(chunks, { type: 'audio/webm' }); chunks = [];
      if (!closed) message(cancelled ? 'Toma descartada. No se envió nada.' : 'Micrófono apagado. La toma está solo en RAM; pulsá Transcribir cuando quieras.'); buttons();
    };
    recorder.onerror = () => { cancelled = true; release(); active = false; take = null; message('Falló la grabación. Reintentá.'); buttons(); };
    recorder.start(); buttons(); message('Grabando. Podés hacer pausas: solo «Terminé de hablar» cierra tu turno (máximo 60 s).');
    timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 60000);
  } catch (e) { release(); active = false; message(e.message); buttons(); }
};
el('finish').onclick = () => { if (recorder?.state === 'recording') { recorder.stop(); release(); el('finish').disabled = true; } };
el('discard').onclick = () => {
  cancelled = true; take = null; chunks = [];
  if (recorder?.state === 'recording') recorder.stop();
  release(); if (!active) { message('Toma descartada.'); buttons(); }
};
el('transcribe').onclick = async () => {
  processing = true; buttons(); message('Transcribiendo en tu equipo…');
  try {
    const r = await fetch('/transcribe', { method: 'POST', headers: { 'X-Pilot-Token': token, 'Content-Type': 'audio/webm' }, body: take, signal: AbortSignal.timeout(120000) });
    const result = await r.json(); if (!r.ok) throw Error(result.error);
    el('text').value = result.text; take = null;
    message(result.noSpeech ? 'No se obtuvo voz inteligible. No se guardó nada.' : 'Revisá el texto. No fue enviado al chat ni guardado como recuerdo.');
  } catch (e) { message('No se completó: ' + e.message + '. Podés reintentar o descartar.'); }
  finally { processing = false; buttons(); }
};
el('text').oninput = buttons;
el('copy').onclick = async () => { try { await navigator.clipboard.writeText(el('text').value); message('Texto copiado por tu solicitud.'); } catch { message('No se pudo copiar. Seleccioná el texto y usá Ctrl+C.'); } };
el('close').onclick = async () => {
  closed = true;
  cancelled = true; if (recorder?.state === 'recording') recorder.stop(); release();
  try { await fetch('/shutdown', { method: 'POST', headers: { 'X-Pilot-Token': token } }); } catch {}
  take = null; chunks = []; document.querySelectorAll('button').forEach(b => b.disabled = true); message('Piloto cerrado.');
};
addEventListener('pagehide', () => { cancelled = true; if (recorder?.state === 'recording') recorder.stop(); release(); });
fetch('/health').then(r => r.json()).then(s => { if (!s.ready) throw Error('Motor todavía no disponible. Recargá en unos segundos.'); buttons(); message('Listo. El micrófono está apagado.'); }).catch(e => message(e.message));
