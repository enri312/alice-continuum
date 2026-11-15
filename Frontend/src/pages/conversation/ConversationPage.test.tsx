import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildHybridRetrievalCandidates, Conversacion, reviewUsesCurrentRoute, visibleConversationMessages, VoiceTurnMeasurements } from "./ConversationPage";

describe("control de contexto de conversación", () => {
  it.each(["Whisper small · local CPU", "Whisper base · local CPU", "Whisper local · modelo configurado"])("muestra el modelo ASR real de la toma manual: %s", model => {
    const markup = renderToStaticMarkup(<VoiceTurnMeasurements recordedSeconds={6.25} transcriptionMs={3500} model={model} state="review" />);
    expect(markup).toContain(model);
    expect(markup).toContain("6.3 s");
    expect(markup).toContain("3.5 s");
    expect(markup).toContain("REVISAR");
  });
  it("no atribuye un modelo antes del ASR ni conserva el detalle al limpiar la toma", () => {
    const pending = renderToStaticMarkup(<VoiceTurnMeasurements recordedSeconds={4} transcriptionMs={null} model={null} state="recorded" />);
    expect(pending).toContain("modelo de transcripción");
    expect(pending).toContain("—");
    expect(pending).not.toContain("Whisper");
    expect(pending).toContain("Medición de señal: no disponible");
    expect(renderToStaticMarkup(<VoiceTurnMeasurements recordedSeconds={null} transcriptionMs={null} model={null} state="idle" />)).toBe("");
  });
  it("invalida una revisión preparada para otro motor", () => {
    expect(reviewUsesCurrentRoute({ provider: "ollama", model: "qwen3.5:4b" }, "llamacpp", "gemma-4-E2B-it-Q4_K_M")).toBe(false);
    expect(reviewUsesCurrentRoute({ provider: "llamacpp", model: "gemma-4-E2B-it-Q4_K_M" }, "llamacpp", "gemma-4-E2B-it-Q4_K_M")).toBe(true);
    expect(reviewUsesCurrentRoute(null, "llamacpp", "gemma-4-E2B-it-Q4_K_M")).toBe(false);
  });
  it("limita sólo la vista y conserva los mensajes más recientes", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 ? "assistant" as const : "user" as const,
      text: `Mensaje ${index}`,
      createdAt: "2026-09-13T12:00:00Z",
    }));
    expect(visibleConversationMessages(messages)).toEqual(messages.slice(-12));
    expect(visibleConversationMessages(messages, 5)).toEqual(messages.slice(-5));
    expect(messages).toHaveLength(20);
  });
  it("expone fuentes reales y separa historial durable de memoria confirmada", () => {
    const markup = renderToStaticMarkup(<Conversacion
      desktopApp
      draft=""
      status={{ providers: [{ id: "ollama", label: "Ollama local", configured: true, defaultModel: "qwen3.5:4b", protocol: "Ollama", retentionMode: "local" }] }}
      provider="ollama"
      model="qwen3.5:4b"
      messages={[]}
      memories={[]}
      observationEnabled={false}
      foregroundContext={null}
      onToggleObservation={vi.fn(async () => undefined)}
      onDraftChange={vi.fn()}
      onMemoryRetrieval={vi.fn()}
      onHybridRetrieve={vi.fn()}
      onPreviewConversationLearning={vi.fn()}
      onConfirmConversationLearning={vi.fn()}
      onPreviewVoiceOutput={vi.fn()}
      onConfirmVoiceOutput={vi.fn()}
      onCancelVoiceOutput={vi.fn()}
      onStartVoiceSession={vi.fn()} onStopVoiceSession={vi.fn()} onSpeakVoiceSession={vi.fn()} onPrepareVoiceTurn={vi.fn()}
      onTranscribeVoiceTurn={vi.fn()}
      onOpenSettings={vi.fn()}
      onSend={vi.fn()}
      onRetrievalOutcome={vi.fn(async () => undefined)}
    />);

    expect(markup).toContain("FUENTES SELECCIONADAS · DATOS REALES");
    expect(markup).toContain('<details class="conversation-context-drawer">');
    expect(markup).toContain("Contexto y permisos");
    expect(markup).not.toContain("Interpretación de la voz");
    expect(markup).not.toContain("voice-delivery-control");
    expect(markup).not.toContain("conversation-history-gate");
    expect(markup).toContain("seleccionado · todavía no hay mensajes guardados");
    expect(markup).toContain("Configurar observador en Gateway");
    expect(markup).toContain("CONTINUIDAD LOCAL");
    expect(markup).toContain("CONVERSACIÓN GUARDADA LOCALMENTE");
    expect(markup).toContain("no se convierte automáticamente en recuerdo ni en hecho confirmado");
    expect(markup).not.toContain("Aprendizaje episódico local");
  });

  it("ofrece la ampliación híbrida sólo como una acción manual de Gemma", () => {
    const onHybridRetrieve = vi.fn();
    const markup = renderToStaticMarkup(<Conversacion
      desktopApp
      draft="¿Qué sabés de mis proyectos?"
      status={{ providers: [{ id: "llamacpp", label: "Gemma local", configured: true, defaultModel: "gemma-4-E2B-it-Q4_K_M", protocol: "llama.cpp", retentionMode: "local" }] }}
      provider="llamacpp"
      model="gemma-4-E2B-it-Q4_K_M"
      messages={[]}
      memories={[
        { id: "memory-1", intention: "Proyecto Alice", summary: "Asistente local", memoryStatus: "confirmed" },
        { id: "memory-2", intention: "Proyecto Cyrcetech", summary: "Interfaz web", memoryStatus: "confirmed" },
        { id: "memory-3", intention: "Preferencias de desarrollo", summary: "Pruebas reales", memoryStatus: "confirmed" },
      ]}
      observationEnabled={false}
      foregroundContext={null}
      onToggleObservation={vi.fn(async () => undefined)}
      onDraftChange={vi.fn()}
      onMemoryRetrieval={vi.fn()}
      onHybridRetrieve={onHybridRetrieve}
      onPreviewConversationLearning={vi.fn()}
      onConfirmConversationLearning={vi.fn()}
      onPreviewVoiceOutput={vi.fn()}
      onConfirmVoiceOutput={vi.fn()}
      onCancelVoiceOutput={vi.fn()}
      onStartVoiceSession={vi.fn()} onStopVoiceSession={vi.fn()} onSpeakVoiceSession={vi.fn()} onPrepareVoiceTurn={vi.fn()}
      onTranscribeVoiceTurn={vi.fn()}
      onOpenSettings={vi.fn()}
      onSend={vi.fn()}
      onRetrievalOutcome={vi.fn(async () => undefined)}
    />);

    expect(markup).toContain("Ampliar con Gemma");
    expect(markup).toContain("Acción manual");
    expect(markup).toContain("no guarda ni confirma contenido");
    expect(onHybridRetrieve).not.toHaveBeenCalled();
  });

  it("excluye recuerdos no vigentes y no reutiliza respuestas de conversaciones", () => {
    expect(buildHybridRetrievalCandidates([
      { id: "conversation", kind: "Conversación", intention: "Pregunta real", summary: "Respuesta no verificada", memoryStatus: "confirmed" },
      { id: "dormant", intention: "En reposo", accessibilityStatus: "dormant" },
      { id: "suppressed", intention: "Suprimido", suppressionStatus: "suppressed" },
      { id: "scheduled", intention: "Pendiente de eliminación", deletionStatus: "scheduled" },
      { id: "teaching", intention: "Hecho confirmado", summary: "Evidencia local", memoryStatus: "confirmed" },
    ])).toEqual([
      { id: "conversation", text: "Pregunta real" },
      { id: "teaching", text: "Hecho confirmado\nEvidencia local" },
    ]);
  });

  it("deja la propuesta de recuerdo como acción manual sobre el último intercambio", () => {
    const onPreviewConversationLearning = vi.fn();
    const markup = renderToStaticMarkup(<Conversacion
      desktopApp
      draft=""
      status={{ providers: [{ id: "llamacpp", label: "Gemma local", configured: true, defaultModel: "gemma-4-E2B-it-Q4_K_M", protocol: "llama.cpp", retentionMode: "local" }] }}
      provider="llamacpp"
      model="gemma-4-E2B-it-Q4_K_M"
      messages={[
        { id: "exchange-user", exchangeId: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7", role: "user", text: "Prefiero pruebas reales.", createdAt: "2026-09-06T00:00:00Z" },
        { id: "exchange-assistant", exchangeId: "4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7", role: "assistant", text: "Entendido.", createdAt: "2026-09-06T00:00:01Z" },
      ]}
      memories={[]}
      observationEnabled={false}
      foregroundContext={null}
      onToggleObservation={vi.fn(async () => undefined)}
      onDraftChange={vi.fn()}
      onMemoryRetrieval={vi.fn()}
      onHybridRetrieve={vi.fn()}
      onPreviewConversationLearning={onPreviewConversationLearning}
      onConfirmConversationLearning={vi.fn()}
      onPreviewVoiceOutput={vi.fn()}
      onConfirmVoiceOutput={vi.fn()}
      onCancelVoiceOutput={vi.fn()}
      onStartVoiceSession={vi.fn()} onStopVoiceSession={vi.fn()} onSpeakVoiceSession={vi.fn()} onPrepareVoiceTurn={vi.fn()}
      onTranscribeVoiceTurn={vi.fn()}
      onOpenSettings={vi.fn()}
      onSend={vi.fn()}
      onRetrievalOutcome={vi.fn(async () => undefined)}
    />);

    expect(markup).toContain("Proponer recuerdo de este intercambio");
    expect(markup).toContain("Escuchar con la voz de Alice");
    expect(markup).toContain("Dictar con botón");
    expect(markup).not.toContain('<details class="manual-voice-options">');
    expect(markup).not.toContain("este dictado no termina por silencio");
    expect(markup).not.toContain("El micrófono se abre al pulsar Empezar a grabar");
    expect(markup.indexOf("Acciones autorizadas:")).toBeGreaterThan(markup.indexOf("Contexto y permisos"));
    expect(markup).toContain("MIC APAGADO");
    expect(markup).toContain("sólo analiza tu mensaje");
    expect(onPreviewConversationLearning).not.toHaveBeenCalled();
  });
});
