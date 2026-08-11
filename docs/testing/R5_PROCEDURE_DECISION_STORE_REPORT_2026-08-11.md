# Informe R5.3 — Almacén y decisiones de procedimientos

Fecha: 2026-08-11  
Resultado: aprobado

## Alcance probado

- Contrato Rust cerrado para conservar o descartar una huella R5 vigente.
- Almacén JSON separado de habilidades y memoria.
- Reemplazo sincronizado con preservación y restauración del archivo anterior.
- Candidato `retain` reconstruido desde evidencia real del detector y revalidado contra R1/R3.
- Decisión `dismiss` sin metadatos del candidato.
- Confirmación explícita del propietario y decisión inmutable por huella.
- Auditoría JSONL correlacionada sin texto del motivo.
- Parser TypeScript cerrado y pantalla independiente **Procedimientos** en Governance.
- Ejecución y creación de borradores R4 permanentemente deshabilitadas.

## Pruebas automáticas

| Comprobación | Resultado |
|---|---|
| TypeScript / Vitest | 148/148 aprobadas |
| Rust normal | 152 aprobadas; 8 sondas vivas ignoradas por defecto |
| Rust R5.3 dirigido | 5/5 aprobadas |
| `cargo fmt --check` | aprobado |
| `cargo clippy -- -D warnings` | aprobado |
| `npm run build` | aprobado |
| `cargo build` | aprobado |

Las pruebas R5.3 no son mocks de almacenamiento: crean un directorio temporal real, escriben y sincronizan JSON, vuelven a leerlo, verifican SHA-256, prueban duplicados inmutables y escriben auditoría JSONL real. Los eventos de evidencia se construyen con los mismos tipos y validadores R3 usados por la aplicación.

## Sondas canónicas reales

Se ejecutaron manualmente las dos pruebas ignoradas con `ALICE_LIVE_DATA_DIR` apuntando a `%APPDATA%\com.carlosnunez.alicecognitivecore`:

- R5.2 examinó 200 eventos, calificó 0 ejecuciones y devolvió 0 patrones.
- R5.3 devolvió 0 decisiones, informó que el almacén no existe y mantuvo `execution=false` y `skillDraftCreated=false`.

La auditoría canónica quedó byte a byte intacta durante R5.2. R5.3 confirmó que consultar no creó `procedures/` ni cambió el estado previo.

## Límites preservados

- No se creó ningún dato ficticio en el perfil canónico de Alice.
- No se escribió memoria R6.
- No se creó ni modificó una habilidad R4.
- No se invocó adaptador ni acción externa.
- La decisión del propietario no se representa como actividad cognitiva de Alice.
