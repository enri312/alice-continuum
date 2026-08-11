# Informe R5.4 — Conversión gobernada a borrador R4

Fecha: 2026-08-11  
Resultado: aprobado

## Resultado funcional

- Un candidato R5 retenido puede convertirse una sola vez en un borrador R4 nuevo.
- El borrador conserva decisión, candidato, huella y SHA-256 de origen.
- Título, descripción, propósito e identidad se revisan antes de escribir.
- Un candidato descartado, confirmación incorrecta, huella usada o `skillId` ocupado fallan sin crear ni sobrescribir archivos.
- La consulta cruza la procedencia del borrador con el almacén R5 y falla si la decisión, candidato o SHA no coinciden.
- Revisión, aprobación, desactivación y restauración crean revisiones y preservan la procedencia R5.
- Aprobación y ejecución automática permanecen deshabilitadas.
- La pestaña **Procedimientos** muestra el puente; el Taller conserva el gobierno posterior.

## Pruebas

| Comprobación | Resultado |
|---|---|
| TypeScript / Vitest | 151/151 aprobadas |
| Rust normal | 158 aprobadas |
| Sondas vivas Rust | 9 separadas; R5.4 ejecutada manualmente |
| `cargo fmt --check` | aprobado |
| `cargo clippy -- -D warnings` | aprobado |
| `npm run build` | aprobado |
| `cargo build` | aprobado |

Las pruebas de conversión usan archivos JSON reales, el almacén transaccional R4 y los validadores de producción. No se usó el perfil canónico para fabricar un candidato.

## Sonda canónica

Con `ALICE_LIVE_DATA_DIR=%APPDATA%\com.carlosnunez.alicecognitivecore`, la consulta R5.4 devolvió:

- 0 conversiones;
- `executionEnabled=false`;
- `automaticApproval=false`;
- árbol de datos idéntico antes y después.

Es el resultado correcto porque Alice todavía no posee patrones R5 reales retenidos.

## Hallazgo corregido

La primera suite completa reveló que un evento administrativo R5 no activaba regiones, pero sí elevaba el contador global del Núcleo. Se corrigió el cálculo: los eventos `source=procedure` permanecen auditables y visibles, pero aportan señal cognitiva global cero. La prueba de regresión aprobó.
