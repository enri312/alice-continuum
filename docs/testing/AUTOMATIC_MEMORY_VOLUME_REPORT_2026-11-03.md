# Memoria automática y volumen orgánico — validación

Fecha: 2026-11-03. Contrato: [ADR-P-101](../decisions/ADR-P-101-aprendizaje-autonomo-y-volumen-organico.md).

## Resultado

Alice evalúa nuevos mensajes de conversaciones Gemma después de responder y
persistir el intercambio. Decide `skip`/`save` y puede conservar hasta dos citas
útiles, sin confirmación por recuerdo. Los registros tienen fuente literal,
identidad, fecha, tipo e importancia; no se declaran confirmados por el propietario.
El almacén es independiente de los archivos confirmados anteriores.

La actualización se comunica a React, alimenta RAG y proyecta nodos reales. La
lectura comienza activada. Memoria ofrece pausa, corrección con versiones, retirada
reversible y restauración. Retirar excluye el registro del RAG, sin borrarlo.
Una corrección elimina la selección de recuperación anterior para no mostrar una
consulta vieja como si hubiese utilizado el contenido corregido.

El volumen incorpora un marco de dos hemisferios con pliegues ilustrativos, cuerpos
orgánicos, ramificaciones acotadas y aristas curvas. El origen compartido produce
una línea verde, sin inventar asociaciones semánticas. Seleccionar un nodo abre
su contenido y procedencia. Se conservan cámara, búsqueda, teclado y movimiento
reducido. Hay caché del contorno, cuadrícula espacial y menor frecuencia en reposo.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Frontend completo | 527 aprobadas, 2 omitidas; 62 archivos aprobados |
| Rust, biblioteca | 300 aprobadas, 24 sondas ignoradas |
| Sonda real de memoria Gemma | Aprobada en directorio temporal aislado |
| TypeScript/Vite | Compilación aprobada |
| Compilación nativa | Aprobada con Rust 1.99.1 |
| Clippy de biblioteca con `-D warnings` | Aprobado |
| Rustfmt de módulos Rust modificados | Aprobado |
| `git diff --check` | Aprobado |

La sonda real seleccionó una preferencia explícita sobre ejemplos de astronomía,
la persistió y evitó duplicarla al repetirla. Una cortesía no generó otro registro.
Luego se proporcionó el recuerdo persistido al mismo Gemma y su respuesta recuperó
la preferencia de astronomía. Esto valida selección, almacenamiento y contenido
recuperado; no demuestra una mejora general de lenguaje o comprensión de pronombres.
No se llamó a Fish ni se abrió micrófono o cámara.

Las pruebas adicionales verifican citas fabricadas rechazadas, decisión coherente,
pausa durante resultados tardíos, reversibilidad, no reactivación por repetición,
respaldo anterior, archivo inválido conservado y exclusión de datos no autorizados
para retención. La fragmentación conserva versiones como Node.js y números decimales.

La prueba frontend recorre una selección automática por el compositor RAG real y
la proyección cognitiva: el nodo conserva su ID y estado `learned`, se recupera
la cita y se identifica como selección automática sin revisión manual. Retirarlo
conserva su nodo archivado pero elimina su recuperación. Dos registros del mismo
intercambio crean sólo el enlace de origen compartido. La geometría es estable
al agregar otros registros.

## Revisión visual

Se abrió la aplicación nativa con una copia aislada de los datos: 12 registros
previos y cero automáticos, sin activación de sensores. Se verificó el indicador
de aprendizaje y la vista del volumen. La instancia fue cerrada posteriormente.

La nueva geometría también se revisó en una página aislada que usa los componentes
reales con **datos ficticios expresamente rotulados**. Se comprobó la búsqueda,
selección de un nodo aprendido, lectura del contenido y origen compartido. La
consola de esa página no mostró errores. La captura está en
`artifacts/automatic-memory-volume-2026-11-03/neural-volume-preview.jpg`.
Esta captura demuestra presentación; sus doce registros no son aprendizajes del
propietario ni una nueva medición de actividad real.

## Integridad y límites

Los **43 archivos canónicos de `data/` conservaron su SHA-256**, sin archivos
nuevos, migraciones ni cambios en recuerdos, historial o auditoría. Las escrituras
de prueba ocurrieron únicamente en raíces temporales o en la copia aislada.
No se tocó el avatar ni se cambiaron dependencias o modelos. No se hicieron llamadas
pagadas. Los procesos Gemma de prueba y la instancia nativa aislada se cerraron.

El modelo puede seleccionar algo poco útil o interpretar mal una cita. Una
transcripción incorrecta también puede propagarse al recuerdo. La procedencia y
los controles de corrección permanecen visibles. El filtro de cortesías puras
evita convertir ese tipo de intercambio en crecimiento ficticio.

La evaluación comparte el motor local y requiere que Alice siga abierta hasta
terminar. No hay entrenamiento de pesos ni procesamiento retrospectivo del
historial. El RAG actual es lexical; no se garantiza recuperar toda información
ante cualquier formulación. La memoria confirmada anterior y el nuevo almacén
automático conservan controles y respaldos independientes. El exportador anterior
corresponde al almacén confirmado; para un respaldo completo se incluye también
`automatic-v1.json`.

Persiste el aviso previo de Vite por paquetes grandes. No se declara cierre total
de R9, perfección conversacional ni equivalencia biológica del volumen.
