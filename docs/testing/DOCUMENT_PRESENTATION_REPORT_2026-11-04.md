# Presentación del documento maestro — 2026-11-04

El propietario reportó que unas notas técnicas ocupaban el principio del HTML
y desplazaban la presentación. Esas siete notas se habían añadido delante de
la portada durante los incrementos de conversación y percepción.

## Cambios

- La portada vuelve a ser el primer elemento de `main`, seguida del índice y
  del resumen ejecutivo.
- Las siete notas se conservan dentro de Historia de cambios, agrupadas en un
  desplegable cerrado por defecto. Los enlaces a ADR e informes se mantienen.
- El resumen vigente refleja R9, Gemma local, voz, visión por turnos, memoria
  automática y acciones delegadas. Se distinguen implementación y prueba viva.
- La versión documental pasa a **0.54**, con fecha **4 de noviembre de 2026**.
  La versión de producto sigue siendo 0.1.0. El registro 0.53 queda como histórico.
- Se actualizan restricciones y la referencia a Fish, que todavía describían
  esas integraciones como desconectadas o futuras.

## Verificación

Se abrió el HTML servido por el proyecto en el navegador y se comprobó la vista
de escritorio a 1280 × 900 para contrastar el problema de presentación reportado.
La portada aparece sin bloques de avances por encima. El enlace Historial lleva
a la sección correspondiente y muestra el grupo de notas cerrado. Se restableció
el tamaño del navegador y se cerró la pestaña temporal de prueba.

Evidencia privada, fuera de Git:

- `artifacts/media-voice-fix-2026-11-04/document-cover-desktop.png`.
- `artifacts/media-voice-fix-2026-11-04/document-history.png`.
- `artifacts/media-voice-fix-2026-11-04/document-structure-check.json`.

La comprobación estructural verifica portada primero, veinte capítulos del índice,
IDs únicos, anclas existentes, recursos locales y siete notas preservadas dentro
del historial. El navegador que ya tenía abierto el archivo puede requerir una
recarga para mostrar los cambios.
