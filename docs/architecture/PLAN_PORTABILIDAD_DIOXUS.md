# Plan: Alice multiplataforma y migración gradual a Dioxus

Fecha: 14 de noviembre de 2026. Estado: **planificación; los trabajos y criterios
pendientes de este documento no se consideran implementados**.

Prioridad actualizada por el propietario: trabajar primero en Windows y avanzar
en Dioxus para sustituir React por completo, de forma gradual; retomar Ubuntu después. El Roadmap registra los
incrementos implementados y sus límites. Las fases de portabilidad permanecen
como objetivo, sin exigir cambios en Ubuntu durante este tramo.

## Objetivo y alcance

Alice será una asistente personal de escritorio que acompaña, conversa, conserva
memoria bajo control del usuario y realiza acciones solicitadas dentro de permisos
definidos. Se busca que otras personas puedan instalarla en Windows, Linux y
macOS. El funcionamiento básico se explicará sin asumir conocimientos de Rust o
Node. La conversación debe mantenerse sencilla; el contenido, la identidad y
los iconos deben conservarse durante la migración.

Actualización de diseño (2026-11-15): el propietario solicitó renovar la identidad
visual sin perder contenido ni funciones y aclaró que quiere preservar también
todos los iconos y la identidad actual. Después eligió la Propuesta 04, incorporada
primero a Conversación mediante estilos acotados y fuentes locales. Las otras
pantallas conservan su presentación. El cambio visual no sustituye su migración
de lógica y componentes a Dioxus ni añade dependencias React.
Ver [dirección y criterios de incorporación](DIRECCION_VISUAL_ALICE.md).

El propietario informó que otras personas ya intentaron ejecutarla en Windows y
Linux sin éxito. Aún no se conocen sus errores, versiones ni forma de descarga:
los problemas siguientes son **causas posibles comprobadas en la configuración**,
no un diagnóstico definitivo de esos casos.

## Situación observada

- El frontend principal usa React/Vite y el backend usa Rust/Tauri. Estado y
  controles ya renderiza con Dioxus Web/WASM; todavía depende del contenedor y
  la navegación React, que le pasan datos y validan acciones. Existe respaldo
  React para esa pantalla. No es una migración completa de la aplicación.
- `Backend/src-tauri/src/runtime_paths.rs` conserva en Windows la ruta por
  defecto `D:/Alice-model-evaluation`; un equipo que no tenga esos recursos debe
  configurarlos. El propio README indica que los modelos no van en Git y que un
  clon requiere configurar rutas. Hay variables de entorno alternativas.
- El empaquetado está desactivado (`bundle.active: false` en la configuración
  Tauri). Hoy las instrucciones de desarrollo requieren Node, Rust y dependencias;
  el código descargado no equivale a un instalador para una persona final.
- Windows se ha probado en la instalación del propietario. Ubuntu 26.04 x86_64
  tiene un procedimiento desde fuentes, una CI y evidencia histórica de un turno
  real en ese equipo. Esto no certifica una instalación nueva ni todas las
  distribuciones. El único workflow actual es Ubuntu. No se encontró evidencia
  equivalente de aceptación en macOS. Hay funciones con adaptadores específicos
  de Windows y Linux; no debe asumirse paridad entre sistemas.
- La copia consultada de OpenAmika (`D:\OpenAmika`, commit `9e38a51`) presenta
  requisitos, pasos, errores frecuentes y pruebas sin modelos ni claves. Su guía
  local está centrada en Windows y considera Linux sin probar; sirve para estudiar
  instalación y diagnóstico, no para declarar resuelta la compatibilidad de Alice.
  Si se incorpora código de terceros, revisar licencia MIT, avisos y licencias de
  cada dependencia o modelo; el presente plan no copia su implementación.

## Criterio de cada incremento

Trabajar en `master`, con cambios pequeños y reversibles, un commit revisado y
README actualizado. Probar propuestas en `experiments/` o un entorno aislado en
D: antes de incorporarlas. Conservar respaldos verificados de código y datos;
no mezclar recuerdos, credenciales, modelos, bóveda personal ni experimentos con
la distribución. Registrar qué pruebas son automáticas, sintéticas o reales.
No eliminar un puente o archivo anterior hasta cubrir su función, accesibilidad,
errores y navegación y disponer de reversión probada.

## Fase 0 — Reproducir lo que falló

1. Pedir a las personas afectadas la versión del sistema y arquitectura, cómo
   obtuvieron Alice, el paso en que falló y el mensaje exacto. Solicitar registros
   sólo después de quitar claves, rutas personales y contenidos de conversación.
2. Repetir desde un clon o paquete limpio en Windows x86_64 y Ubuntu x86_64,
   sin los modelos, variables o datos privados de esta máquina. El primer
   objetivo es observar instalación, arranque y errores, no inferir sus causas.
3. Inventariar rutas absolutas, binarios externos, FFmpeg, Python, Node, Rust,
   WebView y modelos; distinguir los obligatorios para arrancar de los opcionales
   para conversación local, voz y acciones. Anotar dependencia, plataforma,
   licencia, tamaño y cómo detectar su ausencia.
4. Priorizar cada fallo por efecto y anotar reproducción, corrección y prueba.

**Termina cuando:** los dos intentos limpios tienen un informe reproducible o
una limitación concreta documentada, con errores claros y sin datos personales.
La falla original se confirma sólo cuando se puede contrastar con el equipo afectado.

## Fase 1 — Base portable e instalación inicial

1. Separar las rutas de aplicación, configuración, datos, caché y modelos según
   el sistema; permitir selección explícita y migración desde la instalación
   actual con respaldo y reversión. No trasladar automáticamente los datos reales.
2. Incorporar un diagnóstico y una primera configuración livianos: comprobar
   permisos, almacenamiento y recursos; explicar qué falta y permitir elegir
   modo local o proveedor configurado. No solicitar ni descargar modelos o
   credenciales sin una decisión visible.
3. Iniciar con datos nuevos y vacíos; la ausencia de un motor o de red debe
   presentarse con claridad sin impedir abrir funciones independientes. Separar
   las claves por usuario y evitar incluirlas en diagnósticos o paquetes.
4. Preparar pruebas repetibles de instalación desde cero, actualización,
   desinstalación y recuperación; revisar licencias y verificación de integridad
   para cada componente distribuido. El destino y las reglas de los respaldos
   deben configurarse por sistema, conservando el D: actual del propietario.

**Termina cuando:** una instalación limpia de prueba abre y explica su estado
en Windows y Ubuntu sin heredar rutas de esta máquina, conserva datos tras una
actualización y permite recuperarlos sin sobreescribir el original.

## Fase 2 — Distribución y plataformas

1. Activar y diseñar el empaquetado Tauri de forma separada del entorno de
   desarrollo. Publicar instaladores de prueba primero: Windows x86_64 y un
   formato elegido para Ubuntu x86_64. Modelos y motores se instalan o seleccionan
   con información de tamaño, licencia y compatibilidad; no asumir que todos
   pueden redistribuirse. Evaluar binarios auxiliares específicos por plataforma.
2. Preparar macOS desde cero, inicialmente en Apple Silicon o Intel según el
   equipo disponible; acordar después cuál se podrá probar. Compilar, instalar y
   abrir en una máquina o entorno macOS real, evaluar micrófono y permisos, y
   adaptar las acciones del sistema. Planificar firma/notarización y sus costos
   antes de una distribución pública; no afirmar que macOS funciona sin evidencia.
3. Añadir CI de compilación y pruebas para Windows, Linux y macOS. Separar CI de
   pruebas reales de instalador, audio, proveedor, pantalla, hardware y servicios.
   Confirmar distribución y versión de Linux objetivo antes de ampliar soporte.
4. Diseñar adaptadores por sistema para apertura de apps y controles multimedia,
   con una matriz visible de capacidades, permisos, limitaciones y equivalencias.
   No interpretar que un adaptador para Windows también sirve en macOS o Linux.

**Termina cuando:** las plataformas anunciadas tengan instalador probado desde
cero en el sistema y arquitectura declarados, más un inventario veraz de
funciones verificadas, no disponibles y aún pendientes.

## Fase 3 — Migración a Dioxus manteniendo Tauri

La ruta propuesta es sustituir progresivamente la interfaz React por Dioxus Web,
manteniendo Tauri/Rust, sus comandos, permisos y almacenes. Dioxus permite seguir
utilizando HTML/CSS; no garantiza por sí solo la fidelidad visual ni una mejora
de rendimiento. La compatibilidad entre WebViews y WASM debe comprobarse por
plataforma. Las opciones y limitaciones están en la [guía Dioxus Web](https://dioxuslabs.com/learn/0.7/guides/platforms/web/)
y la [guía de estilos](https://dioxuslabs.com/learn/0.7/tutorial/assets/).

1. Hacer un inventario de pantallas, componentes, CSS, iconos, navegación,
   eventos, comandos Tauri, accesibilidad y dependencias JavaScript (como Three.js,
   RNNoise y audio). Medir arranque, memoria y tamaño antes de comparar.
2. Completar un prototipo aislado de la **carcasa y navegación Dioxus** que monte
   Estado y controles sin `StateControlsHost.tsx`, con datos ficticios y luego
   con el backend aislado. Probar montaje, desmontaje, acción, errores y retorno.
   Eliminar el puente React sólo cuando esa nueva ruta reemplace sus funciones.
3. Evaluar Flujo cognitivo como siguiente candidato: primero auditar sus
   componentes y datos reales, después portar y comparar. Su pequeño archivo
   de página no demuestra que sus componentes o lógica sean simples.
4. Continuar una vista a la vez: navegación y lectura, luego pantallas con
   interacciones, memoria y conversación; dejar volumen 3D y avatar para el
   momento en que se valide su integración. Mantener interop JS acotado cuando
   una biblioteca no tenga sustituto Rust viable; no duplicar procesamiento.
5. Por pantalla, comparar capturas a diferentes tamaños y plataformas, teclado,
   contenido, datos reales autorizados, estados vacíos y errores, permisos,
   consumo y comportamiento al cambiar de página. Si falla, volver al estado
   anterior verificado. Retirar código React sólo tras cumplir estos criterios.
6. Terminar la sustitución de React, incluido el estado global, la navegación,
   el arranque, los hosts y las vistas de recuperación. Retirar React, React DOM,
   sus tipos y el plugin/configuración JSX después de probar sus sustitutos.
   Verificar que el bundle y una instalación limpia funcionan sin React.
   Vite, Node y los puentes JavaScript independientes se evalúan por su función
   de construcción o acceso al navegador; no deben confundirse con React.

## Fase 4 — Producto y aceptación

- Conversación útil, compañía y personalidad: respuestas claras, límites honestos,
  sin afirmar sentimientos, conciencia o acciones no realizadas; conservar los
  controles existentes y evitar recargar la pestaña de Conversación.
- Voz: medir por separado captura, transcripción, respuesta y síntesis; ensayar
  voz real, pausas, habla rápida, ruido y música en cada sistema admitido.
- Memoria: datos reales y decisiones del usuario; instalación vacía sin recuerdos
  inventados. Mantener el currículo autorizado y aplazar cambios de persistencia
  y grafos R6/R8 hasta una revisión específica.
- Acciones: probar una por una con autorización y resultados observables; una
  solicitud no debe presentarse como ejecutada si no hay confirmación del sistema.
- Obsidian: conservar los datos privados fuera de Git; documentar y distribuir
  una bóveda inicial vacía o ejemplos ficticios, no los recuerdos del propietario.
- Aceptación de terceros: una persona ajena instala, configura, conversa, reinicia,
  conserva su memoria y prueba acciones soportadas. Recoger errores sin datos
  personales y repetir tras cada corrección.

## Matriz inicial: objetivo, no promesa de funciones

| Entorno | Evidencia actual | Meta pendiente |
|---|---|---|
| Windows x86_64 | Instalación de desarrollo del propietario; otra persona informó un fallo sin detalles. | Instalación limpia e instalador, voz y acciones verificadas en otro equipo. |
| Ubuntu 26.04 x86_64 | CI y pruebas históricas en el equipo del propietario; otra persona informó un fallo sin detalles. | Instalación limpia independiente, instalador y validación real de capacidades. |
| macOS | Sin aceptación real encontrada en esta revisión. | Elegir arquitectura probada, instalar y medir adaptadores y permisos en macOS. |

Fuentes de empaquetado: [distribución Tauri](https://v2.tauri.app/distribute/) y
[binarios auxiliares](https://v2.tauri.app/develop/sidecar/). La arquitectura
final y los requisitos mínimos se fijarán con resultados, no por suposición.
