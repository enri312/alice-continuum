# Informe — Adaptador local Ollama

Fecha: 2026-08-20

## Alcance

Se agregó una ruta de inferencia local separada de los proveedores remotos. No se descargaron, movieron ni borraron modelos y no se escribió ningún recuerdo durante el ensayo directo.

## Prueba real de hardware e inferencia

- Runtime: Ollama 0.32.13.
- Endpoint observado: `127.0.0.1:11434`.
- GPU: NVIDIA GeForce RTX 3050 Laptop, 4 GiB.
- Modelo: `qwen3.5:4b`.
- Contrato: `stream:false`, `think:false`, `num_ctx:2048`, `num_predict:1200`, `temperature:0.2`.
- Tiempo total en frío: 13,26 s.
- Carga: 9,43 s.
- Entrada: 159 tokens.
- Salida: 46 tokens.
- Generación: 14,25 tokens/s.
- Modelo cargado: 3492 MiB; 1755 MiB ubicados en VRAM, con descarga parcial a CPU/RAM.
- Manifiestos modificados: 0 según SHA-256 antes y después del primer ensayo.
- Al terminar: modelo descargado de memoria, servidor temporal cerrado, cero listeners en 11434.

La primera variante, a temperatura predeterminada, atribuyó una comprobación no demostrada. La prueba se consideró fallida semánticamente aunque la red local funcionó. Se reforzó el prompt para separar contexto del usuario y evidencia propia, y se fijó temperatura 0.2. La repetición respondió que no podía confirmar comprobaciones ni recuerdos sin evidencia. Este segundo resultado valida el cierre honesto esperado; no certifica calidad general del modelo.

## Ensayo real del iniciador

Se ejecutó `Iniciar Alice.cmd`, no una reproducción parcial de sus órdenes. El iniciador detectó Ollama como listo, levantó Vite, compiló Tauri y ejecutó `target\debug\alice-cognitive-core.exe`. Durante la ejecución se verificó:

- un único listener `127.0.0.1:11434`, propiedad de `E:\Ollama\app\ollama.exe serve`;
- versión real `0.32.13`;
- cero modelos cargados antes de conversar;
- rechazo por diseño de listeners en `0.0.0.0`, `::` o interfaces no loopback;
- rechazo automático de modelos Ollama terminados en `:cloud` o `-cloud`;
- cierre posterior del binario de Alice, Vite y únicamente el servidor Ollama creado por el ensayo;
- estado final con cero listeners en 11434.

La aplicación Ollama antigua que no poseía el listener no se cerró ni modificó.

## Pruebas automáticas

- TypeScript/Vitest: 284 aprobadas.
- Rust: 191 aprobadas y 15 ignoradas por requerir hardware o datos canónicos explícitos.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- Build TypeScript/Vite: aprobado.
- Build Rust: aprobado.

## Límite de la validación

La solicitud real ejercitó el mismo endpoint y cuerpo JSON que el adaptador. La validación completa desde el botón de Conversación queda para una prueba manual con la aplicación abierta; sólo esa ruta producirá los eventos R3 y la memoria de trabajo nativa de Alice.
