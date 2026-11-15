# Conversación: incorporación de Propuesta 04

Fecha: 2026-11-15. Plataforma de aceptación nativa: Windows / Tauri / WebView2.

## Cambio y preservación

Se adaptó al proyecto principal la referencia HTML proporcionada por el
propietario. Conversación adopta tarjetas translúcidas, bordes redondeados,
acentos violeta/azul/cian y las fuentes Sora y JetBrains Mono servidas desde
`Frontend/public/fonts/proposal04/`, con sus licencias completas. Los cuatro
archivos WOFF2 suman 80 496 bytes; no se añadieron dependencias npm.

Se conservaron los SVG originales y los manejadores de conversación, voz, visión,
contexto, documentos y diagnóstico. La revisión antes de enviar sigue siendo
obligatoria. Se añadió un controlador DOM pequeño para desplazar las pestañas
y deshabilitar sus flechas en los extremos; se desconecta al salir de la pantalla.

El estilo está acotado a Conversación. Estado, Flujo, Memoria y las demás páginas
conservan su presentación. La modificación no migra Conversación a Dioxus ni
cambia el backend. Las respuestas, registros EPISODIC, alarma de fatiga y
simulaciones de la referencia no se copiaron al producto.

Referencia auditada: SHA-256
`209d5a956cbef0bec43181acc41a85a92ce74399e3c38695f0e17cdc63a90e3f`.
La copia original y las capturas comparativas se guardan privadamente en
`runtime/artifacts/proposal04-2026-11-15/`.

## Comprobaciones

| Comprobación | Resultado y alcance |
|---|---|
| `npm run build` | TypeScript y Vite correctos; comprobación Dioxus incluida. Persiste el aviso de chunks grandes del proyecto. |
| `npm test` | 907 pruebas frontend correctas, dos opcionales omitidas; 19 Obsidian, 20 respaldos y dos privacidad correctas. |
| `npm run test:conversation:browser` | Interfaz productiva con IPC sintético: revisar no envía; cancelar no envía; editar invalida la revisión; confirmar envía exactamente el mensaje revisado. Error visible sin perder borrador. |
| Tamaños y navegación | 320, 390, 1024 y 1280 px sin desborde de documento en los estados comprobados; carrusel, teclado, regreso a Conversación y conservación del chat/borrador. |
| Fuentes y red | WOFF2 locales cargados; ninguna solicitud HTTP externa desde la interfaz en la aceptación aislada. Sin excepciones no controladas. |
| `npm run test:dioxus:browser` | Estado, Flujo, Actividad, teclado, señales, relaciones, desmontaje y recuperación correctos. |
| `npm run test:dioxus:native` | Ventana real e IPC real con datos separados: tema de Conversación, siete iconos, herramientas plegadas, revisión/cancelación, Estado/Flujo/Actividad y persistencia de relaciones tras recarga. |
| Git y privacidad | Iconos y documento privado del propietario sin modificar; sin datos, secretos ni experimentos añadidos al índice. |

El script de navegador usa un perfil nuevo bajo `runtime/`, respuestas ficticias
y un puente simulado; no representa una inferencia de un modelo. La prueba
nativa usa registros ficticios en otra carpeta y conserva sus hashes originales.
No se abrió el micrófono ni la cámara y no se enviaron mensajes a un proveedor
real. La revisión de voz cotidiana y latencia de R9 permanece pendiente.

Durante la adaptación se corrigieron interferencias de estilos anteriores en
el selector superior, encabezado estrecho y degradado de botones. La prueba de
edición espera al foco diferido del panel de revisión antes de introducir texto.
La prueba Dioxus de navegador requiere `ALICE_BROWSER_BIN` con la ruta del
navegador instalado; se ejecutó con Edge aislado.

## Reproducción

```powershell
npm run build
# En otra terminal:
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# Con el preview disponible:
npm run test:conversation:browser
$env:ALICE_BROWSER_BIN = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:dioxus:browser
# Alice normal debe estar cerrada para la aceptación nativa aislada:
npm run test:dioxus:native
```

`test:conversation:browser` también admite `ALICE_BROWSER_PATH` y
`ALICE_PREVIEW_URL` para otro Chromium instalado y otro puerto de loopback.
Las capturas y `result.json` quedan en `runtime/artifacts/conversation-design/`;
la evidencia Dioxus queda en `runtime/artifacts/dioxus/browser/` y `native/`.
Estos archivos no se publican en Git.

## Pendientes

Valoración del propietario de esta implementación visual. Después se adaptarán
las otras pantallas por incrementos, conservando sus funciones. La incorporación
no cierra R9, compatibilidad Linux/macOS ni la retirada total de React.
