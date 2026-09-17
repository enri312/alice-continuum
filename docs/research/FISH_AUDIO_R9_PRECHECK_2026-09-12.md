# Prechequeo de Fish Audio para R9.2

Fecha de consulta: 2026-09-12  
Alcance: lectura de documentación pública; no se leyó una credencial ni se hizo una
solicitud a la API.

## Hechos técnicos comprobados

| Tema | Resultado | Consecuencia para Alice |
|---|---|---|
| Endpoint no streaming | `POST https://api.fish.audio/v1/tts` | primera prueba con una única solicitud cancelable; no streaming |
| Autenticación | `Authorization: Bearer <token>` | la clave queda sólo en el entorno del proceso nativo |
| Selección de modelo | encabezado `model`; la documentación recomienda `s2-pro` | no fijar el valor en UI ni asumir que es gratis |
| Voz | se acepta `reference_id` o referencias de audio | R9.2 exige un identificador de voz explícito; no enviará audio de Carlos ni clonará voz |
| Formato | el endpoint puede devolver MP3, WAV u Opus | iniciar con un formato reproducible local y efímero; no crear biblioteca de audios |
| Errores publicados | 401, 402 y 422 | traducirlos a credencial ausente/rechazada, crédito/límite y solicitud inválida; nunca mostrar el token |
| Precio API | $15 por millón de bytes UTF-8 para los modelos TTS listados | contabilizar caracteres/bytes antes de una salida, limitar la primera prueba a una frase breve |
| Concurrencia inicial | el nivel Starter publicado permite 5 solicitudes concurrentes | Alice seguirá admitiendo una sola solicitud por vez; no necesita esa concurrencia |

Fuentes oficiales consultadas:

- [Endpoint Text to Speech](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
- [Introducción y esquema OpenAPI](https://docs.fish.audio/api-reference/introduction)
- [Precios y límites](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits)
- [Política de privacidad](https://fish.audio/de/privacy/)
- [Términos de uso](https://fish.audio/es/terms/)

## Privacidad y alcance

La política pública indica que Fish puede retener contenido mientras lo necesite
para operar sus servicios, además de la retención relacionada con la cuenta. Esto
no equivale a la política local de Alice. Por tanto, el adaptador no podrá enviar
por defecto el historial, recuerdos, observaciones, archivos, audio de entrada ni
texto de un borrador. Sólo podrá enviar el texto exacto mostrado en una
previsualización que Carlos confirme para ese intento.

No se probó ni autoriza:

- crear o subir un modelo de voz;
- clonar una voz;
- usar ASR de Fish Audio;
- streaming WebSocket;
- consultar saldo, modelos privados o datos de cuenta;
- automatizar reproducción de cada respuesta.

## Decisión de preparación

Fish Audio es técnicamente compatible con el contrato R9.1, pero aún no queda
adoptado. R9.2 debe implementar primero el objeto de previsualización nativo y
sus pruebas sin usar red. Sólo después podrá hacerse una prueba de humo manual
con:

1. una voz ya autorizada y su `reference_id` (sin crear/clonar ninguna);
2. una frase breve, no privada y visible;
3. límite inicial de 500 caracteres y una solicitud en curso como máximo;
4. audio temporal descartado al cerrar, cancelar o reemplazar el intento;
5. confirmación visible de Carlos antes de la llamada.

El precio publicado debe revisarse nuevamente justo antes de una prueba con costo,
porque proveedores, modelos y límites pueden cambiar.
