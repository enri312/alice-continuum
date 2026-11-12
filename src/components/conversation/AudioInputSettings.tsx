import { useState } from "react";
import type { MicrophoneSensitivity, NoiseStatus } from "../../core/voice/noise-types";
import type { VoiceIgnoredTakeObservation } from "../../core/voice/voice-loop";

type Props = {
  disabled: boolean;
  deviceId: string;
  onDeviceChange: (id: string) => void;
  sensitivity: MicrophoneSensitivity;
  onSensitivityChange: (sensitivity: MicrophoneSensitivity) => void;
  status: NoiseStatus | null;
  ignoredTake?: VoiceIgnoredTakeObservation | null;
};

export function VoiceIgnoredTakeFeedback({ take }: { take: VoiceIgnoredTakeObservation }) {
  const reason = take.reason === "insufficientSpeech"
    ? "El detector no reconoció voz suficiente; la toma se descartó antes de transcribirla."
    : take.reason === "noSpeech"
      ? "El transcriptor no devolvió palabras; la toma no generó una respuesta."
      : "La transcripción no se reconoció como una frase dirigida a Alice; no generó una respuesta.";
  return <div className="voice-session-observation">
    <p><strong>Resultado de entrada no atendido:</strong> {reason}</p>
    {take.reason !== "insufficientSpeech" && <>
      {take.transcript && <p><strong>Transcripción descartada:</strong> {take.transcript}</p>}
      <p><strong>Modelo de transcripción:</strong> {take.transcriptionModel}</p>
      <dl><div><dt>Toma de audio</dt><dd>{take.captureMs === null ? "—" : `${(take.captureMs / 1000).toFixed(1)} s`}</dd></div>
        <div><dt>Transcripción</dt><dd>{(take.transcriptionMs / 1000).toFixed(1)} s</dd></div></dl>
    </>}
    <p>Este detalle no se envía al chat. El resultado transcrito se conserva hasta la siguiente transcripción, una frase atendida o apagar el micrófono.</p>
  </div>;
}

export function AudioInputSettings({ disabled, deviceId, onDeviceChange, sensitivity, onSensitivityChange, status, ignoredTake }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "audioinput" && device.deviceId);
      setDevices(inputs);
      setMessage(inputs.length ? "Si faltan nombres, actualiza la lista después de tu primera toma." : "No se encontraron micrófonos disponibles.");
    } catch { setMessage("No se pudo consultar la lista de micrófonos."); }
  }
  return <details className="audio-input-settings">
    <summary>Audio de entrada · reducción de ruido local</summary>
    <p>Alice filtra el ruido antes de transcribir y busca presencia de voz para cerrar cada turno. No necesita otro modelo de conversación.</p>
    <div className="audio-input-devices">
      <label>Micrófono<select disabled={disabled} value={deviceId} onChange={event => onDeviceChange(event.target.value)}>
        <option value="">Predeterminado del sistema</option>
        {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Micrófono ${index + 1}`}</option>)}
      </select></label>
      <label>Sensibilidad<select disabled={disabled} value={sensitivity} onChange={event => onSensitivityChange(event.target.value === "soft" ? "soft" : "normal")}>
        <option value="normal">Normal</option>
        <option value="soft">Voz baja y pausada</option>
      </select></label>
      <button type="button" className="secondary" disabled={disabled} onClick={() => void refresh()}>Actualizar micrófonos</button>
    </div>
    <p>Voz baja y pausada aumenta la ganancia local y conserva la salida del filtro sin una segunda atenuación. En la escucha automática espera 2 segundos de silencio para cerrar el turno; Normal espera 1 segundo y mantiene la atenuación adicional. Cambia el perfil con el micrófono apagado. Si el ruido abre tomas o la voz satura, usa Normal.</p>
    {message && <p role="status">{message}</p>}
    {status && <p>Última toma preparada con filtro: {status.microphone}. {status.sensitivity && <>Sensibilidad: {status.sensitivity === "soft" ? "Voz baja y pausada" : "Normal"}. </>}{status.systemEcho ? "El equipo confirmó cancelación del sonido del sistema." : "El equipo no confirmó cancelación de toda la música del sistema."}</p>}
    {ignoredTake && <VoiceIgnoredTakeFeedback take={ignoredTake} />}
    <p>El filtro reduce ruido, pero no reconoce quién habla ni garantiza separar voces cantadas o de otras personas. La escucha automática atiende sólo frases dirigidas a Alice; las demás se descartan tras la transcripción local.</p>
  </details>;
}
