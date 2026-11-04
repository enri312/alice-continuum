import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { HandsFreeVoice } from "../../../src/components/conversation/HandsFreeVoice";
import { buildCloudPayload } from "../../../src/core/conversation/cloud-payload";
import { processMicrophone } from "../../../src/core/voice/noise-pipeline";
import { isVoiceStopCommand } from "../../../src/core/voice/voice-commands";
import type { CaptureEnvironment } from "../../../src/core/voice/voice-capture";
import type { VoiceTurnTranscript } from "../../../src/core/voice/voice-input";
import type { VoiceOutputResult } from "../../../src/core/voice/voice-output";
import "../../../src/styles/conversation-home.css";
import "./pilot.css";

function Pilot() {
  const [log, setLog] = useState<object[]>([]);
  const [state, setState] = useState("idle");
  const [cancellation, setCancellation] = useState<object | null>(null);
  const [checkingCancellation, setCheckingCancellation] = useState(false);
  const history = useRef<{role:"user"|"assistant";text:string}[]>([]);
  const counts = useRef({transcripts:[] as string[], responses:0, voices:0, revoked:false});
  const fixture = useRef(0);
  const inputContext = useRef<AudioContext | null>(null);
  const lastTranscript = useRef("");
  const append = (event: object) => setLog(previous => [...previous, event]);
  async function checkCancellation() {
    setCheckingCancellation(true);
    let sessionId: string | undefined;
    try {
      const before = await invoke<{revisionId:string;messageCount:number}>("conversation_history_status");
      sessionId = (await invoke<{sessionId:string}>("start_voice_session")).sessionId;
      const message = "Alice, explica con varios ejemplos cómo mantener una conversación natural.";
      const payload = buildCloudPayload({draft:message,includeHistory:false,includeAssistantDialogue:false,recentHistory:[],includeMemory:false,memories:[],includeWindow:false,observationEnabled:false,foregroundContext:null});
      const pending = invoke("send_cloud_message",{request:{message,payload,provider:"llamacpp",model:"gemma-4-E2B-it-Q4_K_M",voiceSessionId:sessionId,historyCount:0,memoryCount:0}})
        .then(()=>({rejected:false}),()=>({rejected:true}));
      await new Promise(resolve=>setTimeout(resolve,50));
      await invoke("stop_voice_session",{input:{sessionId}});
      const result = await pending;
      const after = await invoke<{revisionId:string;messageCount:number}>("conversation_history_status");
      const historyUnchanged = before.revisionId===after.revisionId && before.messageCount===after.messageCount;
      setCancellation({passed:result.rejected&&historyUnchanged,rejected:result.rejected,historyUnchanged,messagesBefore:before.messageCount,messagesAfter:after.messageCount});
    } catch(error) { setCancellation({passed:false,error:String(error)}); }
    finally {if(sessionId)await invoke("stop_voice_session",{input:{sessionId}}).catch(()=>undefined);setCheckingCancellation(false);}
  }
  const environment: CaptureEnvironment = {
    getMicrophone: async () => {
      const index = fixture.current++;
      if (index >= 3) throw Error("Se agotaron las frases sintéticas sin reconocer la parada de voz.");
      const metadata = await (await fetch('/local/artifacts/conversation-session-2026-11-04/fixture-meta.json')).json();
      if(!metadata.ready)throw Error("Las muestras españolas todavía no están preparadas.");
      const context = new AudioContext({sampleRate:48000}); inputContext.current = context;
      await context.resume();
      const spoken = await context.decodeAudioData(await (await fetch(`/local/artifacts/conversation-session-2026-11-04/fixture-${index}.wav`)).arrayBuffer());
      const padded = context.createBuffer(1, spoken.length + 3*48000, 48000);
      padded.copyToChannel(spoken.getChannelData(0),0,72000);
      const source = context.createBufferSource(); source.buffer = padded;
      const output = context.createMediaStreamDestination(); source.connect(output); source.start();
      append({stage:"syntheticCapture", fixture:index, source:metadata.source, microphone:false});
      return output.stream;
    },
    createRecorder: stream => new MediaRecorder(stream,{mimeType:"audio/webm;codecs=opus"}),
    processMicrophone: async (stream, onError, signal) => {
      const input = inputContext.current;
      try {
        const result = await processMicrophone(stream,onError,signal);
        return {...result,close:()=>{result.close();void input?.close().catch(()=>undefined);}};
      } catch (error) { void input?.close().catch(()=>undefined); throw error; }
    },
  };
  const stopped = state === "idle" && counts.current.revoked;
  const passed = stopped && counts.current.responses === 2 && counts.current.voices === 2 && counts.current.transcripts.length === 3 && isVoiceStopCommand(lastTranscript.current);
  return <main><h1>Alice · prueba de conversación por voz</h1>
    <p>Datos separados. Tres frases sintéticas atraviesan el filtro, la transcripción local y la sesión real con Gemma; las dos respuestas se envían a Fish y se reproducen. No se abre el micrófono físico. La tercera frase debe detener la sesión.</p>
    <HandsFreeVoice desktopApp disabled={false} captureEnvironment={environment}
      onStart={async()=>{
        fixture.current=0; history.current=[]; counts.current={transcripts:[],responses:0,voices:0,revoked:false};setLog([]);
        const {sessionId}=await invoke<{sessionId:string}>("start_voice_session");
        try {await invoke("start_local_runtime"); return sessionId;}
        catch(error){await invoke("stop_voice_session",{input:{sessionId}});throw error;}
      }}
      onStop={async sessionId=>{await invoke("stop_voice_session",{input:{sessionId}}); counts.current.revoked=true;append({stage:"sessionRevoked"});}}
      onTranscribe={async(audioBase64,mimeType,sessionId)=>{
        const result=await invoke<VoiceTurnTranscript>("transcribe_voice_turn",{input:{audioBase64,mimeType,confirmed:true,sessionId}});
        counts.current.transcripts.push(result.text);lastTranscript.current=result.text;append({stage:"transcribed",text:result.text,model:result.model,durationMs:result.durationMs});return result;
      }}
      onTurn={async(text,sessionId)=>{
        const payload=buildCloudPayload({draft:text,includeHistory:history.current.length>0,includeAssistantDialogue:true,recentHistory:history.current,includeMemory:false,memories:[],includeWindow:false,observationEnabled:false,foregroundContext:null});
        const started=performance.now();
        const result=await invoke<{text:string;responseId:string;conversationHistory:{exchanges:{responseId:string;exchangeId:string}[]}}>("send_cloud_message",{request:{message:text,payload,provider:"llamacpp",model:"gemma-4-E2B-it-Q4_K_M",voiceSessionId:sessionId,historyCount:counts.current.responses,memoryCount:0}});
        counts.current.responses++;history.current.push({role:"user",text},{role:"assistant",text:result.text});
        append({stage:"responded",text:result.text,durationMs:performance.now()-started});
        const exchange=result.conversationHistory.exchanges.find(item=>item.responseId===result.responseId);if(!exchange)throw Error("No se registró el intercambio de prueba.");
        return {exchangeId:exchange.exchangeId};
      }}
      onSpeak={async(exchangeId,sessionId)=>{
        const started=performance.now();const result=await invoke<VoiceOutputResult>("speak_voice_session_response",{input:{exchangeId,sessionId}});
        counts.current.voices++;append({stage:"synthesized",durationMs:performance.now()-started,characters:result.characterCount});return result;
      }}
      onActiveChange={(_active,next)=>{setState(next);append({stage:"state",value:next});}}
    />
    <h2>Resultado</h2><p id="verdict">{passed?"APROBADA":stopped?"REVISAR":state==="error"?"ERROR":"EN CURSO / PREPARADA"}</p>
    <pre id="report">{JSON.stringify({passed,state,...counts.current,events:log},null,2)}</pre>
    <h2>Respuesta tardía después de detener</h2>
    <p>Consulta sintética local. Detiene la sesión mientras Gemma responde y comprueba que no se agregue un intercambio al historial de prueba. No llama a Fish.</p>
    <button disabled={checkingCancellation || state!=="idle"} onClick={()=>void checkCancellation()}>{checkingCancellation?"Comprobando cancelación…":"Probar cancelación nativa"}</button>
    <pre id="cancellation-report">{cancellation?JSON.stringify(cancellation,null,2):"PENDIENTE"}</pre>
  </main>;
}
createRoot(document.getElementById("pilot")!).render(<Pilot/>);
