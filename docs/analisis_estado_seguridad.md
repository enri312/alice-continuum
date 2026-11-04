# Alice Continuum — Estado, seguridad y avance

Fecha del análisis: 2026-10-04 · Rama `master` (último commit `e8158c8`) + 13 archivos sin commitear (ADR-P-096).

## 1. Resumen del proyecto

Aplicación de escritorio **Tauri 2 + React 19 + Rust**, local-first, para la asistente "Alice":
memoria gobernada, conversación (Ollama/Gemma local + 6 proveedores de nube), percepción
autorizada (ventana, cámara, micrófono), auditoría R3, habilidades simuladas, tareas y grafo de conocimiento.

| Indicador | Valor |
|---|---|
| Backend Rust | 31 módulos, ~95 comandos IPC; `memory.rs` solo tiene **10.876 líneas** |
| Pruebas frontend (hoy) | **477 aprobadas**, 2 omitidas (55 archivos) |
| Pruebas Rust (hoy) | **293 aprobadas**, 0 fallidas, 22 sondas ignoradas |
| `npm audit` | 0 vulnerabilidades |
| ADRs | 96 decisiones documentadas |
| Empaquetado | `bundle.active=false`; solo corre en modo `tauri dev` |
| Trabajo en curso | ADR-P-096: calidad conversacional y voz — **no validada** por el propietario |

### Fases del roadmap

| Fase | Estado | Criterios |
|---|---|---|
| R1 Registro de capacidades | ✅ Completa | 6/6 |
| R2 Gateway de permisos | ✅ Alcance inicial | 5/5 |
| R3 Auditoría unificada | ✅ Completa | 7/7 |
| R4 Taller de habilidades | ✅ Completa | 5/5 |
| R5 Aprendizaje de procedimientos | ✅ Completa | 5/5 |
| R6 Memoria por capas | ✅ Completa | 5/5 |
| R7 Tareas e intenciones | ✅ Completa | 5/5 |
| R8 Grafo de conocimiento | ✅ Completa | 5/5 |
| R9 Presencia, voz y cuerpo | 🟡 En diseño (voz manual parcial) | 1/10 |
| R10 Distribución segura | ⚪ Futura | 0/5 |

## 2. Huecos de seguridad

El propio README reconoce hallazgos del **2026-09-14 aún sin corregir**. Los verifiqué en el código y agregué otros.

### 🔴 Alta

**S1 — El guardado genérico permite saltarse la gobernanza de memoria**
[save_memory](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/memory.rs#L7160-L7201) acepta el arreglo completo desde la webview.
[validate_generic_memory_update](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/memory.rs#L7077-L7157) solo protege contenido, versión, archivo y eliminación. **No protege**:
- `memoryStatus`: un recuerdo `confirmed` puede pasar a `null` sin tocar el contenido, y en un segundo guardado editarse o borrarse libremente.
- `suppressionStatus` y `accessibilityStatus`: se pueden activar o liberar sin el contrato con respaldo, motivo y auditoría.
- `storageStrength`, `successfulRecalls`, `retrievalEvidenceVersion`, `importance`, `source`, `affects`.
- Recuerdos nuevos pueden nacer ya como `confirmed`.

**S2 — Permisos de disco abiertos sobre `data/`**
`icacls` muestra `BUILTIN\Users:(F)` y `Authenticated Users:(M)` (heredados de la raíz de `E:`).
Cualquier cuenta o proceso del equipo puede leer recuerdos y perfil, y también alterar o borrar auditorías, permisos y tareas.

**S3 — La autorización de envíos a la nube vive solo en React**
[send_cloud_message](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/cloud.rs#L363-L458) envía el `payload` tal como llega, sin vista previa nativa, sin token de confirmación y sin TTL. R1 lo declara `enforcedBy: currentUi`.
Contrasta con `voice_output.rs`, que sí liga vista previa, SHA-256 y TTL de 10 minutos.

### 🟠 Media

**S4 — Las confirmaciones del propietario son el mismo canal IPC**
`decide_permission_request` y los `confirmed: bool` (documentos, voz, memoria) vienen de la propia webview, no de un diálogo nativo fuera de banda.
Si el renderer se viera comprometido, podría autoaprobarse. La CSP estricta (`script-src 'self'`) mitiga el riesgo, pero no lo elimina.

**S5 — Faltan límites de procesamiento (DoS)**
- [preview_document](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/documents.rs#L148-L160) recibe `Vec<u8>` como arreglo JSON: 16 MiB equivalen a unos 60 MB de JSON, y se deserializa antes de validar el tamaño.
- `save_memory` no limita la cantidad ni el tamaño de los registros.
- [FFmpeg](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/voice_input.rs#L65-L111) usa `wait_with_output()` sin timeout.
- PyMuPDF solo tiene timeout, sin límite de memoria.

**S6 — Binarios resueltos por PATH o por rutas de compilación**
- `Command::new("ffmpeg")` toma el primero que aparezca en PATH (secuestro de binario).
- Python se toma de `CARGO_MANIFEST_DIR/../.venv-adapters`, con `Users:F`, así que cualquier usuario podría reemplazarlo.
- `llama-server` está fijado a `D:/Alice-model-evaluation/...`.

**S7 — Las auditorías R3 no son a prueba de manipulación**
Son JSONL sin cadena de hashes ni firma. Combinado con S2, la evidencia puede reescribirse sin que se detecte.

**S8 — Percepción sin grant R2 en el backend**
`analyze_screen_frame` y `transcribe_voice_turn` procesan pantalla o audio que llega desde la webview sin exigir un lease R2 nativo. `perception.screen.observe` figura como planificada, pero el comando ya existe.

**S9 — El servidor de desarrollo Vite expone la raíz del proyecto**
La app solo corre con `tauri dev`. Vite sirve la raíz en `127.0.0.1:5173` y `data/` está dentro.
Es muy probable que cualquier proceso local pueda leer `/data/memory/records.json` mientras la app está abierta. **Hay que comprobarlo con curl**.

### 🟡 Baja

- **S10** — Copia de las sesiones sin cifrar en `localStorage` ([App.tsx:118](file:///e:/Alice%20Cognitive%20Core/src/App.tsx#L118-L120)), fuera del almacén gobernado.
- **S11** — [restore_memory_backup](file:///e:/Alice%20Cognitive%20Core/src-tauri/src/memory.rs#L7238-L7275) usa `fs::write` no atómico y no pasa por `validate_generic_memory_update`: puede revertir supresiones o decisiones. `save_memory` tampoco es atómico (usa `copy`, no `MoveFileEx`).
- **S12** — Ollama (11434) y llama-server (18089) en loopback no tienen autenticación. Otro proceso local puede usarlos o suplantarlos.
- **S13** — Las auditorías de voz y visión local se etiquetan `AuditSource::Cloud`, lo que es engañoso.

### Puntos fuertes (bien resueltos)
CSP estricta, `assetProtocol` acotado a 2 rutas, claves solo en variables de entorno del backend, `deny_unknown_fields` en las entradas, validación del ID de modelo (evita inyección en la URL de Google), HTTPS obligatorio para el proveedor compatible, bloqueo de modelos `:cloud` en Ollama, `.gitignore` correcto para `data/` y los activos privados, y 0 CVEs en npm.

## 3. Porcentaje de avance

| Métrica | Cálculo | Avance |
|---|---|---|
| Roadmap por criterios de aceptación | 44 / 58 | **≈ 76 %** |
| Roadmap por fases cerradas | 8 / 10 | 80 % |
| **Listo para uso personal seguro** | Roadmap menos la deuda de seguridad S1–S9 | **≈ 65 %** |
| Listo para distribución (R10) | Sin bundle, rutas fijas, seguridad pendiente | ≈ 15 % |

**Estimación global: ~70–76 %** del alcance planificado.
El núcleo cognitivo y de gobierno (R1–R8) está maduro y bien probado. Lo que falta es la presencia (R9), el endurecimiento de seguridad y la distribución (R10).

## 4. Prioridades recomendadas
1. S1: validar transiciones en `save_memory`, o retirarlo en favor de comandos gobernados.
2. S2/S7: ACL restringida a la cuenta del propietario sobre `data/` y cadena de hashes en R3.
3. S3: migrar la vista previa y confirmación de nube a Rust (copiar el patrón de `voice_output.rs`).
4. S5/S6: límites de tamaño, timeouts y rutas absolutas verificadas por hash.
5. S9: comprobar y bloquear `data/` en `server.fs.deny`, o mover `ALICE_DATA_DIR` fuera de la raíz de Vite.
