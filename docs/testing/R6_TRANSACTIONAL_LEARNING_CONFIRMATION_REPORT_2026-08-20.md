# Informe R6.4-C — Confirmación transaccional de aprendizaje

Fecha: 2026-08-20  
Resultado: aprobado

## Alcance comprobado

La confirmación de un candidato local ahora se ejecuta enteramente en Rust. El comando relee la memoria, reconstruye la propuesta original contra su evidencia literal, verifica la huella revisada, valida la edición humana y recién entonces prepara una enseñanza.

La escritura usa un bloqueo común del proceso, respaldo exacto, reemplazo atómico y auditoría. Si la auditoría falla, `records.json` se restaura. Un reintento idéntico devuelve el registro existente; uno con contenido diferente se rechaza.

## Pruebas automatizadas

- TypeScript: **290 aprobadas**.
- Rust: **203 aprobadas**, **16 sondas ignoradas por defecto**.
- `cargo fmt --check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `npm run build`: aprobado.
- `cargo build`: aprobado.

Los casos R6.4-C escribieron archivos físicos en directorios temporales y comprobaron:

1. anexado único con respaldo byte a byte y auditoría;
2. reintento exacto idempotente;
3. rechazo de reintento con contenido cambiado;
4. rechazo de fuente obsoleta sin escritura;
5. restauración exacta al inducir un fallo de auditoría.

## Prueba real no destructiva

Se ejecutó `live_canonical_r6_4_c_rejects_stale_confirmation_without_writing` con `ALICE_LIVE_DATA_DIR=E:\Alice Cognitive Core\data`.

Resultado observado:

- `staleRejected=true`;
- 21 archivos examinados;
- huellas anteriores y posteriores idénticas;
- cero recuerdos ficticios insertados.

La confirmación positiva canónica queda reservada a una propuesta real que Carlos revise y confirme desde la interfaz. No se sembraron datos de demostración en la memoria privada de Alice.
