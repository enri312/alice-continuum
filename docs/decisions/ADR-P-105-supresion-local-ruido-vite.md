# ADR-P-105 — Reducción local de ruido y Vite 8.3.5

Fecha: 2026-11-04. Estado: aceptada e implementada; aceptación acústica del propietario pendiente.

El propietario pide conversar con música procedente tanto de la notebook como
de otros equipos. También solicita incorporar la actualización de Vite.

## Decisión

Aplicar RNNoise local antes de MediaRecorder en ambas entradas de conversación:
sesión automática y dictado manual. Se conserva Gemma 4 para transcripción y
diálogo; el filtro no es otro LLM. `@shiguredo/rnnoise-wasm` 2025.1.5 contiene su
WASM y modelo, sin descargar código o enviar audio durante la captura.

La cadena es micrófono mono → filtro de graves a 80 Hz → AudioWorklet de enlace
→ Worker RNNoise → atenuación suave de señal sin voz → WebM/Opus → Gemma local.
RNNoise procesa tramas de 480 muestras a 48 kHz; el enlace acumula inicialmente
20 ms de salida para absorber variaciones del Worker. No se conecta a altavoces.
La cola admite hasta 500 ms de demora de planificación antes de fallar de forma
explícita; esa capacidad no añade 500 ms a la latencia normal de arranque.
La temporización total incluye también RNNoise, remuestreo y planificación del equipo.

El fin de turno combina energía adaptable con probabilidad de voz y al menos
120 ms de evidencia de habla. Conserva la pausa de un segundo, el rearme por
silencio a ocho segundos y el máximo de veinte segundos en sesión automática.
La toma manual mantiene sesenta segundos. La interfaz anuncia preparación hasta
que estén listos filtro y grabador. Cancelar libera micrófono, Worker, contexto
y grabación; un fallo del filtro descarta la toma sin grabar la señal cruda.

Se solicitan cancelación de eco y reducción de ruido al navegador, sin ganancia
automática. Sólo si el dispositivo declara soporte se intenta `echoCancellation:
"all"`; el estado distingue lo confirmado por `getSettings()` de una petición.
No se presenta `true` como prueba de cancelación de Spotify o YouTube del sistema.

**Audio de entrada** permite elegir micrófono sin abrirlo al consultar la lista.
**Sólo si digo Alice** es opcional y desactivado inicialmente: admite dirección
al comienzo de la transcripción, descarta las demás antes de conversación,
historial y Fish, y mantiene la orden de parada. No es identificación de hablante.
No se modifica la delegación ni se añaden autorizaciones por turno.

Vite pasa de 8.2.2 a **8.3.5**, con Workers ES. Vitest se actualiza mediante parche
de 4.1.11 a **4.1.12**; `npm audit` final no reporta vulnerabilidades. Node 26 y
Rust 1.99.1 permanecen como entorno vigente. La CSP permite WASM y Workers propios,
sin habilitar evaluación JavaScript general ni orígenes externos.

## Límites y evidencia

Reducir ruido no aísla de manera fiable a Carlos frente a otras personas o
cantantes. La cancelación del audio de la notebook depende de WebView2 y su
dispositivo; la música externa no ofrece una referencia digital de eco. Para
aceptación acústica deben probarse ambos orígenes con la voz real del propietario.
No hay verificación biométrica, separación de hablantes ni escucha durante Fish.

El [informe de pruebas](../testing/VOICE_NOISE_VITE_REPORT_2026-11-04.md) distingue
pruebas sintéticas, captura nativa y calidad pendiente. Avisos de terceros en
`public/licenses/` se copian a la distribución.

Fuentes: [RNNoise](https://github.com/xiph/rnnoise),
[wrapper WASM](https://github.com/shiguredo/rnnoise-wasm/tree/2025.1.5),
[Media Capture](https://www.w3.org/TR/mediacapture-streams/),
[Vite 8.3.5](https://github.com/vitejs/vite/releases/tag/v8.3.5).
