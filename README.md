# Alice Continuum

**Asistente personal de escritorio con conversación, memoria local y percepción por turnos.**
Alice es la identidad conversacional; Alice Continuum es la plataforma que la sostiene.

**Estado al 4 de noviembre de 2026:** prototipo funcional, R9 en progreso.
La versión del producto es **0.1.0** y el documento maestro **0.56**.
El repositorio se llama **`enri312/alice-continuum`** y conserva el historial del
proyecto anterior Alice Cognitive Core.

[Manual de uso](docs/MANUAL_DE_USO.md) · [Documento maestro HTML](docs/especificacion_alice_continuum.html) · [Roadmap](Roadmap.md) · [Documentación](docs/README.md)

## Qué funciona actualmente

| Área | Implementación y evidencia |
|---|---|
| Conversación | Gemma 4 E2B local mediante llama.cpp, con diálogo reciente y recuerdos recuperables. Los referentes ambiguos siguen en evaluación. |
| Voz por turnos | RNNoise reduce ruido, Whisper base CPU transcribe español, Gemma responde y Fish Audio sintetiza. Una acción inicia la sesión; no se confirma cada turno. |
| Parada y continuidad | «Detén la conversación, Alice» funciona durante escucha. Botón de parada en cualquier etapa, rechazo de respuestas tardías y respuesta en texto si falla la voz. |
| Memoria y RAG | Memoria confirmada y selección automática de citas útiles en almacenes separados. Se puede pausar, corregir y retirar del contexto; no se entrenan pesos por conversar. |
| Cámara y escritorio | Fuentes seleccionables en Conversación, procesadas por Gemma mientras están activas. Fotogramas efímeros; no identifica personas ni abre archivos cerrados. |
| Spotify y PC | Abrir Spotify y las raíces D:/E:, reproducir Tus me gusta, pausar y continuar. Spotify se comprobó desde Alice. YouTube en Chrome está implementado, con aceptación de reproducción real pendiente. |
| Núcleo observable | Nodos respaldados por recuerdos reales, procedencia y actividad técnica. Las formas cerebrales son ilustrativas. |
| Gobierno y diagnóstico | Registro de capacidades, permisos delimitados, auditoría local, tareas y habilidades separadas del diálogo. No hay control general del PC. |

El ciclo nativo de voz pasó **tres frases españolas, dos respuestas reproducidas y
parada directa**, usando audio sintético y datos aislados. Otra prueba rechazó una
respuesta posterior a detener la sesión sin agregar historial. La segunda voz
empezó a los **7,3 segundos del fin de grabación**; Fish ocupó unos 4,5 segundos.
Estos resultados no sustituyen la prueba con la voz de Carlos y música real.

Evidencia: [sesión y cancelación](docs/testing/CONVERSATION_SESSION_REPORT_2026-11-04.md),
[reducción de ruido](docs/testing/VOICE_NOISE_VITE_REPORT_2026-11-04.md),
[memoria automática](docs/testing/AUTOMATIC_MEMORY_VOLUME_REPORT_2026-11-03.md),
[visión](docs/testing/CONVERSATION_VISION_REPORT_2026-11-03.md) y
[música](docs/testing/MEDIA_VOICE_REGRESSION_REPORT_2026-11-03.md).

## Conversar con Alice

1. Abrir **Iniciar Alice Continuum.cmd** y entrar en **Conversación**.
2. Elegir el micrófono en **Audio de entrada** y pulsar **Iniciar conversación por voz**.
3. Hablar y dejar una pausa de un segundo. Alice procesa el turno, responde y vuelve a escuchar.
4. Si entendió algo mal, revisar **Último mensaje atendido**, que muestra el texto y las demoras de cada etapa.
5. Decir **«Detén la conversación, Alice»** mientras escucha, o pulsar **Detener conversación** en cualquier momento.

El micrófono está apagado durante procesamiento y reproducción. Todavía no hay
interrupción hablando mientras Alice responde ni activación dedicada por nombre.
**Sólo si digo Alice** es un filtro opcional de dirección del mensaje; no verifica
la identidad del hablante. El dictado manual con revisión sigue disponible.

[Procedimiento completo de voz y conversación](docs/runbooks/03-conversacion-y-voz.md).

## Instalar y arrancar

Entorno verificado en Windows con WebView2 y herramientas de compilación para Tauri:

| Componente | Versión verificada |
|---|---|
| Node.js / npm | 26.13.0 LTS / 11.20.0 |
| Rust / Cargo | 1.99.1, fijada en `rust-toolchain.toml` |
| Vite / Vitest | 8.3.5 / 4.1.12 |
| Interfaz y escritorio | React 19, TypeScript y Tauri 2 |

Desde la raíz del proyecto:

```powershell
npm ci
& '.\Iniciar Alice Continuum.cmd' --check
& '.\Iniciar Alice Continuum.cmd'
```

El lanzador valida el entorno, evita instancias duplicadas y usa el puerto fijo
5173. Mantiene los datos en `data/` mediante `ALICE_DATA_DIR` y comparte el caché
Rust `.cargo-target`. La instalación actual permanece en `E:\Alice Cognitive Core`.
Un clon nuevo requiere configurar las rutas de sus recursos locales.

Gemma y su proyector multimodal se instalan fuera de Git. La configuración de
esta notebook usa llama.cpp y modelos bajo `D:\Alice-model-evaluation`; no se
incluyen los pesos ni se descargan automáticamente al abrir Alice.

Para reproducir la instalación de Whisper base multilingüe en la ruta prevista:

```powershell
& '.\scripts\testing\install-whisper-local.ps1'
```

El instalador fija fuentes oficiales y hashes. Whisper se ejecuta en CPU con
cuatro hilos y procesa audio por tuberías en RAM. Si falta su instalación,
permanece la transcripción Gemma anterior; si Whisper instalado falla, el error
se informa. FFmpeg se requiere para convertir la toma local.

Fish Audio usa `FISH_API_KEY` y `ALICE_FISH_REFERENCE_ID` en el entorno del proceso
nativo. Las respuestas autorizadas salen al proveedor para obtener su voz; el
perfil existente conserva `s2.1-pro-free`. Los valores de las credenciales no se
escriben en archivos del proyecto. Los proveedores alternativos se documentan
en el manual; OpenRouter permanece pausado por decisión del propietario.

[Arranque y recuperación](docs/runbooks/01-arranque-local.md) · [Identidad y compatibilidad](docs/architecture/CONTINUUM_IDENTITY.md)

## Verificación

Última validación local, **4 de noviembre de 2026**:

- **557 pruebas frontend aprobadas**, 2 sondas opcionales omitidas.
- **321 pruebas Rust aprobadas**, 27 sondas opcionales omitidas.
- Compilaciones frontend y nativa, formato y Clippy aprobados.
- HTML v0.56 revisado, con portada primero y enlaces locales comprobados.

```powershell
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo build --manifest-path src-tauri/Cargo.toml
```

Son resultados locales documentados, no un workflow de CI remoto. Vite conserva
un aviso de tamaño de paquetes de más de 500 kB. Las pruebas de hardware, servicios
y voz real se ejecutan por separado y no se dan por aprobadas por las unitarias.

## Estructura del proyecto

```text
src/pages/             pantallas de conversación, memoria, núcleo y gobierno
src/components/        componentes, controles de voz y visualizaciones
src/core/              contratos, recuperación y procesamiento de audio
src-tauri/src/         memoria, modelos, permisos y adaptadores nativos
icons/                 recursos SVG editables
public/licenses/       avisos de RNNoise y Whisper
scripts/testing/       pilotos y evaluación reproducible
docs/                  manual, arquitectura, decisiones e informes
```

[Mapa de módulos](docs/architecture/PROJECT_STRUCTURE.md) · [Decisiones ADR](docs/decisions/README.md) · [Contexto recuperado](docs/CONTEXTO_RECUPERADO_2026-11-03.md)

## Datos, límites y próximos pasos

Los recuerdos, auditorías, grabaciones de prueba, capturas, claves, modelos y
activos privados del avatar permanecen fuera de Git. `data/README.md` explica el
almacenamiento; las pruebas utilizan raíces separadas de los datos personales.
Las licencias de terceros se conservan en `public/licenses/`.

R9 sigue abierta: falta aceptación de conversación con la voz del propietario y
música de notebook y otros equipos, menor demora de síntesis, mejores referentes
ambiguos, activación por nombre e interrupción con control de eco. La memoria no
es una simulación biológica ni representa conciencia. Los hallazgos de seguridad
pendientes se conservan en los informes; no se anuncia una distribución endurecida.

La prioridad es conversación y acciones de PC acotadas. **Domótica queda fuera
de este tramo y el avatar va al final**. Atlas y Nerumi son referencias para
ordenar esa evolución, no funciones ya verificadas de Alice.

Repositorio privado: [enri312/alice-continuum](https://github.com/enri312/alice-continuum) · Rama: `master`.
