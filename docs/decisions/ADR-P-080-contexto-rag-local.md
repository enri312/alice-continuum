# ADR-P-080 — Contexto ampliado y RAG local para Ollama

Fecha: 2026-08-20  
Estado: aceptada

## Contexto

La primera prueba conversacional con `qwen3.5:4b` perdió continuidad porque el contrato usaba 2048 tokens y la interfaz mantenía historial y recuerdos desmarcados. El modelo recibía principalmente el mensaje actual. La notebook dispone de 24 GiB de RAM, pero sólo 4 GiB de VRAM, por lo que aumentar el contexto sin límite perjudicaría latencia y convivencia con el avatar.

## Decisión

- Pausar OpenRouter de forma reversible: no se anuncia en `cloud_status`, su clave no habilita la aplicación y Rust rechaza solicitudes directas; el adaptador se conserva.
- Priorizar Ollama y `qwen3.5:4b` como ruta de inicio.
- Aumentar `num_ctx` de 2048 a 4096 y limitar la salida local a 900 tokens.
- Ampliar memoria de trabajo a seis intercambios, doce mensajes, 72.000 caracteres y TTL de dos horas.
- Adjuntar como máximo los diez mensajes más recientes.
- Activar historial y RAG por defecto sólo con Ollama, manteniendo casillas y previsualización visibles.
- Construir la consulta RAG con el mensaje actual y hasta dos mensajes anteriores del propietario; recuperar como máximo tres recuerdos confirmados mediante el índice lexical existente.
- Tratar historial y recuerdos como datos de referencia, nunca como instrucciones del sistema ni evidencia de acciones ejecutadas.

## Consecuencias

La conversación conserva más continuidad sin introducir un servicio nuevo ni descargar otro modelo. Aumenta el uso del KV cache y de RAM, pero no se mantiene el modelo activo sin solicitudes. RAG compensa información fuera de la ventana inmediata; no garantiza que Qwen interprete correctamente cada recuerdo y no sustituye una futura recuperación semántica por embeddings.

## Referencias oficiales

- [Ollama — Context length](https://docs.ollama.com/context-length)
- [Ollama — Chat API](https://docs.ollama.com/api/chat)
