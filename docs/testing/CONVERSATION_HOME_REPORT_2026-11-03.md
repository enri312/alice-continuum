# Conversación como pantalla principal

Fecha: 2026-11-03. Decisión: [ADR-P-098](../decisions/ADR-P-098-inicio-centrado-en-conversacion.md).

## Cambios comprobables

- La navegación presenta **Conversación**, con el icono nuevo de mensajes y voz.
- El chat aparece primero, seguido del mensaje y los controles para hablar o
  revisar el envío. El estado vacío ocupa menos espacio; el historial con
  mensajes conserva una zona de lectura mayor y desplazamiento propio.
- Los estados visibles proceden del turno existente. Se distingue micrófono
  apagado, preparación, grabación, transcripción, respuesta, síntesis y reproducción.
- Diagnóstico y documentos tienen accesos secundarios cerrados inicialmente.
  El diagnóstico sólo se monta al abrirlo. Congelarlo no detiene el asistente;
  se explica esa diferencia y el alcance del tiempo de análisis mostrado.
- Se compacta la navegación de Conversación y se oculta visualmente su encabezado
  técnico repetido. Se conserva su nombre accesible. Las otras pantallas mantienen
  su presentación y rutas.
- El nuevo SVG se genera desde el sistema vectorial existente, con acabados y
  accesibilidad de movimiento de la familia. Se retiran la escena y el SVG
  anteriores, conservando el catálogo de 21 iconos funcionales y el emblema.

## Validación

| Comprobación | Resultado |
|---|---|
| `npm test` | 487 aprobadas, 2 sondas omitidas; 57 archivos aprobados y 2 omitidos. |
| `npm run build` | Aprobado. Persisten avisos previos por paquetes JavaScript grandes. |
| `npm run icons:generate` | Generación de 21 iconos; emblema conservado. |
| Pruebas del sistema SVG y acabados de componentes | 179 aprobadas en la comprobación enfocada. |
| Inicio en ventana nativa | Chat y acciones principales accesibles; diagnóstico y documentos cerrados inicialmente. |
| Diagnóstico abierto/cerrado | El borrador ficticio se conserva y sigue editable. |
| Tamaño de ventana | Inspección a ancho normal y reducido; ajustes para mantener legibles el mensaje y sus acciones. Las ventanas muy bajas necesitan desplazamiento. |

Se usaron raíz de datos y perfil WebView2 separados en
`artifacts/conversation-home-2026-11-03/`. El borrador de revisión fue ficticio y
no se envió a inferencia. No se abrieron sensores ni se llamó a Fish en esta
revisión de interfaz. Las pruebas de voz reales de la entrega anterior están en
el [informe R9](R9_VOICE_TURNS_REPORT_2026-11-03.md).

Los 43 archivos canónicos de `data/` se compararon mediante SHA-256. No se hizo
migración ni modificación de datos privados. No hubo cambios en el backend Rust,
por lo que no se repitieron sus pruebas en esta entrega.

## Límites

Esta reorganización mejora el acceso a la conversación; no cambia la calidad del
modelo, la composición del historial, los permisos ni el número de autorizaciones
de R9. La aceptación con voz humana y conversaciones sostenidas sigue pendiente.
No se declara distribución pública ni cierre de R9.
