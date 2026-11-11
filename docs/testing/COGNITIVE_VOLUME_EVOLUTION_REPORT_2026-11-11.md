# Volumen cognitivo: organización, aprendizaje y señales

Fecha: 2026-11-11. Proyecto: `D:\Alice Continuum`.

## Propósito y referencia

El propietario pide que el Volumen muestre el cerebro lógico de Alice y su
evolución al incorporar experiencias y enseñanzas. La referencia es el capítulo
«Su cerebro» del [video de Wichito IA](https://www.youtube.com/watch?v=3yjuZB5-XyU&t=68).
Se consultaron la descripción y miniaturas públicas; el propietario proporcionó
el extracto de subtítulos. No se afirma haber revisado el video completo ni su
implementación interna.

La referencia visual adoptada es un volumen bilateral como protagonista, con
nodos inspeccionables. El mapa de módulos ya existe en **Flujo cognitivo** y no se
duplica en el Volumen. No se copian cifras,
controles autónomos ni afirmaciones biológicas del video como capacidades de Alice.

## Cambios implementados

- Volumen 3D con malla ilustrativa y escala espacial acotada según el número de
  registros reales; los puntos de la malla no se cuentan como recuerdos.
- Resumen por origen: autoestudio, conversaciones, perfil y otros registros.
- La lectura inicial completa establece una línea base. Las incorporaciones y
  actualizaciones posteriores se resaltan; los cambios recientes se conservan
  sólo mientras la vista está abierta. Reaparecer con un ID conocido no cuenta
  como otro nacimiento. Repasar, recuperar o mover la cámara no fabrica altas.
- La proyección visual de autoestudio incluye pendientes y retirados con sus
  estados. El uso en conversación conserva el filtro de lecciones activas cuyo
  último ejercicio fue aprobado. Un intento pendiente no se declara aprendido.
- Origen y fecha verificable en la ficha. El último estudio no se presenta como
  fecha de creación. Contenido, importancia, asociaciones emocionales revisadas,
  evidencia de relaciones, estados y controles anteriores se conservan.
- Lienzo a todo el ancho cuando no hay selección. La ficha de un nodo aparece
  al seleccionarlo; el mapa de módulos continúa en **Flujo cognitivo**.
- Consola de señales debajo del volumen: evidencia R3 y demostración explícita
  tienen datos y significados distintos. Las partículas no miden el tráfico
  interno de Gemma; velocidad y cantidad son ilustrativas.
- Una muestra de más de 15 segundos, evidencia vencida o auditoría no verificable
  detienen la animación real. Pausa y movimiento reducido se respetan; los
  controles manuales de inspección y cámara siguen disponibles.
- Las asociaciones se refrescan al cambiar una fuente; aristas y citas sólo se
  muestran si sus versiones coinciden con los recuerdos visibles.
- Parser compatible con eventos de gobierno sin señal cognitiva. Consultas del
  núcleo serializadas y descarte de resultados tras desmontar la pantalla.

No se añaden almacenes de memoria, permisos, sensores ni cambios de pesos. El
código anterior de la vista quedó respaldado en
`local/backups/volume-modernization-20261111/source-before.zip`, fuera de Git.

## Validación

| Comprobación | Resultado |
|---|---|
| Vitest completo | 681 aprobadas; 2 sondas opcionales omitidas |
| Sincronización Obsidian | 15 aprobadas con datos aislados |
| Respaldo y restauración | 20 aprobadas con datos aislados |
| TypeScript y compilación frontend | Aprobados; persiste el aviso conocido de paquetes grandes |
| Prueba de interfaz aislada | 17 comprobaciones aprobadas; 0 errores de página y consola |
| Anchos de ventana | 1440, 1000 y 420 píxeles; sin desborde horizontal |

La prueba de interfaz verifica línea base, crecimiento por ID, recuperación y
repaso sin altas falsas, reinserción, aprobación de una lección pendiente,
contenido/origen/fecha de la ficha, diez colores de referencia, dos citas de una
asociación sintética, zoom/giro/traslado/teclado/restablecimiento/órbita,
demostración sin alterar contadores, estados de señal y movimiento reducido.
Una revisión v1→v2 elimina de inmediato la arista y las citas de la versión anterior.
Comprueba además la ausencia del mapa duplicado y que, sin selección a 1440 px,
el lienzo ocupa los 1360 px de ancho disponibles.
La pausa se comprueba comparando imágenes del lienzo: los fotogramas quedan
estables mientras la evidencia permanece consultable.

Artefactos locales: `local/artifacts/volume-observatory-20261111/qa-report.json`
y cinco PNG; fixtures sintéticos y runner permanecen fuera de Git. Navegador,
servidor y caché temporal de la prueba se cerraron al terminar.

Esta ejecución no inició Tauri, motores, Obsidian, micrófono ni cámaras, ni usó
recuerdos personales. Falta la aceptación del diseño y de una incorporación real
de aprendizaje en la sesión nativa del propietario. No se repitieron Rust ni
pruebas de voz porque no se modificó el backend o el procesamiento de audio.

## Qué supondría imitar mecanismos neuronales

Una red de integración y disparo puede modelar acumulación de entrada, umbral,
reinicio y período refractario, además de entradas excitadoras/inhibidoras y
retardos sinápticos. Esos mecanismos están documentados en el modelo
[LIF de NEST](https://nest-simulator.readthedocs.io/en/v3.7/models/iaf_psc_alpha.html).
Un prototipo de ese tipo sería un experimento separado, con estímulos y resultados
medibles. No está implementado por esta vista ni equivale a convertir Gemma en
un cerebro humano, entrenarla o demostrar conciencia.

[Decisión](../decisions/ADR-P-115-volumen-cognitivo-y-evolucion-visible.md) ·
[Uso del Volumen](../MANUAL_DE_USO.md#volumen-cognitivo).
