# ADR-P-061 — Almacén separado y decisiones explícitas de procedimientos

Fecha: 2026-08-11  
Estado: aceptada para R5.3

## Contexto

R5.2 detecta patrones repetidos desde la ventana R3, pero su resultado es efímero. Conservar un patrón no debe confundirse con crear una habilidad R4, consolidar memoria R6 ni conceder a Alice capacidad de ejecución. Descartarlo tampoco debe alterar capacidades o evidencia histórica.

## Decisión

- Las decisiones viven exclusivamente en `data/procedures/candidate-decisions-v1.json`, separadas de `data/skills` y `data/memory`.
- La consulta es pasiva: si el archivo no existe, no crea carpeta ni contenido.
- Antes de decidir se vuelve a ejecutar R5.2; la huella debe seguir presente en la evidencia R3 vigente.
- Cada huella admite una sola decisión inmutable: `retain` o `dismiss`.
- Ambas decisiones exigen actor `localOwner`, confirmación explícita, huella esperada exacta y motivo visible de 12 a 600 caracteres.
- `retain` conserva un `ProcedureCandidate` completo validado contra R1/R3 y su SHA-256.
- `dismiss` conserva únicamente identidad, huella, fecha, acción y el SHA-256 del motivo; no guarda título, propósito, pasos ni candidato.
- El texto del motivo nunca se persiste ni se copia a R3.
- Cada decisión escribe un flujo R3 mínimo `request → execution`, correlacionado y sin contenido privado.
- El reemplazo del archivo sincroniza una copia temporal, desplaza el archivo anterior y lo restaura si falla la publicación.
- La pantalla **Procedimientos** pertenece a `GOVERNANCE CORE` y permanece separada del **Taller** R4.
- `executionEnabled` y `skillDraftCreated` permanecen siempre en `false`.

## Consecuencias

- El propietario puede conservar o descartar una observación sin otorgar autonomía nueva.
- El estado vacío canónico continúa siendo válido y visible; no se siembran patrones ficticios.
- Corregir o convertir un candidato en borrador R4 queda para R5.4 y requerirá otra decisión explícita.
- Una huella ya decidida no puede reinterpretarse silenciosamente.

## Evidencia

Las pruebas escribieron archivos JSON y JSONL reales en directorios temporales, reabrieron el candidato por SHA-256, comprobaron inmutabilidad y verificaron que el motivo no aparece en disco. La sonda canónica leyó 200 eventos, encontró cero patrones y confirmó cero decisiones, carpeta R5 inexistente, ejecución deshabilitada y cero borradores R4, sin modificar datos.
