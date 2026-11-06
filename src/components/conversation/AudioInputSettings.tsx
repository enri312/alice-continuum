import { useState } from "react";
import type { NoiseStatus } from "../../core/voice/noise-types";

type Props = {
  disabled: boolean;
  deviceId: string;
  onDeviceChange: (id: string) => void;
  status: NoiseStatus | null;
};

export function AudioInputSettings({ disabled, deviceId, onDeviceChange, status }: Props) {
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
      <button type="button" className="secondary" disabled={disabled} onClick={() => void refresh()}>Actualizar micrófonos</button>
    </div>
    {message && <p role="status">{message}</p>}
    {status && <p>Última toma preparada con filtro: {status.microphone}. {status.systemEcho ? "El equipo confirmó cancelación del sonido del sistema." : "El equipo no confirmó cancelación de toda la música del sistema."}</p>}
    <p>El filtro reduce ruido, pero no reconoce quién habla ni garantiza separar voces cantadas o de otras personas. La escucha automática atiende sólo frases dirigidas a Alice; las demás se descartan tras la transcripción local.</p>
  </details>;
}
