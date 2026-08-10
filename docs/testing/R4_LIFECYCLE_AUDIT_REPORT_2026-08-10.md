# Informe de pruebas R4.4 — ciclo de vida y auditoría

Fecha: 2026-08-10  
Alcance: revisiones inmutables, transiciones nativas y eventos R3

## Evidencia funcional

Las pruebas de Rust usaron carpetas temporales físicas y archivos JSON/JSONL reales. El recorrido completo fue:

`draft → inReview → approved → disabled → approved → retired`

Se verificó que:

- el borrador y cada transición producen revisiones distintas;
- la revisión aprobada conserva exactamente sus bytes después de desactivar, restaurar y retirar;
- el estado final contiene seis revisiones y ejecución deshabilitada;
- las cinco decisiones producen diez eventos R3 en pares solicitud/resultado con un UUID estable por operación;
- el motivo privado de confirmación no aparece en la auditoría;
- una transición inválida produce bloqueo R3 y no cambia la revisión actual;
- si falla el evento R3 inicial no aparece `lifecycle.json` ni una carpeta de revisiones;
- una revisión manipulada se detecta por SHA-256 y no se repara;
- la simulación real escribe un par R3 correlacionado y no registra descripción ni valores privados.

## Resultados

- TypeScript/Vitest: 94 aprobadas.
- Rust: 129 aprobadas; 6 sondas vivas ignoradas por requerir entorno explícito.
- Aceptación viva canónica R4.4: 1 aprobada contra `E:\Alice Cognitive Core\data`; confirmó por digest que la lectura no modificó archivos y que `data/skills` permanece ausente.
- `cargo fmt -- --check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- build web: aprobado.
- build Tauri release: aprobado; se conserva el aviso no bloqueante ya conocido por el tamaño del chunk diferido del visor Avatar.

## Datos privados

Las pruebas normales no abrieron cámara ni micrófono porque R4.4 no utiliza dispositivos. No modificaron recuerdos, avatar ni `data/skills` canónico. Los fixtures fueron eliminados al finalizar.

El cierre conservó 10 archivos bajo `data/`, el avatar privado de 18.631.596 bytes y su SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`.
