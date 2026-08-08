import { useEffect, useMemo, useState } from "react";
import { retrieveMemories } from "../core/memory-retrieval";
import { buildCloudPayload } from "../core/cloud-payload";
import { selectReinforceableMemoryIds } from "../core/memory-consolidation";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  model?: string;
};

export type CloudStatus = {
  providers: CloudProvider[];
};

export type CloudProvider = { id: string; label: string; configured: boolean; defaultModel: string; protocol: string; retentionMode: string };

export type CloudRequest = {
  message: string;
  payload: string;
  provider: string;
  model: string;
  historyCount: number;
  memoryCount: number;
};

export type CloudResponse = {
  text: string;
  provider: string;
  model: string;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
};

type MemoryExcerpt = { id?: string; kind?: string; intention: string; summary?: string; nextStep?: string; finishedAt?: string; memoryStatus?: "confirmed" | "conflict" | "archived" };

type ConversacionProps = {
  desktopApp: boolean;
  draft: string;
  status: CloudStatus;
  messages: ConversationMessage[];
  memories: MemoryExcerpt[];
  observationEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  onToggleObservation: () => Promise<void>;
  onDraftChange: (value: string) => void;
  onMemoryRetrieval: (state: { count: number; top: string }) => void;
  onSend: (request: CloudRequest, rememberLocally: boolean, recalledMemoryIds: string[]) => Promise<CloudResponse>;
};

function messageTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function Conversacion({ desktopApp, draft, status, messages, memories, observationEnabled, foregroundContext, onToggleObservation, onDraftChange, onMemoryRetrieval, onSend }: ConversacionProps) {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [includeWindow, setIncludeWindow] = useState(false);
  const [rememberLocally, setRememberLocally] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<CloudRequest | null>(null);
  const [reviewMemoryIds, setReviewMemoryIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const recentHistory = messages.slice(-6);
  const memoryMatches = useMemo(() => retrieveMemories(draft, memories, 3), [draft, memories]);
  const retrievedMemories = memoryMatches.map((match) => match.memory);
  const selectedProvider = status.providers.find((option) => option.id === provider) ?? status.providers[0];
  const configuredCount = status.providers.filter((option) => option.configured).length;

  useEffect(() => {
    if (provider || !status.providers.length) return;
    const initialProvider = status.providers.find((option) => option.configured)
      ?? (!desktopApp ? status.providers[0] : undefined);
    if (!initialProvider) return;
    setProvider(initialProvider.id);
    setModel(initialProvider.defaultModel);
  }, [desktopApp, provider, status.providers]);

  useEffect(() => {
    onMemoryRetrieval({ count: memoryMatches.length, top: memoryMatches[0]?.memory.intention ?? "" });
  }, [memoryMatches, onMemoryRetrieval]);

  const payload = useMemo(() => buildCloudPayload({
    draft,
    includeHistory,
    recentHistory,
    includeMemory,
    memories: retrievedMemories,
    includeWindow,
    observationEnabled,
    foregroundContext,
  }), [draft, foregroundContext, includeHistory, includeMemory, includeWindow, observationEnabled, recentHistory, retrievedMemories]);

  function prepareReview() {
    if (!draft.trim()) return;
    setError("");
    setReviewRequest({
      message: draft.trim(),
      payload,
      provider,
      model,
      historyCount: includeHistory ? recentHistory.length : 0,
      memoryCount: includeMemory ? retrievedMemories.length : 0,
    });
    setReviewMemoryIds(includeMemory ? selectReinforceableMemoryIds(retrievedMemories) : []);
    setReviewing(true);
  }

  async function authorizeAndSend() {
    if (!reviewRequest) return;
    setSending(true);
    setError("");
    try {
      await onSend(reviewRequest, rememberLocally, reviewMemoryIds);
      onDraftChange("");
      setReviewing(false);
      setReviewMemoryIds([]);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSending(false);
    }
  }

  return <section className="conversation-page" aria-labelledby="conversation-title">
    <div className="conversation-heading">
      <div><p className="eyebrow">CANAL AUTORIZADO · MULTIPROVEEDOR</p><h2 id="conversation-title">Conversación con Alice</h2><p>Escribí normalmente. Elegí el proveedor y el modelo; antes de salir de tu computadora, el contenido pasa por una revisión visible.</p></div>
      <div className={`cloud-status ${configuredCount ? "ready" : "offline"}`}><i />{configuredCount ? `${configuredCount} PROVEEDOR${configuredCount > 1 ? "ES" : ""} DISPONIBLE${configuredCount > 1 ? "S" : ""}` : "FALTA API KEY"}</div>
    </div>

    <div className="conversation-layout">
      <div className="chat-column">
        <div className="message-stream" aria-live="polite">
          {messages.length === 0 ? <div className="chat-empty"><span>A</span><h3>Estoy lista para conversar.</h3><p>No necesitás iniciar una misión. Podés preguntarme, estudiar conmigo o traer una idea para investigar.</p></div> : messages.map((item) => <article key={item.id} className={`chat-message ${item.role}`}><div className="message-author">{item.role === "user" ? "CARLOS NUÑEZ" : "ALICE"}<small>{messageTime(item.createdAt)}</small></div><p>{item.text}</p>{item.model && <span className="message-model">{item.model}</span>}</article>)}
        </div>
        <div className="composer">
          <label htmlFor="alice-message">MENSAJE PARA ALICE</label>
          <textarea id="alice-message" value={draft} onChange={(event) => { onDraftChange(event.target.value); setReviewing(false); }} placeholder="Preguntá, explicá una idea o pedí ayuda…" />
          <div className="composer-footer"><span>Primero verás exactamente qué datos saldrán de tu PC.</span><button className="primary" title="Abre la previsualización de privacidad; todavía no envía el mensaje" onClick={prepareReview} disabled={!draft.trim() || sending}>Ver qué se enviará <span>→</span></button></div>
        </div>
      </div>

      <aside className="cloud-control">
        <p className="eyebrow">CONTROL DE CONTEXTO</p>
        <h3>Qué puede salir</h3>
        <div className="provider-picker">{status.providers.map((option) => <button key={option.id} className={provider === option.id ? "selected" : ""} onClick={() => { setProvider(option.id); setModel(option.defaultModel); setReviewing(false); }}><strong>{option.label}</strong><span>{option.configured ? "LISTO" : "SIN CLAVE"}</span></button>)}</div>
        <label className="model-field">MODELO<input value={model} onChange={(event) => { setModel(event.target.value); setReviewing(false); }} placeholder="Identificador del modelo" /></label>
        <label className="context-toggle"><input type="checkbox" checked={includeHistory} onChange={(event) => { setIncludeHistory(event.target.checked); setReviewing(false); }} /><span><strong>Historial reciente</strong><small>{recentHistory.length} mensajes locales disponibles</small></span></label>
        <label className="context-toggle"><input type="checkbox" checked={includeMemory} disabled={!memoryMatches.length} onChange={(event) => { setIncludeMemory(event.target.checked); setReviewing(false); }} /><span><strong>Recuerdos relevantes</strong><small>{draft.trim() ? `${memoryMatches.length} coincidencias de ${memories.length} recuerdos` : "escribí un mensaje para buscar"}</small></span></label>
        {draft.trim() && <div className="memory-retrieval-preview" aria-live="polite"><div><strong>RECUPERACIÓN LOCAL</strong><span>LEXICAL · MÁX. 3</span></div>{memoryMatches.length ? memoryMatches.map((match) => <article key={match.memory.id ?? `${match.memory.intention}-${match.score}`}><header><strong>{match.memory.intention}</strong><span>{match.score.toFixed(3)}</span></header><p>{match.reason}</p></article>) : <p className="retrieval-empty">No hay recuerdos relacionados. No se adjuntará memoria.</p>}</div>}
        <label className="context-toggle"><input type="checkbox" checked={includeWindow} disabled={!observationEnabled || !foregroundContext} onChange={(event) => { setIncludeWindow(event.target.checked); setReviewing(false); }} /><span><strong>Ventana actual</strong><small>{foregroundContext ? foregroundContext.processName : "sin contexto observado"}</small></span></label>
        {desktopApp && <button className={observationEnabled ? "console-button observing" : "console-button"} onClick={onToggleObservation}>{observationEnabled ? "Detener observación" : "Activar observación de ventana"}</button>}
        <label className="context-toggle memory-choice"><input type="checkbox" checked={rememberLocally} onChange={(event) => setRememberLocally(event.target.checked)} /><span><strong>Recordar localmente</strong><small>Guarda pregunta y respuesta en tu JSON privado</small></span></label>
        <div className="cloud-rule"><strong>POLÍTICA FIJA</strong><span>{selectedProvider?.protocol ?? "adaptador nativo"} · {selectedProvider?.retentionMode ?? "retención según proveedor"} · máximo 1200 tokens · sin herramientas</span></div>
      </aside>
    </div>

    {reviewing && <div className="send-review">
      <div className="review-heading"><div><p className="eyebrow">PREVISUALIZACIÓN OBLIGATORIA</p><h3>Esto se enviará a {status.providers.find((option) => option.id === reviewRequest?.provider)?.label ?? reviewRequest?.provider}</h3></div><span>{reviewRequest?.model}</span></div>
      <pre>{reviewRequest?.payload}</pre>
      <p className="review-note">Además se adjunta una política breve: responder en español, no afirmar acciones no realizadas y pedir aprobación antes de acciones externas o costosas.</p>
      {!desktopApp && <p className="cloud-error">La llamada de nube solo funciona desde la aplicación de escritorio.</p>}
      {desktopApp && !selectedProvider?.configured && <p className="cloud-error">Este proveedor todavía no tiene sus variables de entorno configuradas. Alice no puede enviar la consulta.</p>}
      {error && <p className="cloud-error">{error}</p>}
      <div className="review-actions"><button className="secondary" onClick={() => setReviewing(false)} disabled={sending}>Volver a editar</button><button className="primary" onClick={authorizeAndSend} disabled={sending || !reviewRequest || !desktopApp || !selectedProvider?.configured || !reviewRequest?.model.trim()}>{sending ? "Consultando…" : "Autorizar y enviar a la nube"}</button></div>
    </div>}
  </section>;
}
