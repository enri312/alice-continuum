# Alice Cognitive Core

![Estado](https://img.shields.io/badge/estado-prototipo%20funcional-0ea5e9?style=flat-square)
![R1](https://img.shields.io/badge/R1-validado-16a34a?style=flat-square)
![R2](https://img.shields.io/badge/R2-alcance%20inicial%20validado-16a34a?style=flat-square)
![R3](https://img.shields.io/badge/R3-en%20curso-f59e0b?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-68%2F68%20pruebas-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-88%2F88%20pruebas-b7410e?style=flat-square&logo=rust&logoColor=white)
![Hardware](https://img.shields.io/badge/hardware-CAM%20%2B%20MIC%20vivos-0f766e?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react&logoColor=white)
![Windows](https://img.shields.io/badge/plataforma-Windows-0078d4?style=flat-square&logo=windows11&logoColor=white)
![Privacidad](https://img.shields.io/badge/datos-local--first-0f766e?style=flat-square)
![Repositorio](https://img.shields.io/badge/repositorio-privado-6b7280?style=flat-square&logo=github&logoColor=white)

Aplicación de escritorio local-first para que **Alice** gestione conversación, memoria, percepción autorizada, estado cognitivo observable y futuras señales de rostro y cuerpo bajo control de Carlos Nuñez.

El nombre técnico del sistema es **Alice Cognitive Core**. La interfaz organiza dos espacios:

- `ALICE_NEURAL_CORE // COGNITIVE IDENTIFICATION`: conversación, núcleo, identificación, memoria, actividad y configuración.
- `ALICE_NEURAL_CORE // BODY SOLVER`: registro de capacidades, rostro, cuerpo y avatar.

> Los badges de pruebas reflejan la validación local real del 09 de agosto de 2026. No representan un workflow de CI remoto; este repositorio privado todavía no contiene uno.

## Estado verificado

| Área | Estado real |
|---|---|
| Registro de capacidades R1 | Validado: snapshot nativo v1 con 24 capacidades |
| Gateway de permisos R2 | Alcance inicial validado: ventana, cámara y micrófono protegidos por grants nativos |
| Auditoría unificada R3 | En curso: base v1 y Gateway R2 correlacionado implementados |
| Capacidades implementadas o parciales | 14 |
| Capacidades planificadas | 10, sin adaptador y no disponibles |
| Pruebas TypeScript | 68/68 aprobadas |
| Pruebas Rust | 88/88 normales; prueba viva CAM+MIC aprobada explícitamente |
| Builds | Frontend y ejecutable Tauri aprobados |
| Prueba viva de ventana | Win32 devolvió metadatos reales del primer plano; el contenido no se imprimió ni persistió |
| Prueba viva sensorial | Cámara y micrófono entregaron señal real mediante leases separados; 107 archivos multimedia antes y después, delta 0 |
| Memoria real | Nueve archivos preservados durante consultas repetidas del registro |
| Avatar privado | Preservado y excluido de Git |

La evidencia completa está en [el informe de validación R1](docs/testing/R1_CAPABILITY_REGISTRY_REPORT_2026-08-09.md).

## Límites actuales

- Nada se envía a Internet sin una previsualización y autorización visibles.
- Alice no ejecuta PowerShell, comandos libres ni herramientas remotas.
- React no recibe ni muestra claves de proveedores.
- Una respuesta de nube no se convierte automáticamente en recuerdo o verdad.
- La observación vigente se limita a metadatos autorizados de la ventana activa; no registra teclas, archivos ni imágenes.
- Cámara y micrófono son capacidades parciales con leases R2 de 60 segundos; pantalla, reproductores, acciones accesibles y gestos siguen planificados.
- Voz, rostro, mirada, cuerpo y adaptadores externos permanecen desconectados.
- R1 describe capacidades; no concede permisos nuevos ni ejecuta las capacidades desde el registro.
- R2 consume grants efímeros para ventana, cámara o micrófono. Aprobar no abre hardware: cada sensor exige una activación posterior y ofrece Detener inmediato.
- El envío a la nube todavía usa previsualización y confirmación en React; R1 lo declara `enforcedBy: currentUi` hasta una migración nativa futura.

## Pantallas

| Pantalla | Responsabilidad |
|---|---|
| Conversación | Redactar, previsualizar contexto y enviar al proveedor autorizado |
| Núcleo | Volumen neuronal, flujo cognitivo, estado interno, planificador y línea temporal |
| Identificación | Analizar entrada diagnóstica, tokens, intención e hipótesis explicables |
| Memoria | Recuerdos, aprendizaje planificado, enseñanza, repaso y respaldo |
| Actividad | Eventos de sesión y auditoría R3 persistente de metadatos reales |
| Configuración | Proveedor, modelo, privacidad y estado de dispositivos externos |
| Capacidades y puentes | Snapshot nativo agrupado por Nube, Contexto, Percepción, Memoria, Avatar y Salidas |
| Avatar | Visor privado del VRM con pose relajada predeterminada y pose de referencia opcional |

## Cámara, micrófono y aprendizaje sensorial

Carlos Nuñez autorizó las pruebas con la cámara y el micrófono integrados. Alice ya prepara una previsualización específica, crea un grant separado por dispositivo y solo abre el hardware después de pulsar **Activar**. El indicador permanece visible y **Detener**, revocar, vencer o cerrar la aplicación finaliza el lease.

Comprobación real de hardware del 09 de agosto de 2026:

| Dispositivo | Resultado |
|---|---|
| `ACER HD User Facing` | 12 fotogramas recibidos mediante DirectShow, 640×480, sin guardar imágenes |
| `Microphone Array (Intel Smart Sound Technology)` | 77.175 muestras recibidas, 44.100 Hz, 1,75 s, señal RMS real y sin guardar audio |

El incremento R2 volvió a abrir ambos dispositivos mediante la ruta gobernada real: la prueba exigió señal positiva, detuvo cada lease y confirmó `MEDIA_DELTA=0` sobre 107 archivos. Las capacidades `perception.camera.observe` y `perception.microphone.observe` son ahora `partial`, usan `enforcedBy: native` y aparecen `idle` o `active` según el proceso real. Todavía no analizan, transcriben ni crean recuerdos.

La voz del avatar se evaluará posteriormente mediante la API de **Fish Audio** que posee Carlos Nuñez. Todavía no se agrega dependencia, adaptador, variable ni clave. La credencial nunca deberá escribirse en este README, el repositorio, React, la memoria o una auditoría.

Más detalles en [el informe inicial de hardware](docs/testing/HARDWARE_INPUT_READINESS_REPORT_2026-08-09.md), [el informe de leases R2](docs/testing/R2_SENSOR_LEASE_REPORT_2026-08-09.md) y [ADR-P-043](docs/decisions/ADR-P-043-aprendizaje-sensorial-gobernado.md).

## Control de contexto de conversación

El panel lateral de Conversación es la última revisión antes de una solicitud de nube:

- historial, recuerdos y ventana comienzan desmarcados;
- observar una ventana localmente no implica enviarla;
- cámara, micrófono, fotogramas y audio no son fuentes elegibles;
- `Recordar localmente` empieza desactivado y no controla qué sale a Internet;
- proveedor y modelo se muestran como destino de solo lectura y solo se cambian en Configuración;
- el botón de ventana abre el Gateway R2: no activa ni detiene directamente.

El informe completo del alcance inicial está en [R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md](docs/testing/R2_PERMISSION_GATEWAY_REPORT_2026-08-09.md).

## Auditoría unificada R3

Los dos primeros incrementos de R3 incorporan un sobre nativo v1 cerrado y conectan el Gateway R2 como productor correlacionado. Solicitud, autorización, ejecución, detención, revocación, bloqueo, error y vencimiento comparten un `operationId`; no existen propiedades para mensajes, imágenes, audio, parámetros o claves.

La auditoría vive en `data/audit/events-v1.jsonl`, limita el archivo actual a 5 MiB y conserva una sola rotación anterior. Si no puede escribirse el inicio de una capacidad sensible, el adaptador se detiene y el grant se revoca; detener o revocar nunca se deshace por un fallo de telemetría. Memoria y nube todavía deben migrarse antes de cerrar R3.

Consulta el [contrato R3](docs/architecture/UNIFIED_AUDIT_R3.md), [ADR-P-045](docs/decisions/ADR-P-045-auditoria-unificada-local.md), el [plan incremental](docs/plans/R3-unified-audit.md), el [informe de la base](docs/testing/R3_AUDIT_FOUNDATION_REPORT_2026-08-09.md) y el [informe del Gateway correlacionado](docs/testing/R3_PERMISSION_AUDIT_REPORT_2026-08-09.md).

## Matriz cognitivo-afectiva

El volumen neuronal distingue estructura aprendida de actividad actual: solo aparecen los nodos respaldados por recuerdos o señales comprobables, mientras que el brillo y el pulso quedan reservados para actividad temporal. Con pocos recuerdos la red permanece pequeña; la nube densa es una meta de crecimiento para cientos o miles de registros y asociaciones auditables.

La paleta futura incluye Alegría amarilla, Tristeza azul, Ira roja, Temor violeta, Desagrado verde, Ansiedad naranja, Envidia turquesa, Aburrimiento índigo, Vergüenza rosa y Nostalgia gris rosado. Los diez valores siguen en `0.00` y `planned`; todavía no existe simulación emocional. Consulta el [diseño afectivo](docs/architecture/AFFECTIVE_SIMULATION_DESIGN.md), [ADR-P-046](docs/decisions/ADR-P-046-paleta-afectiva-y-volumen-cognitivo.md) y el [informe visual](docs/testing/AFFECTIVE_VOLUME_VISUAL_REPORT_2026-08-09.md).

## Iniciar Alice

Hacer doble clic en [`Iniciar Alice.cmd`](Iniciar%20Alice.cmd). La terminal debe permanecer abierta mientras se usa la aplicación.

Inicio equivalente desde PowerShell:

```powershell
npm run tauri dev
```

Primera instalación:

```powershell
npm install
npm run tauri dev
```

La carpeta local canónica es `E:\Alice Cognitive Core`. `E:\Proyecto P` sigue siendo un respaldo temporal y no debe borrarse hasta completar su copia al disco externo.

## Proveedores de conversación

La selección de proveedor y modelo vive en **Configuración**, no en la portada de Conversación.

| Proveedor | Variable requerida | Modelo opcional |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| Google | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| xAI | `XAI_API_KEY` | `XAI_MODEL` |
| Compatible con Chat Completions | `ALICE_COMPATIBLE_API_KEY` y `ALICE_COMPATIBLE_BASE_URL` | `ALICE_COMPATIBLE_MODEL` |

Las variables se configuran en el perfil de Windows y requieren reiniciar Alice. La URL compatible debe usar HTTPS. Las llamadas no habilitan herramientas y limitan la salida a 1200 tokens; las políticas del proveedor siguen siendo aplicables.

## Datos locales

`Iniciar Alice.cmd` establece `ALICE_DATA_DIR` en `E:\Alice Cognitive Core\data`. El contenido está excluido de Git.

```text
data/
├── audit/
│   ├── events-v1.jsonl
│   └── events-v1.previous.jsonl
├── cloud/cloud-audit.jsonl
└── memory/
    ├── manifest.json
    ├── records.json
    ├── audit/
    ├── backups/
    ├── exports/
    ├── attachments/
    └── indexes/
```

La memoria es visible, editable, exportable y respaldable. Las auditorías conservan metadatos y huellas SHA-256, no claves ni el texto completo de las conversaciones. El diseño está en [MEMORY_SYSTEM.md](docs/architecture/MEMORY_SYSTEM.md).

## Arquitectura

```text
src/
├── Page/                 pantallas React
├── components/           paneles, iconos y visualizaciones
└── core/                 contratos R1/R2 y lógica TypeScript comprobable

src-tauri/src/
├── audit.rs              esquema, persistencia acotada y lectura R3
├── capabilities.rs       registro R1 y sondas pasivas
├── cloud.rs              proveedores y solicitudes autorizadas
├── memory.rs             persistencia, respaldo y auditoría
├── observation.rs        metadatos autorizados de ventana
├── avatar.rs             validación pasiva del VRM
├── permissions.rs        tipos, validaciones y digest del Gateway R2
├── permissions/
│   └── gateway.rs        almacén efímero y máquina de estados R2
├── sensory.rs            leases CAM/MIC y adaptador local de señal efímera
├── util.rs               rutas y utilidades compartidas
└── lib.rs                estado y registro de comandos Tauri
```

Los contratos vigentes son [CAPABILITY_REGISTRY_R1.md](docs/architecture/CAPABILITY_REGISTRY_R1.md), [PERMISSION_GATEWAY_R2.md](docs/architecture/PERMISSION_GATEWAY_R2.md) y [UNIFIED_AUDIT_R3.md](docs/architecture/UNIFIED_AUDIT_R3.md). El [Roadmap](Roadmap.md) gobierna el orden R1–R10 y el [documento maestro](docs/alice_documento_maestro.html) conserva la especificación completa.

## Pruebas

```powershell
npm test
npm run build
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
cargo test --manifest-path src-tauri\Cargo.toml
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo build --manifest-path src-tauri\Cargo.toml
```

Las pruebas del registro verifican serialización, esquema, IDs únicos, estados planificados, salud, idempotencia y rechazo de datos mal formados. Las pruebas operativas deben usar dispositivos y archivos reales cuando corresponda, sin fabricar métricas en la interfaz y sin conservar contenido sensorial crudo por defecto.

## Repositorio y continuidad

- Repositorio canónico privado: `enri312/alice-cognitive-core`.
- Rama vigente: `master`.
- El avatar privado y `data/` no se versionan.
- No se deben publicar claves, recuerdos, grabaciones ni capturas privadas.
- El checkpoint de R1 y de la interfaz acumulada fue creado después de revisar secretos, archivos privados y resultados de prueba.

La regla operativa continúa siendo: **mostrar qué se desea observar o hacer, obtener autorización específica y revocable, y solo entonces ejecutar**.
