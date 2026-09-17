# Gemma: Configuración y conversación nativa

## Estado implementado

Gemma aparece como proveedor local `llamacpp`, con modelo fijo `gemma-4-E2B-it-Q4_K_M`. Los controles de **Iniciar Gemma local**, **Apagar Gemma** y cancelación del arranque están en Configuración. Iniciar Gemma también lo selecciona como proveedor; apagarlo vuelve a seleccionar Ollama sin cargar Qwen. Pulsar una tarjeta de proveedor por sí sola no inicia ni apaga modelos.

El envío de texto de Conversación conserva la previsualización obligatoria, recuperación lexical autorizada e historial existente. El backend usa el mismo prompt de sistema y el transporte local de llama.cpp. Las respuestas exitosas recorren el flujo existente de auditoría e historial; no se agrega un escritor de recuerdos ni se promueven respuestas como conocimiento confirmado. Las respuestas que agotan el límite se rechazan como incompletas.

Gemma no se inicia por enviar un mensaje: si está apagado, se devuelve un error explícito. No se acepta otro identificador de modelo en ese proveedor. El arranque requiere los archivos de esta instalación, Ollama sin modelo residente y puerto 18089 libre. Cerrar normalmente Alice apaga el proceso Gemma que controla. No se promete limpieza tras terminación forzada del proceso o del sistema.

Pantalla y candidatos de aprendizaje todavía hablan el protocolo Ollama; quedan bloqueados mientras Gemma reside. No hay fallback ni carga de Qwen automática. La conversación de voz sigue siendo el siguiente incremento.

## Cómo probar tras reiniciar la aplicación recompilada

1. Abrir Configuración.
2. Si Ollama aún conserva Qwen, esperar su descarga por inactividad o, si el propietario decide cerrar esa sesión, ejecutar `ollama stop qwen3.5:4b`. No cerrar modelos de otras tareas sin revisar su uso.
3. Pulsar **Iniciar Gemma local** y esperar confirmación.
4. Seleccionar **Gemma local · llama.cpp** como proveedor.
5. Volver a Conversación, escribir un mensaje, revisar contexto y enviar.
6. Para volver a Ollama, apagar Gemma y seleccionar Ollama. No hay conmutación silenciosa.

La aplicación en navegador de desarrollo no dispone de estos comandos nativos. Una instancia vieja del ejecutable necesita recompilarse/reiniciarse; `npm run build` por sí solo no reemplaza el binario Rust que ya está abierto.

## Pruebas de este incremento

- Rust: **271 aprobadas, 0 fallos, 22 ignoradas**.
- TypeScript/React: **437 aprobadas en 47 archivos**. Incluye contrato estático del control manual; no equivale a clicar los botones en una ventana Tauri viva.
- `npm run build`: correcto; persiste advertencia de tamaño de bundles grandes.
- Prueba real nativa: **12,79 s**. Usa el singleton y `gemma_chat`, obtiene respuesta del motor instalado, verifica bloqueo de Ollama, cierre y rechazo de un mensaje tras apagarlo.
- **36 archivos canónicos sin cambios** durante esa prueba. Al finalizar, puerto 18089 libre y Ollama sin modelos.

La prueba de transporte no llamó al comando completo de envío con un `AppHandle` y no creó conversaciones de prueba en el historial del propietario. Falta la comprobación humana de extremo a extremo desde Configuración hasta la respuesta visible y su persistencia.

## Corrección de coherencia entre selección y motor

Durante la primera prueba manual, Gemma estaba residente pero una previsualización aún identificaba la solicitud como Ollama. El backend la rechazó correctamente, aunque su mensaje inicial era demasiado genérico. La causa era una selección/previsualización anterior, no saturación de Gemma.

La interfaz ahora invalida una revisión cuando cambian proveedor o modelo. Iniciar Gemma lo selecciona y deshabilita las demás tarjetas mientras está residente. El backend distingue expresamente una solicitud Ollama cuando 18089 está ocupado por Gemma. Se evita reutilizar un payload previamente revisado bajo otra ruta.

Validación posterior: **271 Rust y 438 TypeScript/React aprobadas**, compilación Vite correcta. La prueba opt-in volvió a iniciar, consultar y cerrar Gemma: **9,62 s**, con **37 archivos canónicos presentes e idénticos antes/después**. El recuento aumentó respecto de ejecuciones anteriores debido al estado real ya existente del proyecto; la prueba no creó ni modificó esos archivos. Al finalizar, Gemma y Alice estaban cerrados, Ollama sin modelos residentes y 18089 libre.

## Próximo paso

Transporte nativo del audio y controles **Grabar → Terminé de hablar → Transcribir → revisar borrador**, dentro de Conversación. Ningún silencio enviará automáticamente el turno. No activar escucha permanente ni agregar pestañas nuevas.

## Comprobación humana real — 2026-09-06

Se completaron **3 intercambios reales** desde Conversación con `Gemma local · llama.cpp`. Los tres pares usuario/asistente quedaron persistidos, sin mensajes vacíos y sin conmutación de proveedor. La prueba trató temas de Python y Django; no se reproduce aquí el contenido privado.

El recuento de memoria permaneció en **15 registros**. Esto es lo esperado: conversar crea historial episódico, pero una respuesta del modelo no se convierte automáticamente en recuerdo confirmado ni en conocimiento de Alice.

La revisión detectó un dato histórico incorrecto en una respuesta. Se reforzó el contrato del sistema para que el historial anterior no sea tratado como evidencia y para que los datos externos sin fuente recuperada se presenten como conocimiento interno no verificado. Esta medida mejora la trazabilidad, pero no sustituye una recuperación web o documental con fuentes.

También se normalizó el identificador que se guardará en futuros intercambios: el historial conservará el nombre lógico solicitado y no la ruta local completa del archivo GGUF. Los tres intercambios ya existentes se dejaron intactos para no reescribir datos reales del propietario sin una operación explícita.

Prueba específica posterior: **14 pruebas Rust aprobadas, 0 fallos**. Suite Rust completa posterior: **272 aprobadas, 0 fallos y 22 ignoradas por diseño**. La aplicación debe reiniciarse para cargar el nuevo prompt y la normalización del modelo en el binario nativo.

### Segunda comprobación factual y endurecimiento

Después del reinicio, un cuarto intercambio real confirmó el proveedor Gemma y el identificador limpio `gemma-4-E2B-it-Q4_K_M`. También confirmó que el prompt por sí solo no era una garantía: el modelo omitió el aviso y reutilizó como fuente una respuesta histórica incorrecta.

La defensa dejó de depender del comportamiento probabilístico del modelo:

- el backend agrega una sola vez `Conocimiento interno no verificado:` a las respuestas de Gemma;
- el contexto histórico conserva los mensajes anteriores de Carlos, pero no vuelve a inyectar las respuestas de Alice como evidencia;
- el historial completo continúa guardado y visible localmente;
- no se creó ningún recuerdo: el almacén permaneció en 15 registros.

Validación del endurecimiento: **273 pruebas Rust y 439 pruebas TypeScript/React aprobadas, 0 fallos**; compilación Vite correcta. Se mantiene la advertencia conocida por dos paquetes grandes. Se requiere otro reinicio del ejecutable para probar la garantía nueva de extremo a extremo.

La comprobación posterior al reinicio aprobó: el quinto intercambio mostró el aviso,
conservó el identificador lógico del modelo y no repitió la afirmación falsa. Tras
cerrar la prueba se retiraron del historial visible los dos intercambios contaminados
y el intercambio diagnóstico exitoso. Quedaron dos intercambios válidos, cero
respuestas con la afirmación detectada y 15 recuerdos sin cambios. La versión previa
se conservó en `data/conversation/backups/`, ruta privada excluida de Git.
