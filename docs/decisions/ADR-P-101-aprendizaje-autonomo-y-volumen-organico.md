# ADR-P-101 — Aprender conversando y volumen orgánico

Fecha: 2026-11-03. Estado: implementado; aceptación cotidiana pendiente.

## Delegación del propietario

Carlos pide que Alice decida qué vale la pena guardar de sus nuevas conversaciones
y modernice los nodos con una apariencia inspirada en el cerebro. Autoriza la
selección y persistencia automática, sin confirmación por recuerdo. Esta decisión
sustituye ese requisito de ADR-P-087, 096, 099 y 100 para el almacén automático.
No habilita herramientas, cámara, acciones externas ni entrenamiento de pesos.

## Recorrido

Tras responder con Gemma y persistir el intercambio, el backend evalúa en segundo
plano únicamente el mensaje real del propietario. Gemma decide `skip` o `save`,
elige hasta dos citas literales, su tipo e importancia. El backend valida la
decisión y comprueba las citas contra la fuente. Una respuesta de Alice nunca
sirve como evidencia. Un catálogo acotado de recuerdos existentes ayuda a evitar
duplicados; la repetición normalizada de una cita se excluye también en código.

Se consideran preferencias, datos declarados, conocimientos y procedimientos
enseñados y experiencias importantes. Se excluyen cortesías puras, preguntas sin
declaraciones y solicitudes explícitas como «no guardes esto». Se filtran patrones
reconocibles de credenciales. El juicio de utilidad puede fallar; no se presenta
como certeza factual o como medición de importancia biológica.

La evaluación usa sólo Gemma local y no retrasa deliberadamente la respuesta que
la originó. Comparte su único motor, por lo que puede existir contención en turnos
muy seguidos. Cerrar Alice antes de terminar puede impedir guardar ese turno.
No hay procesamiento retrospectivo masivo del historial ni llamadas nuevas a Fish.

## Persistencia y control

`memory/automatic-v1.json` contiene configuración, registros y decisiones recientes;
`automatic-v1.backup.json` conserva la versión anterior. Se usa temporal sincronizado
y reemplazo atómico en el mismo directorio. Límites: 8 MiB, 2000 registros, 1000
decisiones recientes, hasta 4000 caracteres por fuente y 320 por cita. No se borran
recuerdos para liberar espacio. La configuración se revisa nuevamente antes de guardar.

Los archivos anteriores `records.json` y `owner-profile.json` mantienen sus contratos.
Separar el almacén evita fingir una confirmación humana o modificar enseñanzas ya
revisadas. Los nuevos registros se muestran como **aprendidos automáticamente**,
con cita original, fecha, intercambio y SHA-256 de la fuente.

En **Memoria → Lo que Alice decide conservar** se puede pausar, corregir, retirar
del contexto o volver a usar un recuerdo. Corregir preserva la evidencia y versiones
anteriores. Retirar conserva el contenido y evita que la repetición de la misma
cita lo reactive. El RAG incluye sólo registros activos, con procedencia explícita;
su lectura comienza activada en Conversación y puede desmarcarse por separado.

## Volumen

Cada nodo persistente conserva la identidad de un registro real. Dos hemisferios
ilustrativos, pliegues suaves, cuerpos orgánicos y ramificaciones locales modernizan
la presentación. Su posición es estable por identidad y no representa anatomía real.
El contorno no crea recuerdos ni neuronas de Gemma.

Las líneas verdes unen recuerdos elegidos del **mismo intercambio**: prueban origen
compartido, no una asociación semántica. Las asociaciones R8 siguen siendo violetas
y requieren su evidencia anterior. Los pulsos requieren recuperación o actividad
real; las ramas dibujadas de cada célula no agregan aristas. La ficha permite leer
contenido y procedencia. El contorno se almacena en caché y la vista reduce su
frecuencia en reposo y respeta movimiento reducido.

Guardar no garantiza recuperar o interpretar correctamente cualquier formulación:
el RAG actual es lexical y Gemma conserva sus limitaciones. El avatar sigue al final
y no se declara cierre de R9. Ver [validación](../testing/AUTOMATIC_MEMORY_VOLUME_REPORT_2026-11-03.md).
