# Informe — historial local durable de conversación

Fecha: 2026-09-04

## Alcance

- El estado ausente se consulta sin crear carpetas.
- Dos intercambios se escriben físicamente y sobreviven a una recarga desde disco.
- El contrato distingue historial, RAM y memoria R6 confirmada.
- El parser rechaza campos, fuentes, conteos o promoción automática incoherentes.
- Un JSON corrupto bloquea el anexo y permanece byte a byte sin reparación
  silenciosa.
- Repetir un `responseId` conserva exactamente los mismos bytes; una colisión con
  contenido diferente se bloquea.
- La escritura productiva usa reemplazo atómico y rollback si falla la auditoría.
- R3 conserva solamente la huella SHA-256 del intercambio.

## Evidencia

- `cargo test -q --lib`: 249 aprobadas, 0 fallidas, 19 ignoradas.
- `npm test`: 428 aprobadas en 43 archivos, 0 fallidas.
- `npm run build`: aprobado; permanece el aviso conocido de chunks grandes.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- Las pruebas Rust incluyen 3 casos nuevos sobre una raíz temporal física y las de
  TypeScript incluyen 2 casos nuevos del contrato cerrado.
- La integración de Conversación muestra explícitamente el guardado local antes de
  autorizar el procesamiento.

No se creó conversación ficticia dentro de `data/`. La primera comprobación
canónica debe realizarse enviando un mensaje real después de reiniciar Alice con el
binario actualizado y verificando su reaparición en el siguiente inicio.
