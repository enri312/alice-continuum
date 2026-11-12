import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VoiceTurnObservation } from "../../core/voice/voice-loop";
import { HandsFreeVoice, VoiceSessionObservation } from "./HandsFreeVoice";

const turn: VoiceTurnObservation = {
  transcript: "Hola, Alice", transcriptionModel: "Whisper small · local CPU", captureMs: 4250,
  transcriptionMs: 1500, responseMs: 2500, synthesisMs: 1000, untilPlaybackMs: 5000, totalMs: 6000, outcome: "completed",
};

describe("diagnóstico efímero de escucha automática", () => {
  it.each(["Whisper small · local CPU", "Whisper base · local CPU", "Whisper local · modelo configurado"])("presenta el modelo realmente usado: %s", transcriptionModel => {
    const markup = renderToStaticMarkup(<VoiceSessionObservation turn={{ ...turn, transcriptionModel }} />);
    expect(markup).toContain(transcriptionModel);
    expect(markup).toContain("4.3 s");
    expect(markup).toContain("Toma de audio");
    expect(markup).toContain("5.0 s hasta iniciar la voz");
    expect(markup).toContain("incluye la pausa de cierre");
    expect(markup).toContain("sólo en esta pantalla");
  });
  it("muestra duración desconocida sin atribuirle cero segundos", () => {
    const markup = renderToStaticMarkup(<VoiceSessionObservation turn={{ ...turn, captureMs: null }} />);
    expect(markup).toContain("<dt>Toma de audio</dt><dd>—</dd>");
    expect(markup).not.toContain("<dt>Toma de audio</dt><dd>0.0 s</dd>");
  });
  it("explica decir el nombre y la frase seguida al preparar una escucha nueva", () => {
    const markup = renderToStaticMarkup(<HandsFreeVoice desktopApp disabled={false} onStart={async () => "session"} onStop={async () => undefined} onTranscribe={async () => { throw Error("unused"); }} onTurn={async () => { throw Error("unused"); }} onSpeak={async () => { throw Error("unused"); }} onActiveChange={() => undefined} />);
    expect(markup).toContain("Di «Alice» y tu frase seguida");
    expect(markup).toContain("no hace falta esperar una respuesta después del nombre");
    expect(markup).not.toContain("Resultado de entrada no atendido");
  });
});
