# Integración nativa: ciclo de vida del motor local

Actualización posterior: controles de Configuración y transporte de conversación implementados. Ver [estado vigente y pruebas](GEMMA_SETTINGS_CHAT_2026-09-05.md). Las secciones siguientes conservan el historial de los incrementos previos.

## Incremento implementado

`src-tauri/src/local_inference.rs` incorpora el controlador nativo de llama.cpp/Gemma probado previamente. Compila como parte de Alice, pero **no está registrado como comando de UI ni cambia el proveedor activo**. No se ha integrado todavía el turno de voz al chat.

- Rutas fijas a los archivos ya evaluados; sin descargas ni instalación automática.
- Inicio serializado, comprobación estricta del estado de Ollama y puerto loopback libre.
- Reutiliza únicamente su propio proceso; no adopta procesos que ya ocupen el puerto.
- Cierre dirigido a su propio `Child`, sin búsquedas de procesos por nombre ni cierre de instancias ajenas.
- Limpieza del proceso ante fallo de preparación o destrucción del controlador.
- Cliente HTTP sin proxy ni redirecciones. Arranque oculto en Windows.

## Validación real

1. `cargo test local_inference::tests --lib`: dos pruebas unitarias pasan; la prueba real queda ignorada por defecto, para no cargar modelos durante tests ordinarios.
2. `node scripts/testing/native-runtime-smoke.mjs`: habilita expresamente la prueba real. Inicio del motor instalado, reutilización del PID, rechazo de un segundo propietario, inferencia real y cierre correctos. Prueba real: 5,58 s; compilación aparte.
3. SHA-256 antes/después: **36 archivos canónicos intactos**. Ollama informó cero modelos al terminar. La prueba verificó que 18089 quedara libre.

La inferencia usa una instrucción de diagnóstico, no una conversación ficticia persistida. Ningún dato de memoria se envía al modelo en esta prueba. El informe detallado está ignorado por Git en `artifacts/gemma-evaluation/native-runtime-smoke.json`.

## Límites y siguiente punto de trabajo

En el primer incremento había tres rutas directas a Ollama, ahora protegidas por el control compartido descrito abajo:

- `cloud.rs`: conversación.
- `visual_learning.rs`: análisis de pantalla.
- `learning_candidates.rs`: propuestas de aprendizaje.

Las tres rutas ya participan del mismo control de uso. Queda exponer selección, inicio/cierre y transcripción desde la conversación existente, sin cambiar automáticamente el proveedor.

Un programa externo puede iniciar Ollama después de la comprobación: no prometer exclusión global de toda la máquina. Por ahora se rechaza el inicio si no se puede verificar que Ollama esté vacío; no se descarga automáticamente un modelo ajeno.

El arranque sincronizado se debe ejecutar en un trabajador bloqueante, nunca en el hilo de UI. Durante el handshake, estado/cierre esperan el plazo acotado (60 s más solicitudes en curso de hasta 3 s). Antes de exponerlo al usuario conviene agregar cancelación de preparación y mensajes de progreso. Las rutas fijas corresponden a esta instalación, no a un paquete distribuible.

Pendientes: selección visible en configuración, transporte nativo de audio, cierre manual/revisión en Conversación y pruebas de dispositivo en vivo. No añadir pestañas, escucha permanente ni cambios en iconos.

## Incremento siguiente: arbitraje de las tres rutas

Implementado un permiso RAII compartido por conversación, análisis visual y candidatos de aprendizaje. Solo una petición local puede mantenerlo; se conserva hasta consumir la respuesta completa y se libera al salir, incluso por error/cancelación. Una petición concurrente recibe un error explícito de ocupado, no se encola ni se descarta silenciosamente.

El controlador nativo mantiene el mismo permiso durante toda la residencia de Gemma. Antes de usar Ollama, las tres rutas verifican que 18089 esté libre y que `/api/ps` no contenga otro modelo distinto al solicitado. Ante un estado inválido o inaccesible, se rechaza la petición. Se usa HTTP loopback sin proxy ni redirecciones. No se descarga un modelo residente ajeno.

Esto serializa las rutas nativas de esta instancia de Alice: no es un cerrojo entre aplicaciones ni puede impedir que otro programa cargue un modelo en mitad de una operación. Tampoco convierte automáticamente las rutas de visión/aprendizaje al protocolo de Gemma; por ahora se bloquean si Gemma está residente.

Validación tras el cambio:

- Suite Rust completa: **270 aprobadas, 0 fallos, 22 ignoradas** (las pruebas con hardware/inferencia siguen siendo opt-in).
- Pruebas unitarias: ocho hilos compiten y solo uno obtiene el permiso; se libera al terminar o fallar; se rechazan estados ambiguos y modelos residentes distintos.
- Prueba real opt-in: **aprobada, 7,63 s**. Gemma arranca y responde; una solicitud Ollama se rechaza mientras está residente. Tras cerrarlo, se obtiene permiso Ollama y este impide arrancar Gemma. El chequeo del permiso Ollama no realiza una inferencia adicional de Qwen.
- **36 archivos canónicos idénticos** antes/después. Al terminar, 18089 libre y Ollama sin modelos residentes.

No se activó un selector ni se cambió el modelo del usuario. Próximo trabajo: selección y apagado explícitos desde Configuración, cancelación del arranque y transporte de transcripción; luego incorporar «Terminé de hablar» en Conversación sin envío automático.
