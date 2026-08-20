# Informe — Contexto RAG y observación visual local

Fecha: 2026-08-20  
Estado: backend visual aprobado; selector interactivo pendiente

## Prueba real de visión

Se utilizó una captura previa de la propia interfaz de Alice, no contenido de una clase ni una imagen fabricada para el resultado. La solicitud fue al Ollama real en `127.0.0.1:11434` con el modelo instalado `qwen3.5:4b`.

La primera prueba se considera fallida: el modelo intentó transcribir demasiado, alcanzó 420 tokens, tardó 114,36 s y dejó JSON incompleto. El resultado no se aceptó ni se guardó.

Después de limitar el esquema a cuatro apuntes, dos textos visibles y 260 tokens:

- tiempo real: 31,07 s;
- entrada: 1164 tokens;
- salida: 193 tokens;
- tema reconocido: mapa afectivo con puntos y conexiones;
- reconoció el encabezado `ALICE COGNITIVE VOLUME` y la paleta afectiva;
- JSON completo y validable;
- memoria escrita: ninguna;
- captura incorporada al proyecto: ninguna.

El intervalo de sesión se fijó en cinco minutos para evitar solapamiento y reducir interferencia con la clase y el avatar. El selector de pantalla requiere una acción humana que no puede automatizarse de forma honesta; por eso continúa pendiente una prueba manual desde **Memoria → Aprendizaje**.

## Prueba real de continuidad multivuelta

Se enviaron dos solicitudes temporales al Ollama real con `qwen3.5:4b`, `num_ctx=4096`, razonamiento visible desactivado y el historial completo del primer intercambio incluido en la segunda solicitud. El primer turno confirmó el dato real del incremento (`ENTENDIDO`) en 25,79 s; el segundo recuperó correctamente `4096` en 1,70 s. La segunda solicitud utilizó 98 tokens de entrada y 5 de salida. Esta prueba no llamó a la memoria duradera ni creó recuerdos.

## Regresión

- TypeScript: 286 aprobadas en 33 archivos, 0 fallidas.
- Rust: 194 aprobadas, 0 fallidas y 15 ignoradas por requerir hardware o datos privados explícitos.
- `cargo fmt --check`: aprobado.
- Clippy con `-D warnings`: aprobado.
- Build TypeScript/Vite: aprobado; conserva únicamente la advertencia informativa ya conocida de chunks superiores a 500 kB.
- Build Rust: aprobado.
