# Informe de validación R5.1 — Candidatos de procedimientos

Fecha: 2026-08-11  
Resultado: aprobado

## Alcance comprobado

- Contrato Rust cerrado y serialización `camelCase`.
- Parser TypeScript con campos exactos.
- Validación contra capacidades y operaciones R1.
- Evidencia R3 correlacionada por UUID de operación y evento.
- Mínimo de tres ocurrencias y dos pasos.
- Rechazo de eventos reutilizados, no exitosos, ajenos al paso o de productores no admitidos.
- Riesgo no inferior al máximo de las capacidades observadas.
- Diferencias de duración y huella recalculadas desde eventos.
- Política fija sin autoactivación, ejecución ni memoria duradera.
- Ausencia de comandos Tauri, persistencia o adaptadores R5.

## Pruebas ejecutadas

| Puerta | Resultado real |
|---|---|
| Pruebas dirigidas Rust R5.1 | 6 aprobadas |
| Pruebas dirigidas TypeScript R5.1 | 4 aprobadas |
| Suite TypeScript completa | 102/102 aprobadas |
| Suite Rust completa | 137/137 aprobadas; 6 sondas vivas ignoradas por requerir entorno/hardware explícito |
| `cargo fmt --check` | aprobado |
| `cargo clippy -- -D warnings` | aprobado sin advertencias |
| `cargo build` | aprobado |
| `npm run build` | aprobado; bundle principal 451,47 kB |
| `npm run tauri build` | aprobado; ejecutable release generado |

Las pruebas R5 construyeron eventos mediante el productor R3 real y ejecutaron las validaciones reales contra un Registro R1 aislado. Los datos usados fueron fixtures sintéticos separados, como exige el Roadmap; no se usaron recuerdos, conversaciones, credenciales ni el avatar como datos de prueba.

## Integridad

- `data/`: 10 archivos antes y después.
- SHA-256 agregado de rutas, tamaños y hashes: `3FAEDF485D911ADCE2CAE4807889E849BD771EF57D089E38FDA9406349716F43` antes y después.
- Avatar `Assets/Alice.vrm`: 18.631.596 bytes; SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`.
- `analysis_results.md` se conserva local, fuera del commit mediante `.git/info/exclude`.

## Limitaciones honestas

- No existe detector R5.2 ni almacén de candidatos.
- Los eventos actuales de simulación y ciclo de vida R4 no califican como ejecuciones.
- El estado real permanece en cero candidatos.
- Aprobar habilidades R4 continúa sin habilitar ejecución.
- El aviso de Vite para el chunk diferido del avatar (783,04 kB) permanece conocido y no fue introducido por R5.1.

