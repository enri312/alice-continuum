# Estado y controles: ajustes de sesión y memoria recuperada

Fecha: 2026-11-13. Estado: contratos, compilación y revisión Tauri de escritorio aprobados; aceptación de tono y revisión completa a otros anchos pendientes.

## Alcance autorizado

El propietario pidió aplicar los deslizadores a Estado y controles de la
aplicación principal y conectar lo que tenga un mecanismo operativo real. Este
incremento corresponde a React/Tauri; no adopta el piloto Dioxus ni la migración
que el propietario está preparando en Google AI Studio. Esa exportación se
analizará por separado cuando esté disponible.

La etiqueta técnica `REPLY + AFFECT + DRIVE STATE` que se superponía al encabezado
se conserva dentro del flujo normal del panel, junto con «Modelo interno».
Su indicación distingue señales de lectura de ajustes de sesión. Las ocho
señales internas siguen siendo indicadores; los ocho controles de comportamiento
se representan mediante rangos nativos con su valor y disponibilidad. El botón
del inspector y el deslizador son elementos separados, sin controles anidados.

## Ajustes conectados

| Control | Efecto operativo | Valor inicial |
|---|---|---:|
| Creatividad | Temperatura de la generación conversacional de Gemma/Ollama locales, en el intervalo 0–1. | 0,2 |
| Estilo empático | Selección de una de tres instrucciones fijas de tono. El tramo medio conserva el mensaje de sistema anterior. | 0,5 |

Los ajustes pertenecen a la sesión y se aplican al próximo envío. No introducen
un almacén ni una migración de preferencias. Durante una respuesta en curso se
bloquea su modificación; los proveedores externos no reciben cambios que sus
adaptadores no admiten. El backend valida tipos, campos y valores finitos dentro
del intervalo antes de atender la solicitud.

Texto, voz y visión de la conversación local comparten estos ajustes. Los
defaults u omisión conservan el cuerpo previo. Cambiar el estilo no cambia la
identidad, el respeto, los límites ni las autorizaciones de Alice.

Autonomía e Inhibición conservan su relación con permisos y restricciones. Los
controles sin un mecanismo implementado siguen bloqueados: no se presenta un
número editable como una capacidad existente. Este incremento no altera los
routers de acciones, extractores, ASR, aprendizaje ni síntesis Fish, y no promete
reducir la latencia mediante un ajuste de estilo.

## Función de la fila de memoria

La fila representa contexto recuperado para un envío, con la categoría y
procedencia del registro real. En una memoria conversacional episódica puede
mostrar **`EPISÓDICA — USUARIO: <entrada real del propietario> → Alice`**. Los demás
orígenes conservan su categoría y contenido propios; no se clasifican todos los
recuerdos como episódicos ni se inventa una fuente del usuario.

El texto «TEST de Personalidad Múltiple y Libre Albedrío» permanece como ejemplo
sintético del laboratorio Dioxus. No se inserta como recuerdo de Alice ni se
copia a la fila de datos reales por motivos visuales.

La observación efímera distingue:

- **Preparado:** coincidencias locales que todavía requieren revisión/envío.
- **Enviando:** contexto congelado para la solicitud autorizada.
- **Respuesta recibida:** contexto proporcionado a la ruta conversacional.
- **Ruta sin memoria:** acción o respuesta local que no necesitó el payload RAG.
- **Fallo:** envío que no terminó; no se atribuye un uso de memoria a una respuesta.

El recibo nativo `memoryContextMode` diferencia `none`, `full` y `limited`.
`full` describe el payload íntegro proporcionado a la ruta de respuesta; no
demuestra qué recuerdo determinó el texto ni verifica su verdad. Visión limita
el contexto, por lo que `limited` no acredita que una coincidencia completa
haya llegado al modelo. Las rutas locales que omiten el contexto usan `none`.

El seguimiento conserva el último contexto enviado después de limpiar el
borrador, sin confundirlo con nuevas coincidencias preparadas. Al volver a
escribir incluso la misma consulta se inicia una preparación nueva. Un envío
sin recuerdos conserva su identidad de consulta, pero no arrastra referencias
del borrador anterior. La proyección
revalida los IDs contra la elegibilidad actual y oculta referencias ausentes,
en conflicto, archivadas, suprimidas, en reposo, con eliminación programada o
procedentes de lecciones retiradas.

Cuando existe una puntuación real se identifica como puntuación léxica o rango
híbrido. La puntuación léxica no es una probabilidad y puede superar 1. Si no se
dispone de esa información se muestra ausencia; no se usa actividad técnica R3
como supuesto score de recuperación ni se copia el 0,503 de la referencia.

### Presentación compacta y selección de memoria

La referencia visual se aplica a un encabezado sencillo y una fila con tres
columnas: categoría real, contenido y puntuación. Se elimina del panel el estado
permanente a la derecha y el párrafo de ayuda inferior. Esos detalles se
conservan al seleccionar la fila en el inspector y en su nombre accesible.
Los títulos pueden ocupar varias líneas y el contenido se redistribuye a
anchos menores de 600 px. El vacío muestra ausencia sin asignar una categoría.

Se corrigió un fallo del inspector: seleccionar `state-memory` antes caía en la
señal Curiosidad, porque no era una métrica ni un control de comportamiento.
Ahora muestra el estado de recuperación, categoría, texto, significado de la
puntuación, cantidad vigente y fuente del recuerdo seleccionado.

**Comprobaciones de este ajuste:** 20 pruebas dirigidas en tres archivos y
compilación TypeScript/Vite aprobadas. Incluyen preparación frente a contexto
proporcionado, categoría de autoestudio, puntuación/rango, contexto limitado y
ausencia de datos anteriores tras retirar un registro o fallar el envío.
Logs privados: `local/experiments/compact-memory-tests.log` y
`local/experiments/compact-memory-build.log`. Se mantiene el aviso conocido de
chunks grandes; no se añadieron dependencias ni consultas periódicas.

En la aplicación Tauri se comprobó el panel vacío y después una consulta local
de matemáticas con Recuerdos activos: aparecieron tres coincidencias reales,
con categoría semántica, título y puntuación léxica sin normalizar. Pulsar la
fila abrió el inspector con su fuente y la indicación de coincidencias preparadas.
La consulta temporal se retiró para restaurar el borrador vacío. No se envió al
modelo, no se encendió el micrófono ni se insertaron recuerdos de prueba. Esta
comprobación no sustituye una nueva generación ni la revisión a todos los anchos.

Respaldo previo de `df6b4a1`, creado y verificado en D:
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-14T02-02-55-716Z-be6bef41-a378-4285-960a-8c348ac8f739`.
La exportación terminada en Google AI Studio se revisará por separado al conocer
su ubicación; este ajuste no incorpora esa migración.

## Validación realizada

| Comprobación del incremento | Estado |
|---|---|
| Contratos frontend: rangos, disponibilidad por proveedor y bloqueo durante un envío | Aprobados en pruebas automatizadas |
| Ciclo de recuperación: preparación, autorización, respuesta, fallo y ausencia de RAG | Aprobado con fixtures sintéticos y regresiones de borrador repetido/vaciado |
| Elegibilidad y retirada de recuerdos, incluidos registros con eliminación programada | Aprobadas en pruebas automatizadas |
| Backend: defaults compatibles, cuerpos Gemma/Ollama/visión, rangos y recibos de contexto | 418 pruebas Rust aprobadas; 32 instaladas/dispositivos ignoradas |
| Compilación TypeScript/Vite y comprobaciones Rust pertinentes | Build aprobado; Clippy de todos los targets sin advertencias; Rustfmt de los archivos cambiados aprobado |
| Revisión de encabezado, sliders, inspector, teclado y distribución en la aplicación | Observada en Tauri de escritorio; otros anchos y valoración de tono pendientes |

La suite completa ejecutada aprobó **852 pruebas frontend, con 2 omitidas**, más
**15 de Obsidian y 20 de respaldos**. Después de ajustar el seguimiento de
consultas sin contexto y repetidas, se repitieron sus targets y los de
conversación/estado: **77 pruebas en 7 archivos aprobadas**. El build final se
repitió después de esos cambios. No se suman ambos recuentos como pruebas distintas.
Vite conserva el aviso conocido de chunks mayores de 500 kB; no se afirma una
mejora de rendimiento ni se añaden dependencias o polling.

La aplicación ya cargó el backend recompilado y la interfaz actualizada.
En Tauri se observaron ocho sliders, sólo Creatividad y Estilo empático editables;
el inspector acompañó el cambio de Creatividad a 0,54. Se comprobaron ambos
ajustes y se restauraron los valores que estaban al iniciar la revisión.
El rótulo técnico quedó separado del encabezado y se mantuvo «Modelo interno».

Una búsqueda local desde un borrador vacío encontró tres coincidencias reales
para una consulta de aritmética: la fila mostró `SEMANTIC`, puntuación léxica y
fuente curada. No se envió ese mensaje ni se activó el micrófono; el borrador
temporal se limpió y Alice quedó en Estado y controles. Este ensayo comprueba
la preparación con datos existentes, no una nueva generación ni la aceptación
del tono de un modelo. El formato episódico `USER: … → Alice` se verifica con
fixtures; no se escribió el texto de personalidad del laboratorio en datos reales.

Logs privados bajo `local/experiments/`: `state-controls-frontend-tests.log`,
`state-controls-final-targets.log`, `state-controls-frontend-build.log`,
`state-controls-rust-tests.log` y `state-controls-clippy.log`.

Los resultados de las 840 pruebas frontend y del watchdog publicados
anteriormente conservan su fecha y alcance; no son una ejecución nueva de este
incremento. Tampoco se reutilizan las ocho pruebas del piloto Dioxus como
aceptación de la aplicación principal. La prueba acústica de R9 con el
propietario sigue siendo una aceptación separada.

## Preservación y límites

### Etiquetas de la fila en español

El propietario confirmó que la fila debe mostrar únicamente recuerdos reales.
Su presentación se localiza a `EPISÓDICA`, `SEMÁNTICA`, `PROCEDIMENTAL` y
`PREFERENCIA`; los episodios conversacionales muestran
`USUARIO: <entrada real> → Alice`. Se mantienen las claves internas, la
procedencia, los filtros y la puntuación original. El título de personalidad y
el valor 0,503 de la referencia no se insertan como datos.

El estado vacío indica cómo iniciar una consulta con Recuerdos activos en
Conversación. Este ajuste pasó **16 pruebas dirigidas en dos archivos** y la
compilación TypeScript/Vite; el aviso conocido de chunks grandes se mantiene.
Logs privados: `local/experiments/memory-row-label-tests.log` y
`memory-row-label-build.log`. No se ejecutaron otra vez las suites Rust o de
respaldos por este cambio de presentación, ni se escribieron recuerdos de prueba.

Antes de modificar el código se verificó el respaldo de `6f8a223`:
`D:\Alice Backups\Alice Continuum\snapshot-2026-11-14T00-00-07-727Z-0bb32fe3-ac5a-443b-b588-14256759e2d1`.
El nombre del snapshot usa UTC; la fecha de este informe sigue la zona del propietario.
El documento original no seguido del propietario permanece fuera del commit y
con su SHA-256 previo. Los datos vivos se tratan por separado del código: el
funcionamiento normal de Alice puede actualizarlos sin convertirlos en fixtures.

Este trabajo no migra la memoria canónica, los grafos ni los formatos de R6/R8.
No utiliza recuerdos privados como fixtures ni amplía las materias de autoestudio.
La revisión de persistencia y grafos continúa aplazada. Los modelos, credenciales,
audios, cachés y artefactos de prueba permanecen fuera del código publicable.

Fuentes de implementación: [InternalState](../../src/components/cognitive/InternalState.tsx),
[el puente actual de Estado](../../src/components/cognitive/state-controls/StateControlsHost.tsx),
[ajustes frontend](../../src/core/conversation/behavior-settings.ts),
[contrato nativo de estilo](../../Backend/src-tauri/src/conversation_behavior.rs) y
[adaptador de conversación](../../Backend/src-tauri/src/cloud.rs).
