# ADR-P-036 — Emblema estático de la aplicación

Fecha: 2026-08-08  
Estado: aceptada para implementación

## Contexto

El favicon vigente muestra solamente una letra A y el ejecutable conserva un `.ico` genérico. El icono de la aplicación debe identificar a Alice y representar el proyecto incluso cuando se vea a 16 o 32 píxeles. Los iconos internos usan marcos HUD, fondo azul oscuro, cian, violeta y ámbar.

## Decisión

- Crear `icons/app-alice.svg` como fuente vectorial cuadrada, estática y editable.
- Representar dos hemisferios conectados a un núcleo central con una A estructural, dentro de un marco industrial.
- Usar cian para entrada/memoria, ámbar para respuesta y violeta para el núcleo de identidad.
- Evitar texto pequeño, animaciones y detalles que desaparezcan en la barra de tareas.
- Utilizar la misma fuente para favicon y para generar el conjunto de iconos de Tauri.
- Conservar los archivos derivados en `src-tauri/icons/` y declarar el conjunto en `tauri.conf.json`.
- Asignar también `icons/icon.png` a la ventana principal durante el arranque. Así el modo de desarrollo no depende únicamente del recurso del ejecutable ni de la caché visual de Windows.
- Mantener un único destino de compilación en `src-tauri/target` desde `Iniciar Alice Continuum.cmd` para evitar abrir una copia anterior de Alice.

## Criterios de aceptación

1. El SVG no contiene animaciones.
2. La silueta principal se distingue a 32 × 32 píxeles.
3. Windows recibe un `icon.ico` multirresolución generado por Tauri.
4. El navegador y el ejecutable comparten el mismo emblema.
5. El icono no utiliza el avatar VRM ni incorpora activos con restricciones de redistribución.
6. La ventana principal aplica explícitamente el mismo icono al iniciar.
