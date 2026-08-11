# Informe de validación R5.2 — Detector conservador de procedimientos

Fecha: 2026-08-11  
Resultado: aprobado

## Alcance

- Comando nativo de sólo lectura `procedure_detection_status`.
- Ventana de evidencia `r3-visible-current-v1`.
- Filtro cerrado de productores `capability`, `memory` y `cloud` con `execution + success`.
- Validación de capacidad, operación, madurez y riesgo contra R1.
- Agrupación por UUID de operación y secuencia exacta.
- Mínimo de tres ocurrencias y dos pasos.
- Rechazo de secuencias con timestamps empatados y orden ambiguo.
- Huella SHA-256 sin parámetros ni contenido privado.
- Parser TypeScript defensivo.
- Persistencia, candidato y ejecución fijados en `false`.

## Evidencia real canónica

La prueba ignorada `live_canonical_detector_reads_without_writes_or_invented_patterns` se habilitó explícitamente con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`.

| Métrica | Resultado |
|---|---:|
| Eventos R3 visibles examinados | 22 |
| Ejecuciones calificadas | 0 |
| Patrones elegibles | 0 |
| Escrituras | 0 |

Los 10 archivos canónicos de datos se midieron antes y después y permanecieron idénticos en tamaño y SHA-256. El resultado vacío demuestra que arranques, permisos, simulaciones R4 y acciones aisladas no se convirtieron en aprendizaje.

## Pruebas

- Cinco pruebas Rust nuevas del detector más la sonda canónica explícita.
- Cuatro pruebas TypeScript nuevas del snapshot.
- Suite completa final del checkpoint: 113/113 TypeScript y 142/142 Rust; siete sondas vivas separadas.
- Formato, `clippy -D warnings`, build Rust, frontend y Tauri release aprobados usando el destino alternativo para no interrumpir la instancia interactiva del DualSense.

## Límite

R5.2 no conserva patrones ni crea candidatos. El próximo incremento R5.3 deberá separar almacenamiento, descarte y revisión del Taller R4.
