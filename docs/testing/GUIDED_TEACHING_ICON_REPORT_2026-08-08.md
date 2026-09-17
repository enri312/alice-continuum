# Informe funcional — Enseñanza guiada y emblema de Alice

Fecha: 2026-08-08  
Estado: aprobado

## Enseñanza guiada

La pantalla Memoria incorpora seis puntos de partida: **Sobre mí**, **Facultad**, **Proyectos**, **Preferencias**, **Personas** y **Reglas para Alice**. Cada opción cambia el tipo sugerido, importancia, explicación y textos de ayuda, pero mantiene tema y contenido vacíos.

Elegir una guía no escribe `records.json`, no consulta OpenRouter y no deduce información personal. La única operación persistente sigue siendo **Guardar enseñanza local**.

## Emblema

Se creó `icons/app-alice.svg` como fuente estática. El diseño combina:

- hemisferio cian para entrada y memoria;
- hemisferio ámbar para respuesta;
- núcleo violeta de identidad;
- una A central y marco HUD industrial.

El SVG no contiene animaciones ni reutiliza el avatar VRM. Con el comando oficial de Tauri se generaron PNG, ICO e ICNS. El `.ico` quedó embebido en el ejecutable de `src-tauri/target/debug`, el favicon comparte el mismo emblema y la ventana principal lo asigna también durante el arranque.

## Corrección de arranque

Durante la revisión se detectó que una instancia manual antigua se había abierto desde `.cargo-target/debug`, conservando el icono anterior. `Iniciar Alice Continuum.cmd` ahora fija `CARGO_TARGET_DIR=src-tauri\target`, de modo que el arranque y la recompilación utilizan un único ejecutable. La caché antigua no se utiliza ni se modifica. Además, el backend carga `src-tauri/icons/icon.png` y lo aplica a la ventana `main`, lo que evita depender de la caché del icono del proceso durante el desarrollo.

## Resultados

| Comprobación | Resultado |
|---|---|
| Plantillas | 6 categorías, sin valores personales precargados |
| Pruebas TypeScript | 28/28 aprobadas |
| Pruebas Rust | 10/10 aprobadas |
| Compilación frontend | Aprobada |
| Icono fuente | SVG estático válido |
| Icono a 32 × 32 | Legible |
| Icono extraído del ejecutable vigente | Coincide con el emblema nuevo |
| Icono aplicado a la ventana al arrancar | Aprobado |
| Escrituras automáticas provocadas por la auditoría | Ninguna |

Durante la comprobación apareció una novena entrada creada mediante **Guardar enseñanza local**. Se conservó como acción explícita realizada desde la interfaz, no se copió su contenido a la documentación y no se alteró durante la auditoría.

## Evidencias

- `artifacts/guided-teaching-v1.png`
- `artifacts/alice-new-exe-icon.png`
- `src-tauri/icons/32x32.png`
