# Informe — Contexto RAG y observación visual local

Fecha: 2026-08-20  
Estado: backend visual y selector interactivo aprobados

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

El intervalo de sesión se fijó en cinco minutos para evitar solapamiento y reducir interferencia con la clase y el avatar.

## Validación interactiva durante una clase real

El propietario abrió **Memoria → Aprendizaje**, activó el selector de WebView2 y eligió una fuente. R3 registró cinco pares completos `request → success` entre las 20:10 y las 20:30, separados aproximadamente por cinco minutos. Las duraciones fueron 41.582, 39.504, 32.891, 28.288 y 28.290 ms. No hubo eventos de error.

La revisión posterior encontró cero archivos PNG/JPEG/WebP/BMP dentro de `data/` y cero recuerdos cuya procedencia fuera `Pantalla compartida`; por lo tanto, la observación funcionó y los apuntes aún no habían sido confirmados como aprendizaje duradero. No se inspeccionó ni documentó el contenido textual de la clase.

## Prueba real de continuidad multivuelta

Se enviaron dos solicitudes temporales al Ollama real con `qwen3.5:4b`, `num_ctx=4096`, razonamiento visible desactivado y el historial completo del primer intercambio incluido en la segunda solicitud. El primer turno confirmó el dato real del incremento (`ENTENDIDO`) en 25,79 s; el segundo recuperó correctamente `4096` en 1,70 s. La segunda solicitud utilizó 98 tokens de entrada y 5 de salida. Esta prueba no llamó a la memoria duradera ni creó recuerdos.

## Regresión

- TypeScript: 286 aprobadas en 33 archivos, 0 fallidas.
- Rust: 194 aprobadas, 0 fallidas y 15 ignoradas por requerir hardware o datos privados explícitos.
- `cargo fmt --check`: aprobado.
- Clippy con `-D warnings`: aprobado.
- Build TypeScript/Vite: aprobado; conserva únicamente la advertencia informativa ya conocida de chunks superiores a 500 kB.
- Build Rust: aprobado.
