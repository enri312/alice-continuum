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
obligatoria. Las flechas y el controlador de carrusel de la incorporación inicial
se retiraron tras la revisión del propietario; se conserva el desplazamiento nativo.

El estilo está acotado a Conversación. Estado, Flujo, Memoria y las demás páginas
conservan su presentación. La modificación no migra Conversación a Dioxus ni
cambia el backend. Las respuestas, registros EPISODIC, alarma de fatiga y
simulaciones de la referencia no se copiaron al producto.

Referencia auditada: SHA-256
`209d5a956cbef0bec43181acc41a85a92ce74399e3c38695f0e17cdc63a90e3f`.
La copia original y las capturas comparativas se guardan privadamente en
`runtime/artifacts/proposal04-2026-11-15/`.

## Comprobaciones de la incorporación inicial

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

## Revisión de elementos añadidos

El propietario señaló el aro del encabezado y pidió comparar con la presentación
anterior. La comparación con `62be1d0` identifica estos cambios adicionales:

| Elemento | Procedencia y ajuste |
|---|---|
| Aro violeta/cian | Pseudoelemento decorativo nuevo, tomado de la referencia. Retirado. |
| Encabezado técnico y badge LOCAL COGNITIVE CORE | Ya existían en el DOM, pero estaban ocultos visualmente. Se restaura su tratamiento compacto anterior para evitar repetir el título. |
| Dos flechas de pestañas | Botones y controlador nuevos. Retirados; el desplazamiento horizontal nativo y el teclado permanecen. |
| Iconos de navegación | Recursos SVG originales, sin cambios. No fueron sustituidos por iconos de la referencia. |
| Voz, cámara, escritorio, contexto, documentos y diagnóstico | Funciones anteriores conservadas; no son añadidos del rediseño. |
| Descripciones de sistemas y nota del compositor | Texto anterior que el estilo hizo visible. Se conserva su contenido. |

`Frontend/src/App.tsx` vuelve a coincidir con la versión previa al rediseño.
Se elimina el archivo `conversation-navigation.ts`, que quedó sin consumidores.
La comparación de los 22 SVG y del módulo que los muestra usa los blobs Git de
la versión anterior, respetando la normalización de finales de línea.

La revisión se comprueba con compilación y aceptación de navegador sobre el
build real: siete pestañas originales, ausencia del aro y de flechas añadidas,
encabezado compacto, navegación por teclado y desplazamiento nativo, además de
revisión/cancelación/edición/envío/error con IPC sintético. No se abren dispositivos.
Pasaron también las 12 pruebas de los dos módulos de Conversación e identificación.
Evidencia privada: `runtime/artifacts/proposal04-cleanup-2026-11-15/` y la nueva
carpeta generada por `test:conversation:browser`.

La automatización de escritorio no pudo inicializarse ni recuperarse: devolvió
`Transport closed`. La comprobación nativa del cuadro anterior corresponde a la
incorporación inicial; no se presenta como una nueva inspección visual de esta
limpieza. No se detuvo la instancia normal de Alice ni se tocaron sus datos.

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
