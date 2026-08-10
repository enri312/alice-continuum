# Informe R4.3 — Simulador estático de planes

Fecha: 2026-08-10  
Estado: validado

## Alcance comprobado

- Resolución del manifiesto contra las 24 capacidades generadas por R1.
- Resultado cerrado `r4-static-plan-v1` con SHA-256 del manifiesto y del plan.
- Pasos ordenados, capacidades requeridas, permisos, efectos, alcances de datos y requisitos.
- Bloqueos para ejecución deshabilitada, estado no aprobado, entradas ausentes, precondiciones no evaluadas y capacidades no disponibles.
- `canExecute: false`, cero invocaciones de adaptador y cero efectos en todos los resultados.
- Omisión de valores y descripciones sensibles del resultado serializado.
- Parser TypeScript que rechaza campos desconocidos, ejecución aparente o incoherencias por paso.

## Pruebas específicas

| Comprobación | Resultado |
|---|---|
| Rust R4.3 controladas | 7/7 aprobadas |
| TypeScript R4.3 | 4/4 aprobadas |
| Prueba viva canónica Rust | 1/1 aprobada |

La prueba viva recibió `ALICE_LIVE_DATA_DIR` apuntando a la carpeta canónica, construyó `CapabilityProbeSnapshot` mediante los probes reales, confirmó 24 capacidades, simuló una lectura de memoria y calculó una huella recursiva antes/después. No modificó ningún archivo.

## Límites preservados

- No se abrió cámara ni micrófono.
- No se llamó a nube, memoria, procesos, avatar ni adaptadores de salida.
- No se creó `data/skills` ni un borrador canónico.
- Las pruebas de error usan archivos físicos temporales o estructuras cerradas; nunca corrompen recuerdos privados.

## Puertas completas

| Puerta | Resultado |
|---|---|
| TypeScript completo | 91/91 aprobadas |
| Rust completo | 124/124 normales; 5 sondas separadas |
| Sonda viva R4.3 | 1/1 aprobada explícitamente |
| `cargo fmt --check` | aprobado |
| `cargo clippy --all-targets -- -D warnings` | aprobado |
| Build web | aprobado |
| Build Tauri release | aprobado |

El build mantiene el aviso no bloqueante ya conocido del chunk diferido del visor Avatar; no afecta la corrección de R4.3.

## Integridad privada antes y después

| Recurso | Antes | Después |
|---|---:|---:|
| Archivos bajo `data/` | 10 | 10 |
| SHA-256 agregado de rutas y contenidos | `0CF187A5A5E04D12E960743EA51BDC43A0EC58ECD134C20FB03242F847907B35` | igual |
| `data/skills` canónico | inexistente | inexistente |
| Avatar privado | `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B` | igual |
