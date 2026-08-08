# Informe funcional del visor VRM — 2026-08-07

Estado: aprobado para visor local v1  
Archivo: `E:\Proyecto P\Assets\Alice.vrm`  
Red utilizada: ninguna

## Alcance

- Consulta nativa de existencia, ruta y tamaño.
- Exposición mediante protocolo de activos limitado al archivo exacto.
- Carga VRM 1.0 con Three.js y `@pixiv/three-vrm`.
- Renderizado WebGL, encuadre automático y controles orbitales.
- Lectura de metadatos, rig, expresiones y huesos secundarios.
- Desmontaje y segunda carga del visor.
- Verificación de consola y cierre del puerto de diagnóstico.

## Resultado real

| Indicador | Resultado |
|---|---|
| Estado final | `VRM LISTO` |
| Tamaño | 17,8 MB |
| Canvas WebGL | 1, con resolución observada de 713 × 775 |
| Huesos humanoides | 54 |
| Expresiones declaradas | 14 |
| Spring joints | 161 |
| Colliders | 22 |
| Crédito | Requerido |
| Redistribución | Prohibida |
| Modificación | Prohibida |
| Segunda carga limpia | Aprobada; un solo canvas y un solo control de cámara |
| Errores o advertencias | 0 después de corregir el favicon ausente |
| Puerto 9222 al finalizar | Cerrado |

## Límites comprobados

El visor no activa cámara, micrófono, voz, seguimiento facial, expresiones dirigidas, Mocap, VRChat ni Ragdoll. Puentes continúa mostrando cero adaptadores conectados.

El archivo no se copia a `public/`, `dist/`, memoria, exportaciones ni instaladores. `Assets/*.vrm` continúa ignorado por Git.

## Observación de metadatos

El campo de autor del VRM contiene `Carlos NUñez`; el copyright contiene `© 2026 Carlos Núñez`. Alice muestra el contenido exacto del archivo y no lo corrige silenciosamente. Si se desea uniformarlo, debe corregirse en el proyecto original de VRoid Studio y volver a exportarse por su creador.

## Rendimiento inicial

El visor se carga de forma diferida. El JavaScript principal quedó en aproximadamente 339 KB y el bloque 3D de aproximadamente 782 KB solo se solicita al abrir Avatar. El archivo VRM de 17,8 MB permanece externo al paquete.
