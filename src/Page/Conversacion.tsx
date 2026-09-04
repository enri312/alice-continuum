import { useEffect, useMemo, useRef, useState } from "react";
import { buildRetrievalQuery, retrieveMemories } from "../core/memory-retrieval";
import { buildCloudPayloadReview, type CloudPayloadBudget } from "../core/cloud-payload";
import { selectReinforceableMemoryIds } from "../core/memory-consolidation";
import type { RetrievalOutcome } from "../core/memory-consolidation";
import type { WorkingMemorySnapshot } from "../core/working-memory";
import type { ConversationHistorySnapshot } from "../core/conversation-history";
import "../conversation-context.css";

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
  workingMemory: WorkingMemorySnapshot | null;
  workingMemoryError: string | null;
  conversationHistory: ConversationHistorySnapshot | null;
  conversationHistoryError: string | null;
};

type MemoryExcerpt = { id?: string; kind?: string; intention: string; summary?: string; nextStep?: string; finishedAt?: string; memoryType?: "semantic" | "procedural" | "preference" | "episodic"; source?: string; memoryStatus?: "confirmed" | "conflict" | "archived"; accessibilityStatus?: "accessible" | "dormant"; suppressionStatus?: "suppressed"; archiveStatus?: "archived" };

type ConversacionProps = {
  embedded?: boolean;
  desktopApp: boolean;
  draft: string;
  status: CloudStatus;
  provider: string;
  model: string;
  messages: ConversationMessage[];
  memories: MemoryExcerpt[];
  observationEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  onToggleObservation: () => Promise<void>;
  onDraftChange: (value: string) => void;
  onMemoryRetrieval: (state: { count: number; top: string; ids: string[] }) => void;
  onOpenSettings: () => void;
  onSend: (request: CloudRequest, recalledMemoryIds: string[]) => Promise<CloudResponse>;
  onRetrievalOutcome: (recordId: string, outcome: RetrievalOutcome) => Promise<void>;
};

function messageTime(iso: string) {
  return new Intl.DateTimeFormat("es-PY", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function Conversacion({ embedded = false, desktopApp, draft, status, provider, model, messages, memories, observationEnabled, foregroundContext, onToggleObservation, onDraftChange, onMemoryRetrieval, onOpenSettings, onSend, onRetrievalOutcome }: ConversacionProps) {
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeMemory, setIncludeMemory] = useState(false);
  const [includeWindow, setIncludeWindow] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<CloudRequest | null>(null);
  const [reviewBudget, setReviewBudget] = useState<CloudPayloadBudget | null>(null);
  const [reviewMemoryIds, setReviewMemoryIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingRetrievals, setPendingRetrievals] = useState<{ key: string; recordId: string }[]>([]);
  const [retrievalFeedbackPending, setRetrievalFeedbackPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const reviewRef = useRef<HTMLDivElement>(null);

  const recentHistory = messages.slice(-10);
  const retrievalQuery = useMemo(() => buildRetrievalQuery(draft, recentHistory), [draft, recentHistory]);
  const memoryMatches = useMemo(() => retrieveMemories(retrievalQuery, memories, 3), [memories, retrievalQuery]);
  const dormantMemoryCount = useMemo(() => memories.filter((memory) => memory.accessibilityStatus === "dormant").length, [memories]);
  const suppressedMemoryCount = useMemo(() => memories.filter((memory) => memory.suppressionStatus === "suppressed").length, [memories]);
  const retrievedMemories = memoryMatches.map((match) => match.memory);
  const selectedProvider = status.providers.find((option) => option.id === provider) ?? status.providers[0];
  const localInference = selectedProvider?.id === "ollama";
  const configuredCount = status.providers.filter((option) => option.configured).length;

  useEffect(() => {
    onMemoryRetrieval({ count: memoryMatches.length, top: memoryMatches[0]?.memory.intention ?? "", ids: memoryMatches.flatMap((match) => match.memory.id ? [match.memory.id] : []) });
  }, [memoryMatches, onMemoryRetrieval]);

  useEffect(() => {
    const enableLocalContext = selectedProvider?.id === "ollama";
    setIncludeHistory(enableLocalContext);
    setIncludeMemory(enableLocalContext);
    setReviewing(false);
  }, [selectedProvider?.id]);

  useEffect(() => {
    if (observationEnabled) return;
    setIncludeWindow(false);
    setReviewing(false);
  }, [observationEnabled]);

  useEffect(() => {
    if (!reviewing) return;
    const frame = window.requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reviewing]);

  const payloadReview = useMemo(() => buildCloudPayloadReview({
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
      payload: payloadReview.payload,
      provider,
      model,
      historyCount: includeHistory ? recentHistory.length : 0,
      memoryCount: includeMemory ? retrievedMemories.length : 0,
    });
    setReviewBudget(payloadReview.budget);
    setReviewMemoryIds(includeMemory ? selectReinforceableMemoryIds(retrievedMemories) : []);
    setReviewing(true);
  }

  async function authorizeAndSend() {
    if (!reviewRequest) return;
    setSending(true);
    setError("");
    try {
      const response = await onSend(reviewRequest, reviewMemoryIds);
      if (reviewMemoryIds.length) setPendingRetrievals((current) => [...current, ...reviewMemoryIds.map((recordId) => ({ key: `${response.responseId}:${recordId}:${crypto.randomUUID()}`, recordId }))]);
      if (response.workingMemoryError) setError(`La respuesta llegó, pero la memoria de trabajo informó: ${response.workingMemoryError}`);
      if (response.conversationHistoryError) setError(`La respuesta llegó, pero el historial local no pudo guardarse: ${response.conversationHistoryError}`);
      onDraftChange("");
      setReviewing(false);
      setReviewBudget(null);
      setReviewMemoryIds([]);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSending(false);
    }
  }

  async function recordRetrievalOutcome(key: string, recordId: string, outcome: RetrievalOutcome) {
    setRetrievalFeedbackPending(key);
    setError("");
    try {
      await onRetrievalOutcome(recordId, outcome);
      setPendingRetrievals((current) => current.filter((item) => item.key !== key));
    } catch (cause) {
      setError(`No se guardó la evaluación del recuerdo: ${String(cause)}`);
    } finally {
      setRetrievalFeedbackPending(null);
    }
  }

  return <section className={`conversation-page ${embedded ? "embedded" : ""}`} aria-labelledby={embedded ? undefined : "conversation-title"} aria-label={embedded ? "Conversación real con Alice" : undefined}>
    {!embedded && <div className="conversation-heading">
      <div><p className="eyebrow">CANAL AUTORIZADO · CONVERSACIÓN</p><h2 id="conversation-title">Conversación con Alice</h2><p>Escribí normalmente. Antes de procesarse localmente o salir de tu computadora, el contenido pasa por una revisión visible y requiere tu autorización.</p></div>
      <div className={`cloud-status ${configuredCount ? "ready" : "offline"}`}><i />{configuredCount ? `${configuredCount} PROVEEDOR${configuredCount > 1 ? "ES" : ""} DISPONIBLE${configuredCount > 1 ? "S" : ""}` : "SIN PROVEEDOR LISTO"}</div>
    </div>}

    <div className="conversation-layout">
      <div className="chat-column">
        <div className="message-stream" aria-live="polite">
          {messages.length === 0 ? <div className="chat-empty"><span>A</span><h3>Estoy lista para conversar.</h3><p>No necesitás iniciar una misión. Podés preguntarme, estudiar conmigo o traer una idea para investigar.</p></div> : messages.map((item) => <article key={item.id} className={`chat-message ${item.role}`}><div className="message-author">{item.role === "user" ? "CARLOS NUÑEZ" : "ALICE"}<small>{messageTime(item.createdAt)}</small></div><p>{item.text}</p>{item.model && <span className="message-model">{item.model}</span>}</article>)}
        </div>
        {pendingRetrievals.length > 0 && <section className="retrieval-outcome-review" aria-label="Evaluación real de recuerdos recuperados"><header><div><strong>R6.5-F · RESULTADO DE RECUPERACIÓN</strong><span>Confirmación humana · no modifica fuerza ni reposo</span></div><em>{pendingRetrievals.length} pendiente{pendingRetrievals.length === 1 ? "" : "s"}</em></header>{pendingRetrievals.map(({ key, recordId }) => { const memory = memories.find((item) => item.id === recordId); return <article key={key}><div><span>¿ESTE RECUERDO AYUDÓ?</span><strong>{memory?.intention ?? recordId}</strong></div><div><button type="button" className="secondary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "not-helpful")}>No ayudó</button><button type="button" className="primary" disabled={retrievalFeedbackPending === key} onClick={() => void recordRetrievalOutcome(key, recordId, "helpful")}>Sí, fue útil</button></div></article>; })}</section>}
        {error && !reviewing && <p className="cloud-error" role="alert">{error}</p>}
        <div className="composer">
          <label htmlFor="alice-message">MENSAJE PARA ALICE</label>
          <textarea id="alice-message" value={draft} onChange={(event) => { onDraftChange(event.target.value); setReviewing(false); }} placeholder="Preguntá, explicá una idea o pedí ayuda…" />
          <div className="composer-footer"><span>{localInference ? "Primero verás exactamente qué contexto procesará el modelo local." : "Primero verás exactamente qué datos saldrán de tu PC."}</span><button className="primary" title="Abre la previsualización de privacidad; todavía no procesa el mensaje" onClick={prepareReview} disabled={!draft.trim() || sending}>{localInference ? "Revisar contexto local" : "Ver qué se enviará"} <span>→</span></button></div>
        </div>
      </div>

      <aside className="cloud-control">
        <p className="eyebrow">CONTROL DE CONTEXTO</p>
        <h3>{localInference ? "Qué puede procesar" : "Qué puede salir"}</h3>
        <div className="context-section-label"><strong>{localInference ? "CONTEXTO LOCAL AUTORIZADO" : "SALIDA A LA NUBE"}</strong><span>FUENTES SELECCIONADAS · DATOS REALES</span></div>
        <label className={`context-toggle ${recentHistory.length ? "available" : "waiting"}`}><input type="checkbox" checked={includeHistory} onChange={(event) => { setIncludeHistory(event.target.checked); setReviewing(false); }} /><span><strong>Historial reciente</strong><small>{recentHistory.length ? `${recentHistory.length} mensajes locales disponibles · máximo 10 por consulta` : "seleccionado · todavía no hay mensajes guardados"}</small></span></label>
        <label className={`context-toggle ${draft.trim() ? "available" : "waiting"}`}><input type="checkbox" checked={includeMemory} onChange={(event) => { setIncludeMemory(event.target.checked); setReviewing(false); }} /><span><strong>{localInference ? "RAG local de recuerdos" : "Recuerdos relevantes"}</strong><small>{draft.trim() ? `${memoryMatches.length} coincidencias de ${memories.length} recuerdos · ${dormantMemoryCount} en reposo · ${suppressedMemoryCount} suprimidos` : "seleccionado · espera un mensaje para buscar"}</small></span></label>
        {draft.trim() && memoryMatches.length > 0 && !includeMemory && <p className="memory-authorization-warning" role="status">Alice encontró {memoryMatches.length} recuerdos, pero no se {localInference ? "procesarán" : "enviarán"} mientras esta casilla siga desmarcada.</p>}
        {draft.trim() && <div className="memory-retrieval-preview" aria-live="polite"><div><strong>RECUPERACIÓN LOCAL</strong><span>LEXICAL · MÁX. 3 · REPOSO Y SUPRESIÓN EXCLUIDOS</span></div>{memoryMatches.length ? memoryMatches.map((match) => <article key={match.memory.id ?? `${match.memory.intention}-${match.score}`}><header><strong>{match.memory.intention}</strong><span>{match.score.toFixed(3)}</span></header><p>{match.reason}</p></article>) : <p className="retrieval-empty">No hay recuerdos accesibles relacionados. No se adjuntará memoria.</p>}</div>}
        <label className={`context-toggle ${foregroundContext ? "available" : "waiting"}`}><input type="checkbox" checked={includeWindow} disabled={!observationEnabled || !foregroundContext} onChange={(event) => { setIncludeWindow(event.target.checked); setReviewing(false); }} /><span><strong>Ventana actual</strong><small>{foregroundContext ? `${foregroundContext.processName} · metadatos disponibles` : "no seleccionable · observador sin contexto"}</small></span></label>
        <div className={`conversation-observer-state ${observationEnabled ? "active" : ""}`}><i /><span><strong>{observationEnabled ? "OBSERVADOR LOCAL ACTIVO" : "OBSERVADOR LOCAL INACTIVO"}</strong><small>{observationEnabled ? localInference ? "Hay metadatos locales. Sólo se procesarán al marcar Ventana actual y autorizar." : "Hay metadatos locales. Sólo saldrán al marcar Ventana actual y autorizar." : "No está autorizado ni está capturando metadatos de la ventana."}</small></span></div>
        {desktopApp && <button type="button" className={observationEnabled ? "console-button observing" : "console-button"} onClick={onToggleObservation}>{observationEnabled ? "Administrar observador en Gateway" : "Configurar observador en Gateway"}</button>}
        <p className="context-sensor-boundary">Esta conversación sólo admite el nombre del proceso y el título de la ventana. Cámara, micrófono, fotogramas y audio quedan fuera.</p>
        <div className="context-section-label local"><strong>CONTINUIDAD LOCAL</strong><span>HISTORIAL + RAM</span></div>
        <div className="conversation-working-memory"><i /><span><strong>CONVERSACIÓN GUARDADA LOCALMENTE</strong><small>Cada intercambio exitoso se conserva para continuar después de reiniciar. También entra en la RAM inmediata, pero no se convierte automáticamente en recuerdo ni en hecho confirmado.</small></span></div>
        <div className="conversation-route"><strong>MOTOR SELECCIONADO · SIN HERRAMIENTAS</strong><span>{selectedProvider?.label ?? provider}</span><small>{model || "modelo sin configurar"}</small></div>
        <div className="cloud-rule"><strong>{localInference ? "POLÍTICA DE INFERENCIA" : "POLÍTICA DE ENVÍO"}</strong><span>{selectedProvider?.protocol ?? "adaptador nativo"} · {selectedProvider?.retentionMode ?? "retención según proveedor"} · {localInference ? "contexto 4096 · máximo 900 tokens de salida" : "máximo 1200 tokens de salida"} · sin herramientas · previsualización obligatoria</span></div>
        <button type="button" className="conversation-settings-link" onClick={onOpenSettings}>Cambiar proveedor o modelo en Configuración</button>
      </aside>
    </div>

    {reviewing && <div className="send-review" ref={reviewRef} tabIndex={-1}>
      <div className="review-heading"><div><p className="eyebrow">PREVISUALIZACIÓN OBLIGATORIA</p><h3>{reviewRequest?.provider === "ollama" ? "Esto se procesará localmente con" : "Esto se enviará a"} {status.providers.find((option) => option.id === reviewRequest?.provider)?.label ?? reviewRequest?.provider}</h3></div><span>{reviewRequest?.model}</span></div>
      <div className="payload-budget" aria-label="Presupuesto exacto del contexto autorizado">
        <header><strong>{reviewRequest?.provider === "ollama" ? "PRESUPUESTO DE CONTEXTO LOCAL" : "PRESUPUESTO DE SALIDA"}</strong><span>CARACTERES · BYTES UTF-8</span></header>
        {reviewBudget?.fragments.map((item) => <div key={item.id} className={item.included ? "included" : "excluded"}><span>{item.label}{item.optional ? " · opcional" : ""}</span><strong>{item.characters.toLocaleString("es-PY")}</strong><em>{item.utf8Bytes.toLocaleString("es-PY")} B</em><small>{item.included ? "INCLUIDO" : "NO AUTORIZADO"}</small></div>)}
        <div className="separators"><span>Separadores de secciones</span><strong>{reviewBudget?.separatorCharacters.toLocaleString("es-PY") ?? 0}</strong><em>{reviewBudget?.separatorUtf8Bytes.toLocaleString("es-PY") ?? 0} B</em><small>FORMATO</small></div>
        <footer><span>TOTAL EXACTO DEL PAYLOAD</span><strong>{reviewBudget?.totalCharacters.toLocaleString("es-PY") ?? 0} caracteres</strong><em>{reviewBudget?.totalUtf8Bytes.toLocaleString("es-PY") ?? 0} bytes UTF-8</em></footer>
      </div>
      <pre>{reviewRequest?.payload}</pre>
      <p className="review-note">Además se incluye una política breve: responder en español, no afirmar acciones no realizadas y pedir aprobación antes de acciones externas o costosas. Si la respuesta llega, el intercambio se guardará en el historial local de Alice sin promoverlo automáticamente a recuerdo.</p>
      {!desktopApp && <p className="cloud-error">La inferencia sólo funciona desde la aplicación de escritorio.</p>}
      {desktopApp && !selectedProvider?.configured && <p className="cloud-error">{localInference ? "Ollama local no está iniciado. Abrí Alice mediante Iniciar Alice.cmd." : "Este proveedor todavía no tiene sus variables de entorno configuradas. Alice no puede enviar la consulta."}</p>}
      {error && <p className="cloud-error">{error}</p>}
      <div className="review-actions"><button className="secondary" onClick={() => setReviewing(false)} disabled={sending}>Volver a editar</button><button className="primary" onClick={authorizeAndSend} disabled={sending || !reviewRequest || !desktopApp || !selectedProvider?.configured || !reviewRequest?.model.trim()}>{sending ? "Consultando…" : localInference ? "Autorizar y procesar localmente" : "Autorizar y enviar a la nube"}</button></div>
    </div>}
  </section>;
}
