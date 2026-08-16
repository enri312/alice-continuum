# Contrato e inventario del Registro de Capacidades R1

Estado: implementado y validado con aplicación y archivos reales  
Versión del contrato: 1  
Fecha: 2026-08-08  
Propietario: Carlos Nuñez

## Objetivo

El Registro de Capacidades será la fuente de verdad sobre lo que Alice puede observar, consultar, modificar, transmitir o representar realmente. Su primera versión describe capacidades y estados; no concede permisos nuevos ni ejecuta acciones.

R1 reemplazará las listas estáticas del tablero por un inventario producido en Rust. La interfaz podrá ordenar, filtrar e inspeccionar ese inventario, pero no declarará por sí misma que una capacidad está disponible.

## Alcance de R1

R1 incluye:

- contrato tipado y versionado;
- inventario de capacidades implementadas y puentes planificados;
- estado derivado sin efectos secundarios;
- requisitos, riesgo, datos tratados y efectos posibles;
- salud y motivo comprensibles;
- una única consulta Tauri de solo lectura;
- representación honesta en Puentes.

R1 no incluye:

- autorizar o ejecutar una capacidad desde el registro;
- shell, PowerShell, control administrativo o acceso genérico al sistema;
- persistencia de permisos;
- instalación o ejecución de habilidades;
- telemetría, fechas o actividad inventadas;
- un servicio del kernel o un controlador de Windows.

## Fuente de verdad y flujo

```text
Adaptadores Rust existentes
  cloud · memory · observation · avatar
                  |
                  v
       capabilities.rs (solo lectura)
                  |
                  v
     capability_registry_status
                  |
                  v
       React / pantalla Puentes
```

`capabilities.rs` derivará cada estado mediante sondas específicas que no deben llamar a comandos con efectos secundarios. En particular, consultar el registro no podrá crear carpetas, migrar memoria, abrir Explorer, cargar el VRM completo ni realizar solicitudes de red.

## Contrato lógico v1

El backend expondrá un `CapabilityRegistrySnapshot` serializado en `camelCase`:

```text
CapabilityRegistrySnapshot
├── schemaVersion: 1
├── generatedAt: fecha ISO-8601
└── capabilities: CapabilityDescriptor[]
```

Cada `CapabilityDescriptor` tendrá:

| Campo | Tipo | Regla |
|---|---|---|
| `id` | cadena | Identificador estable en minúsculas con segmentos separados por punto. |
| `version` | entero | Versión del contrato particular de la capacidad; empieza en 1. |
| `label` | cadena | Nombre breve y comprensible en español. |
| `description` | cadena | Explica el resultado real sin prometer autonomía. |
| `domain` | enumeración | `cloud`, `context`, `perception`, `memory`, `avatar` u `output`. |
| `kind` | enumeración | `observation`, `query`, `mutation`, `export`, `process` o `presentation`. |
| `maturity` | enumeración | `implemented`, `partial` o `planned`. |
| `adapter` | cadena | Módulo responsable; `none` si todavía no existe. |
| `operations` | lista | Operaciones concretas cubiertas por la capacidad. |
| `state` | enumeración | Estado operativo calculado según las reglas siguientes. |
| `risk` | enumeración | `none`, `low`, `medium`, `high` o `critical`. |
| `effects` | lista | Efectos posibles declarados, aunque no estén ocurriendo ahora. |
| `dataScopes` | lista | Clases de datos que puede leer, escribir o transmitir. |
| `requirements` | lista | Requisitos públicos; nunca contiene valores de claves. |
| `permission` | objeto | Describe el control vigente y dónde se aplica. R1 no lo reemplaza. |
| `health` | objeto | Resultado de una sonda local sin efectos secundarios. |
| `lastExecution` | objeto o `null` | Permanecerá `null` hasta que R3 aporte auditoría correlacionada. |

### Estado operativo

`state` utiliza una sola de estas opciones:

| Estado | Significado |
|---|---|
| `unavailable` | Falta un requisito o no existe adaptador. |
| `disabled` | El adaptador existe, pero una opción visible lo mantiene apagado. |
| `idle` | Está disponible y no existe una operación en curso. |
| `active` | Está observando o ejecutando una operación comprobable. |
| `degraded` | Funciona parcialmente y el motivo se informa. |
| `error` | Una comprobación real falló. |

`available` no será un estado independiente: una capacidad implementada y disponible, pero inactiva, se representa como `idle`. Esto evita confundir disponibilidad con actividad.

Una capacidad `planned` siempre tendrá `state: unavailable`, `adapter: none` y una explicación explícita. Nunca podrá emitir métricas de paquetes, latencia o última ejecución.

### Salud

`health` contendrá:

| Campo | Valores |
|---|---|
| `status` | `unchecked`, `healthy`, `degraded`, `unavailable` o `error` |
| `summary` | Explicación breve y no sensible |
| `checkedAt` | Fecha ISO-8601 o `null` si no se ejecutó una sonda |

Una sonda solo puede inspeccionar configuración o metadatos mínimos. No puede enviar una consulta de prueba a un proveedor, escribir un archivo de prueba dentro de la memoria privada ni cargar un dispositivo para aparentar conectividad.

### Permiso descriptivo de R1

`permission` tendrá:

| Campo | Uso |
|---|---|
| `mode` | `implicitRead`, `sessionOptIn`, `explicitPreview` o `explicitConfirmation` |
| `enforcedBy` | `native`, `currentUi`, `operatingSystem` o `none` |
| `summary` | Explicación del control vigente |

Este objeto describe la realidad actual. No debe afirmar `native` cuando una confirmación vive únicamente en React. R2 será responsable de convertir estas descripciones en políticas nativas centralizadas.

### Efectos declarables

R1 limita `effects` a este catálogo:

- `none`;
- `localRead`;
- `localWrite`;
- `networkSend`;
- `processLaunch`;
- `windowMetadataRead`;
- `credentialPresenceRead`;
- `assetRender`.

Las claves se usan internamente cuando corresponde, pero nunca se devuelven como `dataScopes`, requisitos o diagnósticos.

## Inventario comprobado

### Capacidades implementadas o parciales

| ID estable | Función real actual | Implementación | Madurez | Riesgo | Control vigente | Observación para R1 |
|---|---|---|---|---|---|---|
| `cloud.providers.inspect` | Indica qué proveedores tienen configuración y su modelo inicial. | `cloud_status` | Implementada | Bajo | Lectura implícita; Rust no devuelve claves. | Estado `idle`; solo expone presencia de configuración. |
| `cloud.conversation.send` | Envía el contexto previsualizado al proveedor elegido y audita metadatos. | `send_cloud_message` | Implementada | Medio | Previsualización y confirmación en React. | `idle` si existe proveedor configurado; `unavailable` en caso contrario. La puerta todavía no es nativa. |
| `memory.working.manage` | Conserva hasta tres intercambios reales en RAM, permite consultarlos y vaciarlos. | `working_memory_status`, registro posterior a `send_cloud_message` y `clear_working_memory` | Implementada | Bajo | Envío autorizado; Memoria confirma y Rust exige la generación exacta para vaciar. | No persiste texto; expira a los 30 minutos o al cerrar Alice. Estado, TTL y vaciado son visibles. |
| `context.foreground.control` | Activa o detiene la observación de título y proceso de la ventana externa actual. | `execute_context_observation_grant` | Implementada | Medio | Grant R2 específico consumido en Rust; `enforcedBy: native`. | Empieza `disabled`; pasa a `active` solo con un grant de sesión vigente. |
| `context.foreground.read` | Devuelve el último título y proceso observados si el control está encendido. | `get_foreground_context` | Implementada | Medio | Depende del opt-in de sesión. | No registra teclas, pantalla ni contenido de archivos. |
| `memory.records.read` | Lee y valida los registros locales. | `load_memory` | Parcial | Medio | Arranque de la aplicación. | El comando actual también crea estructura y puede migrar; la sonda R1 no debe invocarlo. |
| `memory.records.write` | Crea, edita o elimina registros mediante sustitución validada y respaldo. | `save_memory` | Implementada | Medio | Acciones visibles; eliminar confirma en React. | Agrupa varias mutaciones; R2 podrá separarlas si necesitan permisos distintos. |
| `memory.records.export` | Copia la memoria validada a `memory/exports`. | `export_memory` | Implementada | Bajo | Acción explícita en React. | Produce escritura local y auditoría. |
| `memory.records.restore` | Restaura el respaldo y protege primero el estado desplazado. | `restore_memory_backup` | Implementada | Alto | Confirmación en React. | Reversible, pero sustituye la fuente de verdad vigente. |
| `memory.directory.open` | Inicia Explorer en la carpeta privada de memoria. | `open_memory_directory` | Implementada | Bajo | Acción explícita en React. | Declara `processLaunch`; no equivale a acceso genérico a procesos. |
| `memory.retrieval.lexical` | Busca hasta tres recuerdos relacionados sin usar red. | `retrieveMemories` | Implementada | Bajo | Lectura local al escribir una consulta. | Se ejecuta en TypeScript; solo el envío posterior puede sacar el resultado del equipo. |
| `avatar.vrm.inspect` | Comprueba ruta, extensión, existencia y tamaño del VRM. | `avatar_status` | Implementada | Bajo | Lectura implícita al abrir Avatar. | La sonda no carga el modelo ni modifica el archivo. |
| `avatar.vrm.render` | Carga y presenta el VRM privado en el visor local. | `AvatarViewer` | Implementada | Bajo | Abrir la pestaña Avatar. | `idle` con archivo válido y `unavailable` sin él; renderizar no conecta rostro ni cuerpo. |
| `perception.camera.observe` | Abre la cámara integrada durante un lease visible y descarta fotogramas. | `execute_sensor_lease_grant` + `sensory.rs` | Parcial | Alto | Grant R2 de sesión; `enforcedBy: native`. | OpenCV/DirectShow local; `idle` o `active`; análisis y memoria desconectados. |
| `perception.microphone.observe` | Abre el arreglo Intel durante un lease visible y descarta muestras. | `execute_sensor_lease_grant` + `sensory.rs` | Parcial | Alto | Grant R2 de sesión; `enforcedBy: native`. | PortAudio/WASAPI local; `idle` o `active`; transcripción y memoria desconectadas. |

### Entradas sensoriales planificadas, sin adaptador

| ID estable | Representación futura | Estado obligatorio en R1 |
|---|---|---|
| `perception.screen.observe` | Analizar fotogramas efímeros de una pantalla elegida. | `planned` + `unavailable` |
| `perception.media.inspect` | Consultar metadatos del reproductor actual. | `planned` + `unavailable` |
| `perception.desktop.observe` | Recibir eventos accesibles de interfaz sin registrar teclas. | `planned` + `unavailable` |
| `perception.face.landmarks` | Derivar landmarks y blendshapes faciales efímeros desde una cámara autorizada. | `planned` + `unavailable` |

Estas cuatro entradas anticipan la arquitectura aceptada en ADR-P-043. R1 solo las declara: no abre dispositivos, no comprueba permisos y no ejecuta modelos. `perception.face.landmarks` sustituyó al agrupado `perception.gesture.derive` para no mezclar rostro, manos y pose; cada fuente futura tendrá su capacidad independiente. Cámara y micrófono ya figuran arriba como parciales porque poseen adaptador y Gateway nativo comprobados.

### Puentes planificados, sin adaptador

| ID estable | Representación futura | Estado obligatorio en R1 |
|---|---|---|
| `output.text.external` | Entregar texto a otra aplicación. | `planned` + `unavailable` |
| `output.voice.synthesize` | Convertir una respuesta autorizada en audio. | `planned` + `unavailable` |
| `output.avatar.face` | Controlar expresiones y habla del avatar. | `planned` + `unavailable` |
| `output.avatar.gaze` | Orientar ojos o mirada. | `planned` + `unavailable` |
| `output.avatar.body` | Entregar poses o acciones corporales. | `planned` + `unavailable` |
| `output.external.adapter` | Conectar VRChat u otro destino revisado. | `planned` + `unavailable` |

Fish Audio, captura de pantalla, Mocap y Active Ragdoll no se registran como implementados. Cámara y micrófono son parciales: verifican señal efímera, pero no ejecutan percepción semántica, transcripción, aprendizaje ni control del avatar.

## Funciones internas fuera del registro

No todo componente visual es una capacidad gobernable. R1 excluye:

- navegación entre pestañas;
- cámara gráfica del volumen neuronal;
- derivación visual de `BrainSnapshot`;
- línea temporal temporal de React;
- filtros, búsquedas visuales y tooltips;
- animaciones puramente decorativas.

Si una de estas funciones comienza a observar datos nuevos, persistir información o provocar efectos externos, deberá ingresar al registro.

## Invariantes de validación

1. No pueden existir identificadores repetidos.
2. `schemaVersion` y todas las versiones de capacidad son enteros positivos.
3. Una capacidad `planned` no puede declarar adaptador, estado activo ni última ejecución.
4. `lastExecution` es `null` cuando no existe evidencia correlacionada.
5. Un estado `active` requiere una señal de ejecución real y actual.
6. `critical` no puede usarse para dramatizar una capacidad; requiere una amenaza documentada.
7. Una sonda de salud no escribe, migra, lanza procesos ni usa la red.
8. Ningún campo contiene secretos, valores completos de contexto o rutas no necesarias.
9. React puede traducir etiquetas visuales, pero no cambiar riesgo, madurez, efectos ni estado.
10. Un identificador publicado no cambia de significado; una ruptura exige nueva versión o nuevo ID.

## Diferencias resueltas entre el tablero y la realidad

- `Puentes.tsx` consume ahora las 25 capacidades del snapshot nativo y las agrupa por dominio.
- Los contadores se calculan desde estado y madurez reales; no existe un total fijado en React.
- La pestaña Actividad conserva eventos únicamente durante la sesión; no sustituye las auditorías JSONL.
- La observación de ventana ya usa `enforcedBy: native`. Las confirmaciones de envío, restauración y borrado aún se realizan en React y permanecen `currentUi` hasta su migración individual.
- `load_memory` mezcla lectura, inicialización y migración; la sonda R1 inspecciona rutas mediante un helper pasivo que no crea archivos.
- El fallback web está marcado como `webDevelopment` y presenta un registro vacío, sin simular disponibilidad nativa.

## Resultado implementado

R1 añadió el módulo Rust `capabilities.rs` y el comando Tauri `capability_registry_status`. Capacidades y Puentes consume su snapshot en escritorio y muestra un estado explícito de desarrollo en navegador. Ningún comando anterior cambió de nombre o comportamiento durante esta fase.

El plan de implementación y migración está en `docs/plans/R1-capability-registry.md` y la decisión adoptada en `docs/decisions/ADR-P-041-registro-de-capacidades.md`.
