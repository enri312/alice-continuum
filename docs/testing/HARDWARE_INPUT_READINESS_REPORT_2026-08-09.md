# Informe real de disponibilidad — Cámara y micrófono

Fecha: 2026-08-09  
Estado: aprobado como comprobación de hardware; integración en Alice pendiente de R2

## Autorización

Carlos Nuñez autorizó el uso de la cámara y el micrófono integrados para pruebas reales. Esta autorización no se interpreta como permiso permanente dentro de Alice: el producto deberá solicitar consentimiento visible y revocable por sesión.

## Método

- La cámara se abrió mediante OpenCV y DirectShow.
- El micrófono se abrió mediante PortAudio a través de `sounddevice`.
- Los datos permanecieron en memoria durante la comprobación.
- No se escribió ninguna imagen, grabación o muestra de audio en disco.
- Solo se conservaron métricas técnicas no reversibles en este informe.

## Resultado

| Fuente | Dispositivo real | Evidencia |
|---|---|---|
| Cámara | `ACER HD User Facing` | 12/12 fotogramas recibidos; 640×480; tres canales; luminancia media 124,13 |
| Micrófono | `Microphone Array (2- Intel Smart Sound Technology for Digital Microphones)` | 77.175 muestras; 44.100 Hz; 1,75 s; RMS 0,032001; pico 0,227264 |

Ambas fuentes entregaron datos reales y se cerraron al terminar. La cámara no produjo archivos y el micrófono no produjo grabaciones.

## Interpretación

- El hardware está presente y responde.
- Esta prueba no demuestra todavía permisos gobernados, indicadores visibles, descarte continuo, VAD, transcripción o gestos.
- `perception.camera.observe` y `perception.microphone.observe` permanecen `planned / unavailable` en R1.
- Su incorporación debe pasar por el Gateway R2 antes de integrarse a Memoria o Identificación.
- Fish Audio se reserva para una fase posterior de voz del avatar; no se configuró ni se recibió ninguna clave.
