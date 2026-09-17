# ADR-P-042 — Identidad técnica Alice Cognitive Core

Fecha: 2026-08-08  
Estado: implementada históricamente; denominación sustituida por [ADR-P-095](ADR-P-095-identidad-alice-continuum.md) el 2026-09-16. Se conserva el registro original.

## Contexto

`Proyecto P` fue un nombre temporal utilizado durante el relanzamiento de Alice. Ya no describe la arquitectura alcanzada y no es adecuado como nombre permanente de carpeta, paquete o repositorio. El proyecto histórico `E:\Alice` debe permanecer intacto y el repositorio privado `enri312/Alice` no debe reutilizarse.

## Decisión

- Mantener **Alice** como nombre visible de la asistente.
- Adoptar **Alice Cognitive Core** como nombre técnico del proyecto.
- Usar `E:\Alice Cognitive Core` como nueva carpeta raíz.
- Usar `alice-cognitive-core` para los paquetes JavaScript y Rust, el ejecutable y el futuro repositorio.
- Usar `alice_cognitive_core_lib` como nombre de la biblioteca Rust.
- Usar `com.carlosnunez.alicecognitivecore` como identificador Tauri.
- Crear `https://github.com/enri312/alice-cognitive-core` con visibilidad privada.
- Migrar código, historial Git, memoria y avatar por copia verificada. No borrar `E:\Proyecto P` durante esta operación.
- Conservar compatibilidad de lectura con `proyecto-p-sessions-v1` y copiar su contenido a `alice-cognitive-core-sessions-v1` cuando exista.

## Reglas de seguridad

- `data/`, archivos `.vrm` y `.vroid`, variables de entorno y claves no se publican.
- La copia de datos se verifica por inventario, tamaño y SHA-256 antes de considerar activa la nueva ruta.
- El remoto se configura únicamente en la nueva copia.
- La carpeta histórica queda como respaldo hasta que Carlos Nuñez compruebe el arranque desde la nueva ubicación.
- `E:\Alice` y el repositorio histórico `enri312/Alice` no se modifican.

## Consecuencias

- Codex debe abrir la nueva carpeta en una tarea posterior para que las herramientas resuelvan el workspace correcto.
- Los artefactos temporales de compilación y `node_modules` se regeneran y no necesitan migrarse.
- El identificador Tauri nuevo cambia el fallback de AppData; el iniciador evita dispersión al fijar `ALICE_DATA_DIR` dentro de la nueva raíz.
- Los informes históricos pueden conservar `E:\Proyecto P` como evidencia del momento en que fueron generados.

## Criterios de aceptación

- Nombres de paquete y biblioteca compilan con los identificadores nuevos.
- Las pruebas TypeScript y Rust aprueban.
- La nueva carpeta contiene el mismo commit y el mismo conjunto de archivos versionados.
- Memoria y avatar privados coinciden por SHA-256 entre origen y destino.
- GitHub informa `visibility: PRIVATE`.
- La rama predeterminada publicada coincide con el commit verificado localmente.
