import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AudioInputSettings, VoiceIgnoredTakeFeedback } from "./AudioInputSettings";

describe("resultado efímero dentro de Audio de entrada", () => {
  it("mantiene el detalle del descarte en el único desplegable existente, cerrado inicialmente", () => {
    const markup = renderToStaticMarkup(<AudioInputSettings disabled={false} deviceId="" onDeviceChange={() => undefined} sensitivity="soft" onSensitivityChange={() => undefined} status={null} ignoredTake={{ reason: "insufficientSpeech" }} />);
    expect(markup.match(/<details\b/g)).toHaveLength(1);
    expect(markup).toContain("Audio de entrada · reducción de ruido local");
    expect(markup).toContain("Resultado de entrada no atendido");
    expect(markup).not.toMatch(/<details[^>]*\bopen(?:=|\s|>)/);
    expect(markup).not.toContain('role="status"');
  });
  it("no añade un diagnóstico vacío cuando no hay una toma descartada", () => {
    const markup = renderToStaticMarkup(<AudioInputSettings disabled={false} deviceId="" onDeviceChange={() => undefined} sensitivity="normal" onSensitivityChange={() => undefined} status={null} />);
    expect(markup).not.toContain("Resultado de entrada no atendido");
  });
  it("explica detección insuficiente sin atribuirle silencio real ni una transcripción", () => {
    const markup = renderToStaticMarkup(<VoiceIgnoredTakeFeedback take={{ reason: "insufficientSpeech" }} />);
    expect(markup).toContain("El detector no reconoció voz suficiente");
    expect(markup).toContain("antes de transcribirla");
    expect(markup).not.toContain("Micrófono apagado");
    expect(markup).not.toContain("Modelo de transcripción");
    expect(markup).not.toContain("Transcripción descartada:");
  });
  it("distingue ASR sin palabras del detector previo y evita inventar texto o duración", () => {
    const markup = renderToStaticMarkup(<VoiceIgnoredTakeFeedback take={{ reason: "noSpeech", transcript: "", transcriptionModel: "Whisper small", captureMs: null, transcriptionMs: 1250 }} />);
    expect(markup).toContain("El transcriptor no devolvió palabras");
    expect(markup).toContain("Whisper small");
    expect(markup).toContain("<dt>Toma de audio</dt><dd>—</dd>");
    expect(markup).toContain("1.3 s");
    expect(markup).not.toContain("El detector");
    expect(markup).not.toContain("Transcripción descartada:");
  });
  it("muestra la transcripción no dirigida sólo como descarte efímero y escapa su texto", () => {
    const markup = renderToStaticMarkup(<VoiceIgnoredTakeFeedback take={{ reason: "notAddressed", transcript: "Reclosa Spotify <script>alert(1)</script>", transcriptionModel: "Whisper small", captureMs: 3250, transcriptionMs: 1000 }} />);
    expect(markup).toContain("La transcripción no se reconoció como una frase dirigida a Alice");
    expect(markup).toContain("Transcripción descartada:");
    expect(markup).toContain("Reclosa Spotify &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("Último mensaje atendido");
    expect(markup).not.toContain("Alice entendió:");
    expect(markup).toContain("Este detalle no se envía al chat");
    expect(markup).toContain("hasta la siguiente transcripción, una frase atendida o apagar el micrófono");
  });
});
