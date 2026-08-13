# Informe de cierre R5.5 — Evidencia procedimental gobernada

Fecha: 2026-08-13  
Resultado: aprobado

## Alcance

R5.5 cierra la fase de aprendizaje gobernado de procedimientos. La pantalla y el backend distinguen estados vacío, candidato vigente, descartado, convertido, bloqueado y evidencia obsoleta; muestran pasos, repeticiones, eventos y diferencias sin inventar actividad ni copiar contenido privado.

## Prueba integral real sobre almacenamiento temporal

La prueba `r5_closeout_classifies_current_stale_dismissed_converted_and_blocked` usa `AuditEvent::producer`, el Registro R1 real del módulo y archivos JSON físicos dentro de una raíz temporal distinta de `data/`:

1. produce tres operaciones UUID distintas, cada una con una lectura de memoria y una inspección de proveedor exitosas;
2. R5.2 reconstruye un patrón de dos pasos y tres ocurrencias;
3. `retain` escribe un candidato validado y SHA-256;
4. el estado se clasifica `current` mientras la huella está presente;
5. con R3 saludable y ventana vacía se clasifica `stale`;
6. con R3 no saludable se clasifica `blocked`;
7. un fingerprint con procedencia R4 verificable se clasifica `converted`;
8. una decisión `dismiss` independiente se clasifica `dismissed`.

La prueba `stale_retained_evidence_cannot_cross_into_r4` vuelve obsoleta la evidencia retenida y solicita conversión. El backend rechaza con error explícito, no crea `skills/` y confirma que todos los archivos existentes mantienen exactamente sus SHA-256.

## Resultados

| Comprobación | Resultado |
|---|---|
| Estados cerrados R5.5 | `current`, `stale`, `dismissed`, `converted`, `blocked` |
| Conversión con evidencia obsoleta | Rechazada nativamente |
| Datos canónicos | No usados ni modificados por fixtures |
| Ejecución de habilidades | Deshabilitada |
| Aprobación automática | Deshabilitada |
| Memoria duradera | Sin escrituras R5 |
| Razones privadas | Sólo digest SHA-256 |

La sonda canónica de sólo lectura continúa siendo una prueba ignorada que exige `ALICE_LIVE_DATA_DIR`; no se ejecuta implícitamente. El estado canónico esperado permanece vacío hasta que existan ejecuciones productoras repetidas reales.

## Sonda canónica real

Con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`, las tres sondas ignoradas de R5 se ejecutaron explícitamente contra el almacenamiento canónico:

- 38 eventos R3 leídos;
- 0 ejecuciones productoras calificadas;
- 0 patrones detectados;
- 0 decisiones retenidas o descartadas;
- 0 conversiones R4;
- los 10 archivos canónicos conservaron exactamente sus SHA-256 antes y después.

Este resultado vacío es correcto: el detector no convierte actividad aislada o manual en aprendizaje procedimental.

## Puerta completa de calidad

| Comando | Resultado |
|---|---|
| `npm test` | 221/221 aprobadas |
| `npm run build` | Aprobado; sólo advertencias conocidas de tamaño de chunks |
| `cargo fmt --check` | Aprobado |
| `cargo test` | 160 aprobadas, 9 ignoradas, 0 fallidas |
| `cargo clippy --all-targets --all-features -- -D warnings` | Aprobado |
| `cargo build` | Aprobado |

## Límite

R5 no aprende movimientos, hechos personales ni contenido conversacional. Solamente propone secuencias de capacidades registradas a partir de ejecuciones R3 exitosas y siempre requiere decisión del propietario. La memoria por capas comienza en R6 como una fase separada.
