use crate::avatar::{avatar_capability_probe, AvatarCapabilityProbe};
use crate::cloud::{cloud_capability_probe, CloudCapabilityProbe};
use crate::memory::{memory_capability_probe, MemoryCapabilityProbe, MemoryResourceState};
use crate::observation::{ObservationCapabilityProbe, ObservationStore};
use crate::sensory::{SensorCapabilityProbe, SensorLeaseStore};
use crate::tasks::{task_capability_probe, TaskCapabilityProbe, TaskRegistryState};
use crate::util::alice_data_root_path;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

pub(crate) const CAPABILITY_REGISTRY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityRegistrySnapshot {
    pub(crate) schema_version: u32,
    pub(crate) generated_at: String,
    pub(crate) capabilities: Vec<CapabilityDescriptor>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityDescriptor {
    pub(crate) id: String,
    pub(crate) version: u32,
    pub(crate) label: String,
    pub(crate) description: String,
    pub(crate) domain: CapabilityDomain,
    pub(crate) kind: CapabilityKind,
    pub(crate) maturity: CapabilityMaturity,
    pub(crate) adapter: String,
    pub(crate) operations: Vec<String>,
    pub(crate) state: CapabilityState,
    pub(crate) risk: CapabilityRisk,
    pub(crate) effects: Vec<CapabilityEffect>,
    pub(crate) data_scopes: Vec<String>,
    pub(crate) requirements: Vec<String>,
    pub(crate) permission: CapabilityPermission,
    pub(crate) health: CapabilityHealth,
    pub(crate) last_execution: Option<CapabilityLastExecution>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityPermission {
    pub(crate) mode: CapabilityPermissionMode,
    pub(crate) enforced_by: CapabilityPermissionEnforcer,
    pub(crate) summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CapabilityHealth {
    pub(crate) status: CapabilityHealthStatus,
    pub(crate) summary: String,
    pub(crate) checked_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) enum CapabilityLastExecution {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityDomain {
    Cloud,
    Context,
    Perception,
    Memory,
    Avatar,
    Task,
    Output,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityKind {
    Observation,
    Query,
    Mutation,
    Export,
    Process,
    Presentation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityMaturity {
    Implemented,
    Partial,
    Planned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityState {
    Unavailable,
    Disabled,
    Idle,
    Active,
    Degraded,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityRisk {
    None,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityEffect {
    None,
    LocalRead,
    LocalWrite,
    NetworkSend,
    ProcessLaunch,
    WindowMetadataRead,
    CredentialPresenceRead,
    AssetRender,
    CameraObserve,
    MicrophoneObserve,
    ScreenObserve,
    UserNotification,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityHealthStatus {
    Unchecked,
    Healthy,
    Degraded,
    Unavailable,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityPermissionMode {
    ImplicitRead,
    SessionOptIn,
    ExplicitPreview,
    ExplicitConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum CapabilityPermissionEnforcer {
    Native,
    CurrentUi,
    OperatingSystem,
    None,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct CapabilityProbeSnapshot {
    pub(crate) gemma_installed: bool,
    pub(crate) document_available: bool,
    pub(crate) cloud: CloudCapabilityProbe,
    pub(crate) observation: Result<ObservationCapabilityProbe, String>,
    pub(crate) memory: MemoryCapabilityProbe,
    pub(crate) avatar: Result<AvatarCapabilityProbe, String>,
    pub(crate) sensory: Result<SensorCapabilityProbe, String>,
    pub(crate) tasks: TaskCapabilityProbe,
}

impl CapabilityProbeSnapshot {
    pub(crate) fn collect(
        data_root: &Path,
        observation_store: &ObservationStore,
        sensor_store: &SensorLeaseStore,
    ) -> Self {
        Self {
            gemma_installed: crate::local_inference::installed(),
            document_available: crate::documents::available(),
            cloud: cloud_capability_probe(),
            observation: observation_store.capability_probe(),
            memory: memory_capability_probe(data_root),
            avatar: avatar_capability_probe(),
            sensory: sensor_store.capability_probe(),
            tasks: task_capability_probe(data_root),
        }
    }
}

pub(crate) fn capability_registry_from_probes(
    generated_at: String,
    probes: &CapabilityProbeSnapshot,
) -> Result<CapabilityRegistrySnapshot, String> {
    let mut capabilities = Vec::with_capacity(42);
    let document_available = probes.document_available;
    capabilities.push(capability(
        "memory.document.preview",
        "Leer documento seleccionado",
        "Extrae texto local de PDF, MD y TXT; no guarda recuerdos ni consulta modelos.",
        CapabilityDomain::Memory,
        CapabilityKind::Query,
        CapabilityMaturity::Implemented,
        "document-reader",
        &["preview_document"],
        if document_available {
            CapabilityState::Idle
        } else {
            CapabilityState::Unavailable
        },
        CapabilityRisk::Low,
        &[
            CapabilityEffect::LocalRead,
            CapabilityEffect::LocalWrite,
            CapabilityEffect::ProcessLaunch,
        ],
        &["selectedDocument", "auditMetadata"],
        &["Entorno local/venv con PyMuPDF"],
        permission(
            CapabilityPermissionMode::ExplicitPreview,
            CapabilityPermissionEnforcer::CurrentUi,
            "Selección y botón visibles; backend valida formato y límites. Sólo metadatos en R3.",
        ),
        health(
            if document_available {
                CapabilityHealthStatus::Unchecked
            } else {
                CapabilityHealthStatus::Unavailable
            },
            "Se verifica la presencia del entorno; la extracción comprueba sus dependencias.",
            None,
        ),
    ));
    capabilities.extend(cloud_capabilities(&generated_at, &probes.cloud));
    capabilities.extend(observation_capabilities(&generated_at, &probes.observation));
    capabilities.extend(memory_capabilities(
        &generated_at,
        &probes.memory,
        probes.cloud.ollama_configured,
        probes.gemma_installed,
    ));
    capabilities.extend(avatar_capabilities(&generated_at, &probes.avatar));
    capabilities.extend(sensory_capabilities(&generated_at, &probes.sensory));
    capabilities.push(capability(
        "perception.conversation.vision",
        "Vista de Alice en conversación",
        "Conversa con Gemma sobre fotogramas efímeros de la cámara elegida y los monitores visibles.",
        CapabilityDomain::Perception, CapabilityKind::Observation, CapabilityMaturity::Implemented,
        "WebView2 cámara + Windows GDI + Gemma local",
        &["start_vision_session", "stop_vision_session", "preview_vision_desktop", "send_cloud_message"],
        CapabilityState::Idle, CapabilityRisk::High,
        &[CapabilityEffect::CameraObserve, CapabilityEffect::ScreenObserve, CapabilityEffect::LocalRead],
        &["cameraFramesEphemeral", "desktopPixelsEphemeral"],
        &["Gemma y proyector instalados", "Activación visible en Conversación", "Permiso de cámara del sistema operativo"],
        permission(CapabilityPermissionMode::SessionOptIn, CapabilityPermissionEnforcer::CurrentUi,
            "Controles por fuente y token nativo con vencimiento de dos horas; Detener y salir revocan la sesión. No requiere un grant R2 por turno."),
        health(CapabilityHealthStatus::Unchecked,
            "Adaptador implementado. El acceso al dispositivo y la captura se comprueban al activar cada fuente.", None),
    ));
    capabilities.extend(task_capabilities(&generated_at, &probes.tasks));
    capabilities.push(capability(
        "desktop.approved.open", "Abrir destinos delegados",
        if cfg!(target_os="linux") {"Abre Spotify ante una orden directa actual de Carlos. Las unidades D:/E: siguen siendo específicas de Windows."} else {"Abre únicamente Spotify o las raíces D: y E: ante una orden directa actual de Carlos."},
        CapabilityDomain::Output, CapabilityKind::Process, CapabilityMaturity::Implemented,
        if cfg!(target_os="linux") {"Spotify nativo de Ubuntu · MPRIS"} else {"Lista nativa cerrada de destinos Windows"}, &["send_cloud_message"],
        CapabilityState::Idle, CapabilityRisk::Low,
        &[CapabilityEffect::ProcessLaunch, CapabilityEffect::LocalRead],
        &["spotifyApplication", "driveD", "driveE"],
        &["Orden directa del propietario", "Destino disponible en el equipo"],
        permission(CapabilityPermissionMode::SessionOptIn, CapabilityPermissionEnforcer::CurrentUi,
            "Delegación del propietario para estos tres destinos. El backend sólo admite órdenes directas; no ejecuta texto de recuerdos, imágenes o respuestas del modelo."),
        health(CapabilityHealthStatus::Unchecked, "La disponibilidad del destino se verifica antes de abrirlo.", None),
    ));
    capabilities.extend(output_capabilities(&generated_at));
    capabilities.push(capability(
        "desktop.approved.media", "Reproducir música delegada",
        if cfg!(target_os="linux") {"Reproduce Tus me gusta en Spotify y únicamente la playlist configurada de YouTube, en orden y con repetición completa; permite pausa y reanudación."} else {"Reproduce Tus me gusta en Spotify o una canción indicada en YouTube dentro de Google Chrome; permite pausa y reanudación."},
        CapabilityDomain::Output, CapabilityKind::Process, CapabilityMaturity::Implemented,
        if cfg!(target_os="linux") {"MPRIS + AT-SPI de Spotify y YouTube · perfil Chrome delimitado"} else {"Windows Media Control + UI Automation de Spotify y YouTube"}, &["send_cloud_message"],
        CapabilityState::Idle, CapabilityRisk::Low,
        &[CapabilityEffect::ProcessLaunch, CapabilityEffect::LocalRead, CapabilityEffect::NetworkSend],
        &["spotifyLikedSongs", "spotifyPlaybackStatus", "youtubeSongQuery", "youtubeChromePlayer"],
        &["Orden directa del propietario", "Spotify iniciado con su cuenta", "Google Chrome instalado", "Reproductor accesible"],
        permission(CapabilityPermissionMode::SessionOptIn, CapabilityPermissionEnforcer::CurrentUi,
            "Delegación específica para reproducir y pausar música. Canción literal, sitio YouTube, controles del reproductor y recibo verificado; sin consola ni rutas libres."),
        health(CapabilityHealthStatus::Unchecked, "La reproducción y el destino se verifican en cada petición; si el servicio requiere interacción se informa sin simular éxito.", None),
    ));

    let snapshot = CapabilityRegistrySnapshot {
        schema_version: CAPABILITY_REGISTRY_SCHEMA_VERSION,
        generated_at,
        capabilities,
    };
    snapshot.validate()?;
    Ok(snapshot)
}

fn sensory_capabilities(
    checked_at: &str,
    probe: &Result<SensorCapabilityProbe, String>,
) -> Vec<CapabilityDescriptor> {
    let (runtime_available, camera_active, microphone_active, probe_summary) = match probe {
        Ok(probe) => (
            probe.runtime_available,
            probe.camera_active,
            probe.microphone_active,
            probe.summary.clone(),
        ),
        Err(error) => (
            false,
            false,
            false,
            format!("Sonda sensorial fallida: {error}"),
        ),
    };
    let mut capabilities = vec![
        sensory_capability(
            "perception.camera.observe",
            "Observar cámara local",
            "Abre una sesión visible de cámara autorizada y descarta cada fotograma sin persistirlo.",
            "OpenCV 5 / DirectShow local",
            "observeAuthorizedCamera",
            "cameraFrames",
            CapabilityEffect::CameraObserve,
            runtime_available,
            camera_active,
            checked_at,
            &probe_summary,
        ),
        sensory_capability(
            "perception.microphone.observe",
            "Escuchar micrófono local",
            "Abre una sesión visible de micrófono autorizada y descarta cada muestra sin persistirla.",
            "PortAudio / WASAPI local",
            "observeAuthorizedMicrophone",
            "microphoneAudio",
            CapabilityEffect::MicrophoneObserve,
            runtime_available,
            microphone_active,
            checked_at,
            &probe_summary,
        ),
        capability(
            "perception.screen.observe",
            "Observar pantalla seleccionada",
            "Analiza muestras efímeras de una pantalla elegida por el propietario y conserva sólo apuntes candidatos revisables.",
            CapabilityDomain::Perception,
            CapabilityKind::Observation,
            CapabilityMaturity::Partial,
            "WebView2 getDisplayMedia + Ollama local",
            &["analyze_screen_frame"],
            CapabilityState::Idle,
            CapabilityRisk::High,
            &[CapabilityEffect::ScreenObserve, CapabilityEffect::LocalRead],
            &["screenPixelsEphemeral", "visualNotesCandidate"],
            &[
                "Selección explícita del sistema operativo",
                "Ollama local disponible",
                "Revisión humana antes de memoria",
            ],
            permission(
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionEnforcer::OperatingSystem,
                "Windows limita la sesión a la pantalla o ventana elegida; Alice expone Detener y no persiste capturas.",
            ),
            health(
                CapabilityHealthStatus::Healthy,
                "El selector WebView2 y el backend Ollama completaron cinco muestras reales autorizadas; ninguna captura fue persistida.",
                Some(checked_at),
            ),
        ),
        capability(
            "perception.voice.transcribe",
            "Transcribir un turno de voz",
            "Transcribe una toma WebM autorizada con Whisper local si está instalado, o con Gemma como respaldo. Descarta el audio; la sesión continua puede atender el texto y el modo manual entrega un borrador.",
            CapabilityDomain::Perception,
            CapabilityKind::Query,
            CapabilityMaturity::Partial,
            "WebView2 MediaRecorder + RNNoise + FFmpeg + Whisper CPU / Gemma local",
            &["transcribe_voice_turn"],
            if runtime_available && crate::local_inference::installed() {
                CapabilityState::Idle
            } else {
                CapabilityState::Degraded
            },
            CapabilityRisk::High,
            &[
                CapabilityEffect::MicrophoneObserve,
                CapabilityEffect::ProcessLaunch,
                CapabilityEffect::LocalRead,
            ],
            &["microphoneAudioEphemeral", "transcriptDraft"],
            &[
                "Permiso de micrófono del sistema operativo",
                "Whisper local instalado o Gemma local iniciado",
                "FFmpeg disponible",
            ],
            permission(
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionEnforcer::OperatingSystem,
                "El propietario inicia y detiene la sesión continua. El modo manual permite revisar el borrador antes de enviarlo; ambos usan el permiso de micrófono de Windows.",
            ),
            health(
                if runtime_available && crate::local_inference::installed() {
                    CapabilityHealthStatus::Unchecked
                } else {
                    CapabilityHealthStatus::Degraded
                },
                "Audio sólo en RAM. Whisper se ejecuta en CPU con tuberías; el modo manual entrega un borrador y la sesión continua atiende el turno autorizado.",
                if runtime_available && crate::local_inference::installed() {
                    None
                } else {
                    Some(checked_at)
                },
            ),
        ),
    ];
    capabilities.extend([
        (
            "perception.media.inspect",
            "Inspeccionar reproductor multimedia",
            "Representa una futura consulta de título, artista, aplicación y estado sin copiar el audio.",
            "inspectCurrentMediaSession",
            "mediaSessionMetadata",
            "Gateway R2 y sesión multimedia compatible",
        ),
        (
            "perception.desktop.observe",
            "Observar acciones accesibles",
            "Representa futuros eventos estructurados de interfaz sin registrar teclas ni campos protegidos.",
            "observeAccessibleUiEvents",
            "uiAutomationEvents",
            "Gateway R2, alcance de aplicación y exclusión de datos protegidos",
        ),
        (
            "perception.face.landmarks",
            "Derivar landmarks faciales locales",
            "Representa una futura derivación efímera de landmarks y blendshapes faciales desde una cámara autorizada; no identifica personas ni persiste coordenadas.",
            "deriveAuthorizedFaceLandmarks",
            "facialLandmarksEphemeral",
            "Cámara autorizada, modelo local verificado, permiso facial R2 específico y calibración",
        ),
    ]
    .into_iter()
    .map(|(id, label, description, operation, data_scope, requirement)| {
        capability(
            id,
            label,
            description,
            CapabilityDomain::Perception,
            CapabilityKind::Observation,
            CapabilityMaturity::Planned,
            "none",
            &[operation],
            CapabilityState::Unavailable,
            CapabilityRisk::High,
            &[CapabilityEffect::None],
            &[data_scope],
            &[requirement],
            permission(
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionEnforcer::None,
                "No existe permiso aplicable porque la capacidad sensorial no está implementada.",
            ),
            health(
                CapabilityHealthStatus::Unavailable,
                "Capacidad sensorial planificada sin adaptador; no se abrió ningún dispositivo.",
                None,
            ),
        )
    })
    .collect::<Vec<_>>());
    capabilities
}

#[allow(clippy::too_many_arguments)]
fn sensory_capability(
    id: &str,
    label: &str,
    description: &str,
    adapter: &str,
    operation: &str,
    data_scope: &str,
    effect: CapabilityEffect,
    runtime_available: bool,
    active: bool,
    checked_at: &str,
    probe_summary: &str,
) -> CapabilityDescriptor {
    capability(
        id,
        label,
        description,
        CapabilityDomain::Perception,
        CapabilityKind::Observation,
        CapabilityMaturity::Partial,
        adapter,
        &[operation],
        if active {
            CapabilityState::Active
        } else if runtime_available {
            CapabilityState::Idle
        } else {
            CapabilityState::Degraded
        },
        CapabilityRisk::High,
        &[effect, CapabilityEffect::ProcessLaunch],
        &[data_scope],
        &[
            "Grant session R2 vigente",
            "Indicador persistente y control Detener",
        ],
        permission(
            CapabilityPermissionMode::SessionOptIn,
            CapabilityPermissionEnforcer::Native,
            "El Gateway nativo congela dispositivo y duración antes de abrir el hardware.",
        ),
        health(
            if runtime_available {
                CapabilityHealthStatus::Healthy
            } else {
                CapabilityHealthStatus::Degraded
            },
            probe_summary,
            Some(checked_at),
        ),
    )
}

#[tauri::command]
pub(crate) fn capability_registry_status(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
) -> Result<CapabilityRegistrySnapshot, String> {
    let mut snapshot = current_capability_registry(&app, &observation_store, &sensor_store)?;
    use tauri::Manager;
    if app
        .try_state::<crate::conversation_vision::VisionSessionStore>()
        .is_some_and(|state| state.is_active())
    {
        if let Some(view) = snapshot
            .capabilities
            .iter_mut()
            .find(|c| c.id == "perception.conversation.vision")
        {
            view.state = CapabilityState::Active;
        }
    }
    Ok(snapshot)
}

pub(crate) fn current_capability_registry(
    app: &AppHandle,
    observation_store: &ObservationStore,
    sensor_store: &SensorLeaseStore,
) -> Result<CapabilityRegistrySnapshot, String> {
    let data_root = alice_data_root_path(app)?;
    let probes = CapabilityProbeSnapshot::collect(&data_root, observation_store, sensor_store);
    capability_registry_from_probes(current_utc_timestamp()?, &probes)
}

pub(crate) fn current_utc_timestamp() -> Result<String, String> {
    Ok(format_utc_timestamp(current_unix_seconds()?))
}

pub(crate) fn current_unix_seconds() -> Result<i64, String> {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    i64::try_from(seconds).map_err(|_| "La fecha del sistema excede el rango admitido".into())
}

pub(crate) fn format_utc_timestamp(seconds: i64) -> String {
    let days = seconds.div_euclid(86_400);
    let seconds_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_date_from_unix_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = seconds_of_day % 3_600 / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_date_from_unix_days(days: i64) -> (i64, i64, i64) {
    let days = days + 719_468;
    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn cloud_capabilities(checked_at: &str, probe: &CloudCapabilityProbe) -> Vec<CapabilityDescriptor> {
    let provider_summary = format!(
        "Se inspeccionaron {} adaptadores; {} tienen configuración presente.",
        probe.provider_count, probe.configured_provider_count
    );
    let send_available = probe.configured_provider_count > 0;
    vec![
        capability(
            "cloud.providers.inspect",
            "Inspeccionar proveedores",
            "Resume qué proveedores tienen configuración sin devolver claves.",
            CapabilityDomain::Cloud,
            CapabilityKind::Observation,
            CapabilityMaturity::Implemented,
            "cloud",
            &["cloud_status"],
            CapabilityState::Idle,
            CapabilityRisk::Low,
            &[CapabilityEffect::CredentialPresenceRead],
            &["providerConfigurationPresence"],
            &[],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::Native,
                "Rust limita la respuesta a presencia de configuración y modelos públicos.",
            ),
            health(
                CapabilityHealthStatus::Healthy,
                provider_summary,
                Some(checked_at),
            ),
        ),
        capability(
            "cloud.conversation.send",
            "Enviar conversación autorizada",
            "Envía únicamente el contexto previsualizado al proveedor elegido y audita metadatos.",
            CapabilityDomain::Cloud,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "cloud",
            &["send_cloud_message"],
            if send_available {
                CapabilityState::Idle
            } else {
                CapabilityState::Unavailable
            },
            CapabilityRisk::Medium,
            &[CapabilityEffect::NetworkSend, CapabilityEffect::LocalWrite],
            &["authorizedConversationContext", "cloudAuditMetadata"],
            &["Al menos un proveedor configurado"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "React muestra el contexto y solicita confirmación antes del envío.",
            ),
            health(
                if send_available {
                    CapabilityHealthStatus::Healthy
                } else {
                    CapabilityHealthStatus::Unavailable
                },
                if send_available {
                    "Existe al menos un proveedor configurado; no se realizó ninguna solicitud."
                } else {
                    "No hay proveedores configurados; no se realizó ninguna solicitud."
                },
                Some(checked_at),
            ),
        ),
    ]
}

fn observation_capabilities(
    checked_at: &str,
    probe: &Result<ObservationCapabilityProbe, String>,
) -> Vec<CapabilityDescriptor> {
    let (control_state, read_state, status, control_summary, read_summary) = match probe {
        Ok(probe) if probe.enabled => (
            CapabilityState::Active,
            CapabilityState::Idle,
            CapabilityHealthStatus::Healthy,
            "La observación autorizada de ventana está encendida.".to_string(),
            if probe.has_latest_context {
                "Existe una muestra vigente; el registro no leyó ni devolvió su contenido."
            } else {
                "La observación está encendida, pero todavía no existe una muestra."
            }
            .to_string(),
        ),
        Ok(_) => (
            CapabilityState::Disabled,
            CapabilityState::Disabled,
            CapabilityHealthStatus::Healthy,
            "La observación de ventana está apagada.".to_string(),
            "La lectura está desactivada porque no existe opt-in de sesión.".to_string(),
        ),
        Err(error) => (
            CapabilityState::Error,
            CapabilityState::Error,
            CapabilityHealthStatus::Error,
            error.clone(),
            error.clone(),
        ),
    };
    vec![
        capability(
            "context.foreground.control",
            "Controlar observación de ventana",
            "Activa o detiene la observación autorizada de título y proceso de la ventana externa.",
            CapabilityDomain::Context,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "observation",
            &["execute_context_observation_grant"],
            control_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::WindowMetadataRead],
            &["foregroundWindowTitle", "foregroundProcessName"],
            &["Opt-in visible durante la sesión"],
            permission(
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionEnforcer::Native,
                "Rust exige y consume un grant R2 específico antes de cambiar el estado.",
            ),
            health(status, control_summary, Some(checked_at)),
        ),
        capability(
            "context.foreground.read",
            "Leer contexto de ventana",
            "Devuelve la última ventana observada solo cuando el control de sesión está encendido.",
            CapabilityDomain::Context,
            CapabilityKind::Query,
            CapabilityMaturity::Implemented,
            "observation",
            &["get_foreground_context"],
            read_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::WindowMetadataRead],
            &["foregroundWindowTitle", "foregroundProcessName"],
            &["Observación de ventana encendida"],
            permission(
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionEnforcer::Native,
                "Rust entrega contexto solo mientras el grant de sesión continúa activo.",
            ),
            health(status, read_summary, Some(checked_at)),
        ),
    ]
}

fn memory_capabilities(
    checked_at: &str,
    probe: &MemoryCapabilityProbe,
    ollama_configured: bool,
    gemma_installed: bool,
) -> Vec<CapabilityDescriptor> {
    let (records_state, records_health, records_summary) = memory_records_health(probe);
    let (directory_state, directory_health, directory_summary) = if probe.directory_exists {
        (
            CapabilityState::Idle,
            CapabilityHealthStatus::Healthy,
            "La carpeta privada de memoria existe; no se abrió ningún proceso.",
        )
    } else {
        (
            CapabilityState::Unavailable,
            CapabilityHealthStatus::Unavailable,
            "La carpeta privada de memoria todavía no existe y la sonda no la creó.",
        )
    };
    let (restore_state, restore_health, restore_summary) = match probe.backup {
        MemoryResourceState::Valid => (
            CapabilityState::Idle,
            CapabilityHealthStatus::Healthy,
            "Existe un respaldo válido; no se restauró ni modificó la memoria.",
        ),
        MemoryResourceState::Missing => (
            CapabilityState::Unavailable,
            CapabilityHealthStatus::Unavailable,
            "No existe un respaldo para restaurar.",
        ),
        MemoryResourceState::Invalid => (
            CapabilityState::Error,
            CapabilityHealthStatus::Error,
            "El respaldo existe, pero su estructura no es válida.",
        ),
        MemoryResourceState::Error => (
            CapabilityState::Error,
            CapabilityHealthStatus::Error,
            "No se pudo inspeccionar el respaldo local.",
        ),
    };

    vec![
        capability(
            "memory.working.manage",
            "Gestionar memoria de trabajo",
            "Mantiene hasta seis intercambios y doce mensajes reales dentro del proceso y permite inspeccionarlos o vaciarlos.",
            CapabilityDomain::Memory,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "working-memory",
            &[
                "working_memory_status",
                "record_real_cloud_exchange",
                "clear_working_memory",
            ],
            CapabilityState::Idle,
            CapabilityRisk::Low,
            &[CapabilityEffect::None],
            &["volatileConversationText", "workingMemoryAuditDigests"],
            &["Proceso de Alice activo", "Respuesta real recibida para registrar"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "El envío se autoriza visiblemente; Memoria confirma el vaciado y Rust exige la generación exacta revisada.",
            ),
            health(
                CapabilityHealthStatus::Healthy,
                "El almacén RAM, su indicador, vencimiento y vaciado confirmado están disponibles.",
                Some(checked_at),
            ),
        ),
        capability(
            "memory.conversation.history",
            "Conservar historial de conversación",
            "Guarda intercambios reales en un historial local durable y los recupera al reiniciar, sin convertirlos automáticamente en recuerdos.",
            CapabilityDomain::Memory,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "conversation-history",
            &[
                "conversation_history_status",
                "record_real_conversation_exchange",
            ],
            CapabilityState::Idle,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["conversationHistory", "conversationHistoryAuditDigests"],
            &["Respuesta real recibida después de una previsualización autorizada"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "La previsualización informa que el intercambio exitoso se guardará localmente; Rust valida, reemplaza atómicamente y audita sólo digests.",
            ),
            health(
                CapabilityHealthStatus::Healthy,
                "El historial es local, durable y separado de la memoria R6 confirmada.",
                Some(checked_at),
            ),
        ),
        capability(
            "memory.records.read",
            "Leer memoria local",
            "Lee y valida registros locales sin utilizar la red.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Partial,
            "memory",
            &[
                "load_memory",
                "layered_memory_status",
                "consolidation_preview",
                "preview_memory_archive",
                "preview_memory_deletion_schedule",
                "preview_memory_deletion",
                "preview_memory_reconsolidation",
            ],
            records_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead],
            &["memoryRecords"],
            &["Manifiesto y registros locales válidos"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::CurrentUi,
                "La interfaz carga la memoria al iniciar; el comando actual también puede inicializarla.",
            ),
            health(records_health, records_summary, Some(checked_at)),
        ),
        capability(
            "memory.records.write",
            "Modificar memoria local",
            "Crea, edita, archiva o elimina registros mediante contratos validados, espera y resguardo.",
            CapabilityDomain::Memory,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "memory",
            &[
                "save_memory",
                "activate_layered_memory",
                "resolve_consolidation_candidate",
                "confirm_learning_candidate",
                "confirm_conversation_learning",
                "confirm_memory_archive",
                "confirm_memory_deletion_schedule",
                "confirm_memory_deletion",
                "confirm_memory_reconsolidation",
            ],
            records_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["memoryRecords", "memoryBackup", "memoryAudit"],
            &["Memoria local válida"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::CurrentUi,
                "Las acciones son visibles; eliminar exige archivo previo, siete días de espera, vista previa, doble confirmación y resguardo local.",
            ),
            health(records_health, records_summary, Some(checked_at)),
        ),
        capability(
            "memory.records.export",
            "Exportar memoria local",
            "Copia la memoria validada a la carpeta privada de exportaciones.",
            CapabilityDomain::Memory,
            CapabilityKind::Export,
            CapabilityMaturity::Implemented,
            "memory",
            &["export_memory"],
            records_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["memoryRecords", "memoryExport"],
            &["Memoria local válida"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::CurrentUi,
                "La exportación comienza únicamente desde una acción visible.",
            ),
            health(records_health, records_summary, Some(checked_at)),
        ),
        capability(
            "memory.records.restore",
            "Restaurar respaldo de memoria",
            "Restaura un respaldo validado y protege primero el estado desplazado.",
            CapabilityDomain::Memory,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "memory",
            &[
                "restore_memory_backup",
                "rollback_layered_memory",
                "restore_consolidation_transaction",
            ],
            restore_state,
            CapabilityRisk::High,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["memoryRecords", "memoryBackup", "memoryAudit"],
            &["Respaldo local válido"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::CurrentUi,
                "React solicita confirmación antes de sustituir la memoria vigente.",
            ),
            health(restore_health, restore_summary, Some(checked_at)),
        ),
        capability(
            "memory.directory.open",
            "Abrir carpeta de memoria",
            "Inicia Explorer únicamente sobre la carpeta privada de memoria.",
            CapabilityDomain::Memory,
            CapabilityKind::Process,
            CapabilityMaturity::Implemented,
            "memory",
            &["open_memory_directory"],
            directory_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::ProcessLaunch],
            &["memoryDirectoryPath"],
            &["Carpeta privada de memoria existente"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::CurrentUi,
                "Explorer se inicia solo desde una acción visible de la interfaz.",
            ),
            health(directory_health, directory_summary, Some(checked_at)),
        ),
        capability(
            "memory.retrieval.lexical",
            "Recuperar recuerdos relacionados",
            "Busca localmente hasta tres recuerdos relacionados mediante coincidencia lexical.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Implemented,
            "memory-retrieval",
            &["retrieveMemories"],
            records_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["memoryRecords", "localQueryText"],
            &["Memoria local válida"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::CurrentUi,
                "La búsqueda ocurre localmente al redactar; un envío posterior requiere otra autorización.",
            ),
            health(records_health, records_summary, Some(checked_at)),
        ),
        capability(
            "memory.retrieval.hybrid.preview",
            "Ampliar recuperación con Gemma",
            "Reranquea localmente hasta tres recuerdos para revisión sin verificar su verdad ni guardarlos.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Partial,
            "hybrid-retrieval",
            &["preview_hybrid_memory_retrieval"],
            if records_state == CapabilityState::Idle && gemma_installed {
                CapabilityState::Idle
            } else {
                CapabilityState::Unavailable
            },
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::NetworkSend],
            &["memoryRecords", "ownerProfile", "localQueryText", "localRanking"],
            &["Memoria local válida", "Gemma iniciada manualmente en loopback"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "Sólo se ejecuta al pulsar el botón visible; devuelve candidatos revisables y no escribe memoria.",
            ),
            health(
                if records_state == CapabilityState::Idle && gemma_installed {
                    CapabilityHealthStatus::Healthy
                } else {
                    CapabilityHealthStatus::Unavailable
                },
                if !gemma_installed {
                    "El modelo local evaluado no está instalado."
                } else if records_state != CapabilityState::Idle {
                    "La memoria local no está disponible para ampliar la búsqueda."
                } else {
                    "La vista previa está disponible cuando Gemma se inicia explícitamente."
                },
                Some(checked_at),
            ),
        ),
        capability(
            "memory.learning.propose",
            "Proponer aprendizaje desde memoria",
            "Analiza un recuerdo con Ollama local y devuelve candidatos revisables sin guardarlos.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Partial,
            "learning-candidates",
            &["preview_learning_candidates"],
            if records_state == CapabilityState::Idle && ollama_configured {
                CapabilityState::Idle
            } else {
                CapabilityState::Unavailable
            },
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::NetworkSend],
            &["memoryRecords", "localLearningCandidates"],
            &["Memoria local válida", "Ollama disponible sólo en loopback"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "Carlos elige el recuerdo y solicita la vista previa; guardar exige otra confirmación visible.",
            ),
            health(
                if records_state == CapabilityState::Idle && ollama_configured {
                    CapabilityHealthStatus::Healthy
                } else {
                    CapabilityHealthStatus::Unavailable
                },
                if records_state != CapabilityState::Idle {
                    "La memoria local no está disponible para proponer candidatos."
                } else if !ollama_configured {
                    "Ollama local no está disponible; no se envió el recuerdo."
                } else {
                    "La vista previa local está disponible; no escribe memoria automáticamente."
                },
                Some(checked_at),
            ),
        ),
        capability(
            "memory.conversationlearning.propose",
            "Proponer recuerdo desde conversación",
            "Analiza sólo el mensaje del propietario en un intercambio real y devuelve propuestas revisables sin guardarlas.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Partial,
            "conversation-learning",
            &["preview_conversation_learning"],
            if records_state == CapabilityState::Idle && gemma_installed {
                CapabilityState::Idle
            } else {
                CapabilityState::Unavailable
            },
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::NetworkSend],
            &["conversationHistory", "ownerMessage", "memoryRecords", "localLearningCandidates"],
            &["Intercambio local real", "Gemma iniciada manualmente en loopback", "memoria local válida"],
            permission(
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionEnforcer::CurrentUi,
                "El propietario pulsa una acción visible; la respuesta de Alice queda excluida y confirmar exige otra decisión visible.",
            ),
            health(
                if records_state == CapabilityState::Idle && gemma_installed {
                    CapabilityHealthStatus::Healthy
                } else {
                    CapabilityHealthStatus::Unavailable
                },
                if records_state != CapabilityState::Idle {
                    "La memoria local no está disponible para revisar una propuesta."
                } else if !gemma_installed {
                    "El modelo local evaluado no está instalado."
                } else {
                    "La propuesta se habilita sólo al pulsarla después de un intercambio real."
                },
                Some(checked_at),
            ),
        ),
        capability(
            "memory.graph.inspect",
            "Inspeccionar fuentes del grafo",
            "Reconstruye referencias versionadas desde memoria R6 sin generar asociaciones ni copiar contenido.",
            CapabilityDomain::Memory,
            CapabilityKind::Query,
            CapabilityMaturity::Implemented,
            "knowledge-graph",
            &["knowledge_graph_snapshot", "preview_knowledge_graph_association", "knowledge_graph_associations"],
            records_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["memoryRecords"],
            &["Memoria R6 válida; máximo 8 MiB y 10.000 registros"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::Native,
                "Consulta local de referencias; no ejecuta inferencia ni escribe índices.",
            ),
            health(records_health, records_summary, Some(checked_at)),
        ),
        capability(
            "memory.graph.manage", "Revisar relaciones entre episodios",
            "Conserva decisiones explícitas con revisiones inmutables; retira o restaura relaciones sin editar recuerdos.",
            CapabilityDomain::Memory, CapabilityKind::Mutation, CapabilityMaturity::Implemented,
            "knowledge-graph", &["confirm_knowledge_graph_association", "set_knowledge_graph_association_withdrawn"],
            records_state, CapabilityRisk::Medium, &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["memoryRecords", "associationRevisions", "auditMetadata"], &["Fuentes y revisión vigentes; confirmación explícita"],
            permission(CapabilityPermissionMode::ExplicitConfirmation, CapabilityPermissionEnforcer::CurrentUi,
                "Revisión visible; el backend exige confirmación, fuentes exactas y revisión actual. No concede autonomía."),
            health(records_health, records_summary, Some(checked_at)),
        ),
    ]
}

fn avatar_capabilities(
    checked_at: &str,
    probe: &Result<AvatarCapabilityProbe, String>,
) -> Vec<CapabilityDescriptor> {
    let (state, status, summary) = match probe {
        Ok(probe) if probe.available => (
            CapabilityState::Idle,
            CapabilityHealthStatus::Healthy,
            format!(
                "El archivo VRM existe y ocupa {} bytes; no se cargó ni renderizó.",
                probe.size_bytes
            ),
        ),
        Ok(_) => (
            CapabilityState::Unavailable,
            CapabilityHealthStatus::Unavailable,
            "No existe un archivo VRM válido en la ruta configurada.".to_string(),
        ),
        Err(error) => (
            CapabilityState::Error,
            CapabilityHealthStatus::Error,
            error.clone(),
        ),
    };
    vec![
        capability(
            "avatar.vrm.inspect",
            "Inspeccionar avatar VRM",
            "Comprueba ruta, extensión, existencia y tamaño del avatar privado.",
            CapabilityDomain::Avatar,
            CapabilityKind::Observation,
            CapabilityMaturity::Implemented,
            "avatar",
            &["avatar_status"],
            state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["avatarFileMetadata"],
            &["Ruta absoluta a un archivo .vrm"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::Native,
                "Rust valida la ruta y devuelve únicamente metadatos mínimos.",
            ),
            health(status, summary.clone(), Some(checked_at)),
        ),
        capability(
            "avatar.vrm.render",
            "Renderizar avatar VRM",
            "Carga y presenta localmente el avatar privado; admite una prueba manual de visor sin conectar decisiones, rostro ni puente corporal.",
            CapabilityDomain::Avatar,
            CapabilityKind::Presentation,
            CapabilityMaturity::Implemented,
            "avatar-viewer",
            &["AvatarViewer.render"],
            state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead, CapabilityEffect::AssetRender],
            &["avatarFile"],
            &["Archivo VRM local válido"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::CurrentUi,
                "El visor carga el archivo únicamente al abrir la pestaña Avatar.",
            ),
            health(status, summary, Some(checked_at)),
        ),
    ]
}

fn task_capabilities(checked_at: &str, probe: &TaskCapabilityProbe) -> Vec<CapabilityDescriptor> {
    let (inspect_state, write_state, engine_state, reserve_state, health_status, summary) =
        match probe.state {
            TaskRegistryState::Missing => (
                CapabilityState::Unavailable,
                CapabilityState::Idle,
                CapabilityState::Disabled,
                CapabilityState::Unavailable,
                CapabilityHealthStatus::Healthy,
                "El registro R7 todavía no existe; una vista previa puede prepararlo sin escribir."
                    .to_string(),
            ),
            TaskRegistryState::Ready => (
                CapabilityState::Idle,
                CapabilityState::Idle,
                CapabilityState::Disabled,
                CapabilityState::Idle,
                CapabilityHealthStatus::Healthy,
                format!(
                    "El registro R7 contiene {} tareas válidas; no se ejecutó ninguna.",
                    probe.task_count
                ),
            ),
            TaskRegistryState::Invalid => (
                CapabilityState::Error,
                CapabilityState::Error,
                CapabilityState::Error,
                CapabilityState::Error,
                CapabilityHealthStatus::Error,
                "El registro R7 existe, pero no cumple el contrato cerrado.".to_string(),
            ),
        };

    vec![
        capability(
            "tasks.registry.inspect",
            "Inspeccionar tareas locales",
            "Lee un registro R7 validado y distingue recordatorios de comprobaciones de solo lectura sin programar ni ejecutar acciones.",
            CapabilityDomain::Task,
            CapabilityKind::Query,
            CapabilityMaturity::Implemented,
            "tasks",
            &["task_registry_status"],
            inspect_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["taskRegistryMetadata"],
            &["Registro local R7 válido"],
            permission(
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionEnforcer::Native,
                "Rust sólo relee y valida el registro; no crea tareas ni activa un scheduler.",
            ),
            health(health_status, summary.clone(), Some(checked_at)),
        ),
        capability(
            "tasks.capability.readcheck",
            "Comprobar una capacidad en modo lectura",
            "Vuelve a resolver R1 para una capacidad elegida y bloquea efectos externos, mutaciones o permisos R2 ausentes sin ejecutar la capacidad.",
            CapabilityDomain::Task,
            CapabilityKind::Query,
            CapabilityMaturity::Implemented,
            "tasks",
            &["run_read_only_capability_check"],
            inspect_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["capabilityRegistryMetadata", "permissionGrantMetadata"],
            &["Confirmación explícita del propietario"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::Native,
                "Rust resuelve R1 y el estado R2 vigentes en cada intento; no llama al adaptador evaluado.",
            ),
            health(health_status, "R7.5 sólo presenta elegibilidad actual; no ejecuta, no aprende y no escribe.", Some(checked_at)),
        ),
        capability(
            "tasks.registry.write",
            "Programar o cancelar una tarea local",
            "Prepara sin escribir y confirma un recordatorio único o su cancelación con identidad, hora, alcance, respaldo, revisión y auditoría releídos.",
            CapabilityDomain::Task,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "tasks",
            &["preview_task_mutation", "confirm_task_mutation"],
            write_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["taskRegistry", "taskRevisionIndex", "taskAudit"],
            &["Vista previa R7 confirmada sin cambios posteriores"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::Native,
                "Rust rechaza planes alterados o obsoletos y no contiene motor de ejecución ni notificaciones.",
            ),
            health(health_status, summary, Some(checked_at)),
        ),
        capability(
            "tasks.dispatch.reserve",
            "Reservar despacho vencido",
            "Registra una reserva durable e idempotente para un recordatorio ya vencido antes de cualquier futura salida; no muestra aviso ni cambia la tarea.",
            CapabilityDomain::Task,
            CapabilityKind::Mutation,
            CapabilityMaturity::Implemented,
            "tasks",
            &["task_attempt_ledger_status", "reserve_task_attempt"],
            reserve_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite],
            &["taskRegistry", "taskAttemptLedger", "taskAudit"],
            &["Confirmación explícita de una tarea local vencida"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::Native,
                "Rust relee identidad, hora y vencimiento; la misma ocurrencia sólo admite una reserva durable.",
            ),
            health(health_status, "R7.3-B reserva una futura salida sin producirla todavía.", Some(checked_at)),
        ),
        capability(
            "tasks.notification.deliver",
            "Entregar recordatorio local",
            "Entrega al sistema operativo un recordatorio reservado y registra un resultado terminal sin red ni procesos libres.",
            CapabilityDomain::Task,
            CapabilityKind::Presentation,
            CapabilityMaturity::Implemented,
            "tasks",
            &["dispatch_task_notification"],
            reserve_state,
            CapabilityRisk::Medium,
            &[CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite, CapabilityEffect::UserNotification],
            &["taskRegistry", "taskAttemptLedger", "taskAudit", "localNotification"],
            &["Reserva R7.3-B válida y confirmación explícita"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::Native,
                "Rust marca el despacho antes de llamar al sistema operativo y no reintenta estados inciertos o terminales.",
            ),
            health(health_status, "La entrega es local, manual e idempotente; el scheduler automático permanece apagado.", Some(checked_at)),
        ),
        capability(
            "tasks.temporal.evaluate",
            "Evaluar intenciones temporales",
            "Compara el reloj local con la programación R7 y distingue intenciones futuras, vencidas o excluidas sin intentar ejecutarlas.",
            CapabilityDomain::Task,
            CapabilityKind::Observation,
            CapabilityMaturity::Implemented,
            "tasks",
            &["task_engine_status", "set_task_engine_enabled"],
            engine_state,
            CapabilityRisk::Low,
            &[CapabilityEffect::LocalRead],
            &["taskScheduleMetadata"],
            &["Registro R7 válido o ausencia controlada"],
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                CapabilityPermissionEnforcer::CurrentUi,
                "La evaluación periódica comienza apagada y sólo cambia desde el control visible del propietario.",
            ),
            health(
                health_status,
                "El clasificador temporal no notifica, no ejecuta y no escribe en el registro de tareas.",
                Some(checked_at),
            ),
        ),
    ]
}

fn output_capabilities(checked_at: &str) -> Vec<CapabilityDescriptor> {
    let voice_ready = std::env::var("FISH_API_KEY")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        && std::env::var("ALICE_FISH_REFERENCE_ID")
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
    output_capabilities_for_configuration(checked_at, voice_ready)
}

fn output_capabilities_for_configuration(
    checked_at: &str,
    voice_ready: bool,
) -> Vec<CapabilityDescriptor> {
    [
        (
            "output.text.external",
            "Entregar texto externo",
            "Representa una futura entrega de texto a otra aplicación.",
            CapabilityKind::Mutation,
            "deliverAuthorizedText",
        ),
        (
            "output.voice.synthesize",
            "Sintetizar voz",
            "Representa una futura conversión de texto autorizado en audio.",
            CapabilityKind::Presentation,
            "synthesizeAuthorizedText",
        ),
        (
            "output.avatar.face",
            "Controlar rostro del avatar",
            "Representa un futuro adaptador de expresiones y habla.",
            CapabilityKind::Presentation,
            "animateAvatarFace",
        ),
        (
            "output.avatar.gaze",
            "Controlar mirada del avatar",
            "Representa un futuro adaptador de ojos y orientación de mirada.",
            CapabilityKind::Presentation,
            "orientAvatarGaze",
        ),
        (
            "output.avatar.body",
            "Controlar cuerpo del avatar",
            "Representa un futuro adaptador de poses y acciones corporales.",
            CapabilityKind::Presentation,
            "animateAvatarBody",
        ),
        (
            "output.external.adapter",
            "Conectar adaptador externo",
            "Representa una futura conexión revisada con VRChat u otro destino.",
            CapabilityKind::Process,
            "connectReviewedAdapter",
        ),
    ]
    .into_iter()
    .map(|(id, label, description, kind, operation)| {
        let is_voice = id == "output.voice.synthesize";
        capability(
            id,
            label,
            if is_voice {
                "Convierte sólo una respuesta visible y confirmada en audio temporal; no guarda audio ni crea recuerdos."
            } else {
                description
            },
            CapabilityDomain::Output,
            kind,
            if is_voice { CapabilityMaturity::Partial } else { CapabilityMaturity::Planned },
            if is_voice { "fish-audio-native" } else { "none" },
            &[operation],
            if is_voice && voice_ready { CapabilityState::Idle } else { CapabilityState::Unavailable },
            CapabilityRisk::Medium,
            if is_voice { &[CapabilityEffect::NetworkSend, CapabilityEffect::CredentialPresenceRead] } else { &[CapabilityEffect::None] },
            if is_voice { &["visibleAssistantText", "audioEphemeral", "auditMetadata"] } else { &[] },
            if is_voice { &["FISH_API_KEY", "ALICE_FISH_REFERENCE_ID", "Confirmación por respuesta"] } else { &["Adaptador real y ADR propia"] },
            permission(
                CapabilityPermissionMode::ExplicitConfirmation,
                if is_voice { CapabilityPermissionEnforcer::Native } else { CapabilityPermissionEnforcer::None },
                if is_voice { "Rust comprueba que el texto pertenece al historial local y exige confirmar cada síntesis." } else { "No existe permiso aplicable porque la capacidad no está implementada." },
            ),
            health(
                if is_voice && voice_ready { CapabilityHealthStatus::Unchecked } else { CapabilityHealthStatus::Unavailable },
                if is_voice && voice_ready { "Adaptador nativo listo; la primera llamada sigue requiriendo tu confirmación." } else if is_voice { "Falta la clave o la identidad de voz local; no se enviará texto." } else { "Capacidad planificada sin adaptador; no se ejecutó ninguna sonda." },
                // Configured is not probed: never timestamp an unchecked service.
                if is_voice && !voice_ready { Some(checked_at) } else { None },
            ),
        )
    })
    .collect()
}

fn memory_records_health(
    probe: &MemoryCapabilityProbe,
) -> (CapabilityState, CapabilityHealthStatus, &'static str) {
    if matches!(
        probe.manifest,
        MemoryResourceState::Error | MemoryResourceState::Invalid
    ) || matches!(
        probe.records,
        MemoryResourceState::Error | MemoryResourceState::Invalid
    ) {
        return (
            CapabilityState::Error,
            CapabilityHealthStatus::Error,
            "La estructura de memoria existe, pero no es válida o no pudo leerse.",
        );
    }
    if !probe.directory_exists
        || probe.manifest == MemoryResourceState::Missing
        || probe.records == MemoryResourceState::Missing
    {
        return (
            CapabilityState::Unavailable,
            CapabilityHealthStatus::Unavailable,
            "La estructura de memoria requerida no está completa y la sonda no creó archivos.",
        );
    }
    (
        CapabilityState::Idle,
        CapabilityHealthStatus::Healthy,
        "El manifiesto y los registros locales son válidos; la sonda no los modificó.",
    )
}

fn permission(
    mode: CapabilityPermissionMode,
    enforced_by: CapabilityPermissionEnforcer,
    summary: &str,
) -> CapabilityPermission {
    CapabilityPermission {
        mode,
        enforced_by,
        summary: summary.to_string(),
    }
}

fn health(
    status: CapabilityHealthStatus,
    summary: impl Into<String>,
    checked_at: Option<&str>,
) -> CapabilityHealth {
    CapabilityHealth {
        status,
        summary: summary.into(),
        checked_at: checked_at.map(str::to_string),
    }
}

#[allow(clippy::too_many_arguments)]
fn capability(
    id: &str,
    label: &str,
    description: &str,
    domain: CapabilityDomain,
    kind: CapabilityKind,
    maturity: CapabilityMaturity,
    adapter: &str,
    operations: &[&str],
    state: CapabilityState,
    risk: CapabilityRisk,
    effects: &[CapabilityEffect],
    data_scopes: &[&str],
    requirements: &[&str],
    permission: CapabilityPermission,
    health: CapabilityHealth,
) -> CapabilityDescriptor {
    CapabilityDescriptor {
        id: id.to_string(),
        version: 1,
        label: label.to_string(),
        description: description.to_string(),
        domain,
        kind,
        maturity,
        adapter: adapter.to_string(),
        operations: operations
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        state,
        risk,
        effects: effects.to_vec(),
        data_scopes: data_scopes
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        requirements: requirements
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        permission,
        health,
        last_execution: None,
    }
}

impl CapabilityRegistrySnapshot {
    pub(crate) fn validate(&self) -> Result<(), String> {
        if self.schema_version != CAPABILITY_REGISTRY_SCHEMA_VERSION {
            return Err(format!(
                "schemaVersion debe ser {}",
                CAPABILITY_REGISTRY_SCHEMA_VERSION
            ));
        }
        validate_timestamp("generatedAt", &self.generated_at)?;

        let mut identifiers = HashSet::with_capacity(self.capabilities.len());
        for capability in &self.capabilities {
            if !identifiers.insert(capability.id.as_str()) {
                return Err(format!(
                    "El identificador de capacidad '{}' está repetido",
                    capability.id
                ));
            }
            capability.validate()?;
        }

        Ok(())
    }
}

impl CapabilityDescriptor {
    fn validate(&self) -> Result<(), String> {
        if !is_valid_capability_id(&self.id) {
            return Err(format!(
                "El identificador de capacidad '{}' no es válido",
                self.id
            ));
        }
        if self.version == 0 {
            return Err(format!(
                "La versión de la capacidad '{}' debe ser positiva",
                self.id
            ));
        }

        validate_text(&self.id, "label", &self.label)?;
        validate_text(&self.id, "description", &self.description)?;
        validate_text(&self.id, "adapter", &self.adapter)?;
        validate_text(&self.id, "permission.summary", &self.permission.summary)?;
        validate_text(&self.id, "health.summary", &self.health.summary)?;
        validate_text_list(&self.id, "operations", &self.operations, true)?;
        validate_text_list(&self.id, "dataScopes", &self.data_scopes, false)?;
        validate_text_list(&self.id, "requirements", &self.requirements, false)?;

        if self.effects.is_empty() {
            return Err(format!(
                "La capacidad '{}' debe declarar al menos un efecto",
                self.id
            ));
        }
        if self.effects.contains(&CapabilityEffect::None) && self.effects.len() != 1 {
            return Err(format!(
                "La capacidad '{}' no puede combinar el efecto 'none' con otros efectos",
                self.id
            ));
        }

        self.validate_health()?;

        if self.last_execution.is_some() {
            return Err(format!(
                "La capacidad '{}' debe mantener lastExecution en null durante R1",
                self.id
            ));
        }

        if self.maturity == CapabilityMaturity::Planned {
            if self.adapter != "none" {
                return Err(format!(
                    "La capacidad planificada '{}' debe usar el adaptador 'none'",
                    self.id
                ));
            }
            if self.state != CapabilityState::Unavailable {
                return Err(format!(
                    "La capacidad planificada '{}' debe estar unavailable",
                    self.id
                ));
            }
            if self.health.status != CapabilityHealthStatus::Unavailable
                || self.health.checked_at.is_some()
            {
                return Err(format!(
                    "La capacidad planificada '{}' debe informar salud unavailable sin sonda",
                    self.id
                ));
            }
        } else if self.adapter == "none" {
            return Err(format!(
                "La capacidad implementada o parcial '{}' debe declarar un adaptador real",
                self.id
            ));
        }

        if self.state == CapabilityState::Active
            && (self.health.checked_at.is_none()
                || !matches!(
                    self.health.status,
                    CapabilityHealthStatus::Healthy | CapabilityHealthStatus::Degraded
                ))
        {
            return Err(format!(
                "La capacidad activa '{}' requiere una comprobación real y vigente",
                self.id
            ));
        }

        if self.state == CapabilityState::Degraded
            && self.health.status != CapabilityHealthStatus::Degraded
        {
            return Err(format!(
                "La capacidad degradada '{}' debe informar salud degraded",
                self.id
            ));
        }

        if self.state == CapabilityState::Error
            && self.health.status != CapabilityHealthStatus::Error
        {
            return Err(format!(
                "La capacidad con error '{}' debe informar salud error",
                self.id
            ));
        }

        Ok(())
    }

    fn validate_health(&self) -> Result<(), String> {
        if let Some(checked_at) = &self.health.checked_at {
            validate_timestamp("health.checkedAt", checked_at)?;
        }

        match self.health.status {
            CapabilityHealthStatus::Unchecked if self.health.checked_at.is_some() => Err(format!(
                "La salud unchecked de '{}' no puede tener checkedAt",
                self.id
            )),
            CapabilityHealthStatus::Healthy
            | CapabilityHealthStatus::Degraded
            | CapabilityHealthStatus::Error
                if self.health.checked_at.is_none() =>
            {
                Err(format!(
                    "La salud {:?} de '{}' requiere checkedAt",
                    self.health.status, self.id
                ))
            }
            _ => Ok(()),
        }
    }
}

fn validate_text(capability_id: &str, field: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!(
            "El campo {field} de la capacidad '{capability_id}' no puede estar vacío"
        ));
    }
    Ok(())
}

fn validate_text_list(
    capability_id: &str,
    field: &str,
    values: &[String],
    required: bool,
) -> Result<(), String> {
    if required && values.is_empty() {
        return Err(format!(
            "La capacidad '{capability_id}' debe declarar al menos un valor en {field}"
        ));
    }
    if values.iter().any(|value| value.trim().is_empty()) {
        return Err(format!(
            "La capacidad '{capability_id}' contiene un valor vacío en {field}"
        ));
    }
    Ok(())
}

fn is_valid_capability_id(value: &str) -> bool {
    let segments: Vec<_> = value.split('.').collect();
    segments.len() >= 2
        && segments.iter().all(|segment| {
            let mut characters = segment.chars();
            characters
                .next()
                .is_some_and(|first| first.is_ascii_lowercase())
                && characters
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        })
}

pub(crate) fn validate_timestamp(field: &str, value: &str) -> Result<(), String> {
    if is_iso_8601_timestamp(value) {
        Ok(())
    } else {
        Err(format!("El campo {field} debe contener una fecha ISO-8601"))
    }
}

fn is_iso_8601_timestamp(value: &str) -> bool {
    if !value.is_ascii() {
        return false;
    }

    let Some((date, time_with_zone)) = value.split_once('T') else {
        return false;
    };
    if !is_valid_date(date) {
        return false;
    }

    let time = if let Some(value) = time_with_zone.strip_suffix('Z') {
        value
    } else if time_with_zone.len() >= 6 {
        let zone_start = time_with_zone.len() - 6;
        let (candidate_time, zone) = time_with_zone.split_at(zone_start);
        if !is_valid_timezone(zone) {
            return false;
        }
        candidate_time
    } else {
        return false;
    };

    is_valid_time(time)
}

fn is_valid_date(value: &str) -> bool {
    if value.len() != 10 || &value[4..5] != "-" || &value[7..8] != "-" {
        return false;
    }

    let Some(year) = parse_number(&value[0..4]) else {
        return false;
    };
    let Some(month) = parse_number(&value[5..7]) else {
        return false;
    };
    let Some(day) = parse_number(&value[8..10]) else {
        return false;
    };
    if year == 0 || !(1..=12).contains(&month) {
        return false;
    }

    let days_in_month = match month {
        2 if is_leap_year(year) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    (1..=days_in_month).contains(&day)
}

fn is_valid_time(value: &str) -> bool {
    let mut parts = value.split(':');
    let (Some(hours), Some(minutes), Some(seconds), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };

    let Some(hours) = parse_number(hours) else {
        return false;
    };
    let Some(minutes) = parse_number(minutes) else {
        return false;
    };
    let (whole_seconds, fraction) = seconds
        .split_once('.')
        .map_or((seconds, None), |(whole, fraction)| (whole, Some(fraction)));
    let Some(seconds) = parse_number(whole_seconds) else {
        return false;
    };

    hours <= 23
        && minutes <= 59
        && seconds <= 59
        && fraction.is_none_or(|value| {
            !value.is_empty() && value.chars().all(|character| character.is_ascii_digit())
        })
}

fn is_valid_timezone(value: &str) -> bool {
    value.len() == 6
        && matches!(&value[0..1], "+" | "-")
        && &value[3..4] == ":"
        && parse_number(&value[1..3]).is_some_and(|hours| hours <= 23)
        && parse_number(&value[4..6]).is_some_and(|minutes| minutes <= 59)
}

fn parse_number(value: &str) -> Option<u32> {
    (!value.is_empty() && value.chars().all(|character| character.is_ascii_digit()))
        .then(|| value.parse().ok())
        .flatten()
}

fn is_leap_year(year: u32) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn implemented_capability() -> CapabilityDescriptor {
        CapabilityDescriptor {
            id: "memory.records.read".into(),
            version: 1,
            label: "Leer memoria".into(),
            description: "Lee y valida los registros locales existentes.".into(),
            domain: CapabilityDomain::Memory,
            kind: CapabilityKind::Query,
            maturity: CapabilityMaturity::Partial,
            adapter: "memory".into(),
            operations: vec!["loadValidatedRecords".into()],
            state: CapabilityState::Idle,
            risk: CapabilityRisk::Medium,
            effects: vec![CapabilityEffect::LocalRead],
            data_scopes: vec!["memoryRecords".into()],
            requirements: vec!["Directorio de memoria válido".into()],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ImplicitRead,
                enforced_by: CapabilityPermissionEnforcer::CurrentUi,
                summary: "Lectura iniciada por la interfaz actual.".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Healthy,
                summary: "Estructura local disponible.".into(),
                checked_at: Some("2026-08-08T18:00:00-03:00".into()),
            },
            last_execution: None,
        }
    }

    fn planned_capability() -> CapabilityDescriptor {
        CapabilityDescriptor {
            id: "output.voice.synthesize".into(),
            version: 1,
            label: "Síntesis de voz".into(),
            description: "Representa un puente futuro todavía sin adaptador.".into(),
            domain: CapabilityDomain::Output,
            kind: CapabilityKind::Presentation,
            maturity: CapabilityMaturity::Planned,
            adapter: "none".into(),
            operations: vec!["synthesizeAuthorizedText".into()],
            state: CapabilityState::Unavailable,
            risk: CapabilityRisk::Low,
            effects: vec![CapabilityEffect::None],
            data_scopes: vec!["authorizedText".into()],
            requirements: vec!["Adaptador de voz revisado".into()],
            permission: CapabilityPermission {
                mode: CapabilityPermissionMode::ExplicitConfirmation,
                enforced_by: CapabilityPermissionEnforcer::None,
                summary: "No existe control porque el adaptador no está implementado.".into(),
            },
            health: CapabilityHealth {
                status: CapabilityHealthStatus::Unavailable,
                summary: "Capacidad planificada sin adaptador.".into(),
                checked_at: None,
            },
            last_execution: None,
        }
    }

    fn snapshot(capabilities: Vec<CapabilityDescriptor>) -> CapabilityRegistrySnapshot {
        CapabilityRegistrySnapshot {
            schema_version: CAPABILITY_REGISTRY_SCHEMA_VERSION,
            generated_at: "2026-08-08T18:00:00-03:00".into(),
            capabilities,
        }
    }

    fn unavailable_probes() -> CapabilityProbeSnapshot {
        CapabilityProbeSnapshot {
            gemma_installed: false,
            document_available: false,
            cloud: CloudCapabilityProbe {
                provider_count: 6,
                configured_provider_count: 0,
                ollama_configured: false,
            },
            observation: Ok(ObservationCapabilityProbe {
                enabled: false,
                has_latest_context: false,
            }),
            memory: MemoryCapabilityProbe {
                directory_exists: false,
                manifest: MemoryResourceState::Missing,
                records: MemoryResourceState::Missing,
                backup: MemoryResourceState::Missing,
            },
            avatar: Ok(AvatarCapabilityProbe {
                available: false,
                size_bytes: 0,
            }),
            sensory: Err("runtime sensorial no disponible en fixture".into()),
            tasks: TaskCapabilityProbe {
                state: TaskRegistryState::Missing,
                task_count: 0,
            },
        }
    }

    fn registry(probes: &CapabilityProbeSnapshot) -> CapabilityRegistrySnapshot {
        capability_registry_from_probes("2026-08-08T18:00:00-03:00".into(), probes)
            .expect("valid capability registry")
    }

    fn registered<'a>(
        snapshot: &'a CapabilityRegistrySnapshot,
        id: &str,
    ) -> &'a CapabilityDescriptor {
        snapshot
            .capabilities
            .iter()
            .find(|capability| capability.id == id)
            .expect("registered capability")
    }

    #[test]
    fn snapshot_serializes_the_camel_case_contract() {
        let value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();

        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["generatedAt"], "2026-08-08T18:00:00-03:00");
        assert_eq!(value["capabilities"][0]["dataScopes"][0], "memoryRecords");
        assert_eq!(
            value["capabilities"][0]["permission"]["enforcedBy"],
            "currentUi"
        );
        assert_eq!(
            value["capabilities"][0]["health"]["checkedAt"],
            "2026-08-08T18:00:00-03:00"
        );
        assert_eq!(value["capabilities"][0]["lastExecution"], json!(null));
    }

    #[test]
    fn enumerations_serialize_the_approved_values() {
        assert_eq!(
            serde_json::to_value([
                CapabilityDomain::Cloud,
                CapabilityDomain::Context,
                CapabilityDomain::Perception,
                CapabilityDomain::Memory,
                CapabilityDomain::Avatar,
                CapabilityDomain::Task,
                CapabilityDomain::Output,
            ])
            .unwrap(),
            json!([
                "cloud",
                "context",
                "perception",
                "memory",
                "avatar",
                "task",
                "output"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityKind::Observation,
                CapabilityKind::Query,
                CapabilityKind::Mutation,
                CapabilityKind::Export,
                CapabilityKind::Process,
                CapabilityKind::Presentation,
            ])
            .unwrap(),
            json!([
                "observation",
                "query",
                "mutation",
                "export",
                "process",
                "presentation"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityMaturity::Implemented,
                CapabilityMaturity::Partial,
                CapabilityMaturity::Planned,
            ])
            .unwrap(),
            json!(["implemented", "partial", "planned"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityState::Unavailable,
                CapabilityState::Disabled,
                CapabilityState::Idle,
                CapabilityState::Active,
                CapabilityState::Degraded,
                CapabilityState::Error,
            ])
            .unwrap(),
            json!([
                "unavailable",
                "disabled",
                "idle",
                "active",
                "degraded",
                "error"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityRisk::None,
                CapabilityRisk::Low,
                CapabilityRisk::Medium,
                CapabilityRisk::High,
                CapabilityRisk::Critical,
            ])
            .unwrap(),
            json!(["none", "low", "medium", "high", "critical"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityEffect::None,
                CapabilityEffect::LocalRead,
                CapabilityEffect::LocalWrite,
                CapabilityEffect::NetworkSend,
                CapabilityEffect::ProcessLaunch,
                CapabilityEffect::WindowMetadataRead,
                CapabilityEffect::CredentialPresenceRead,
                CapabilityEffect::AssetRender,
            ])
            .unwrap(),
            json!([
                "none",
                "localRead",
                "localWrite",
                "networkSend",
                "processLaunch",
                "windowMetadataRead",
                "credentialPresenceRead",
                "assetRender"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityHealthStatus::Unchecked,
                CapabilityHealthStatus::Healthy,
                CapabilityHealthStatus::Degraded,
                CapabilityHealthStatus::Unavailable,
                CapabilityHealthStatus::Error,
            ])
            .unwrap(),
            json!(["unchecked", "healthy", "degraded", "unavailable", "error"])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityPermissionMode::ImplicitRead,
                CapabilityPermissionMode::SessionOptIn,
                CapabilityPermissionMode::ExplicitPreview,
                CapabilityPermissionMode::ExplicitConfirmation,
            ])
            .unwrap(),
            json!([
                "implicitRead",
                "sessionOptIn",
                "explicitPreview",
                "explicitConfirmation"
            ])
        );
        assert_eq!(
            serde_json::to_value([
                CapabilityPermissionEnforcer::Native,
                CapabilityPermissionEnforcer::CurrentUi,
                CapabilityPermissionEnforcer::OperatingSystem,
                CapabilityPermissionEnforcer::None,
            ])
            .unwrap(),
            json!(["native", "currentUi", "operatingSystem", "none"])
        );
    }

    #[test]
    fn validation_accepts_implemented_and_planned_capabilities() {
        assert_eq!(
            snapshot(vec![implemented_capability(), planned_capability()]).validate(),
            Ok(())
        );
    }

    #[test]
    fn validation_rejects_unknown_schema_and_duplicate_ids() {
        let mut invalid_schema = snapshot(vec![]);
        invalid_schema.schema_version = 2;
        assert_eq!(
            invalid_schema.validate(),
            Err("schemaVersion debe ser 1".into())
        );

        let duplicate = implemented_capability();
        assert!(snapshot(vec![duplicate.clone(), duplicate])
            .validate()
            .unwrap_err()
            .contains("está repetido"));
    }

    #[test]
    fn validation_rejects_invalid_ids_versions_and_timestamps() {
        let mut capability = implemented_capability();
        capability.id = "Memory.records.read".into();
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("no es válido"));

        let mut capability = implemented_capability();
        capability.version = 0;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("debe ser positiva"));

        let mut invalid_date = snapshot(vec![]);
        invalid_date.generated_at = "2026-02-30T18:00:00Z".into();
        assert!(invalid_date.validate().is_err());
    }

    #[test]
    fn validation_enforces_planned_capability_invariants() {
        let mut capability = planned_capability();
        capability.adapter = "voice".into();
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("adaptador 'none'"));

        let mut capability = planned_capability();
        capability.state = CapabilityState::Idle;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("debe estar unavailable"));

        let mut capability = planned_capability();
        capability.health.checked_at = Some("2026-08-08T18:00:00Z".into());
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("sin sonda"));
    }

    #[test]
    fn validation_requires_real_health_evidence_for_active_state() {
        let mut capability = implemented_capability();
        capability.state = CapabilityState::Active;
        capability.health.status = CapabilityHealthStatus::Unchecked;
        capability.health.checked_at = None;
        assert!(snapshot(vec![capability])
            .validate()
            .unwrap_err()
            .contains("comprobación real y vigente"));
    }

    #[test]
    fn validation_keeps_last_execution_null_during_r1() {
        let mut value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();
        value["capabilities"][0]["lastExecution"] = json!({
            "correlationId": "event-1",
            "occurredAt": "2026-08-08T18:00:00Z",
            "outcome": "succeeded"
        });

        assert!(serde_json::from_value::<CapabilityRegistrySnapshot>(value).is_err());
    }

    #[test]
    fn deserialization_rejects_unknown_fields() {
        let mut value = serde_json::to_value(snapshot(vec![implemented_capability()])).unwrap();
        value["capabilities"][0]["inventedTelemetry"] = json!(42);

        assert!(serde_json::from_value::<CapabilityRegistrySnapshot>(value).is_err());
    }

    #[test]
    fn voice_configuration_never_claims_an_unperformed_health_check() {
        let checked_at = "2026-09-16T12:00:00Z";
        for ready in [false, true] {
            let outputs = output_capabilities_for_configuration(checked_at, ready);
            let voice = outputs
                .iter()
                .find(|item| item.id == "output.voice.synthesize")
                .unwrap();
            assert!(voice.validate().is_ok());
            assert_eq!(
                voice.health.status,
                if ready {
                    CapabilityHealthStatus::Unchecked
                } else {
                    CapabilityHealthStatus::Unavailable
                }
            );
            assert_eq!(
                voice.health.checked_at.as_deref(),
                if ready { None } else { Some(checked_at) }
            );
            assert!(voice.last_execution.is_none());
        }
    }

    #[test]
    fn registry_contains_the_approved_inventory_without_invented_activity() {
        let snapshot = registry(&unavailable_probes());

        assert_eq!(snapshot.capabilities.len(), 42);
        let hybrid = registered(&snapshot, "memory.retrieval.hybrid.preview");
        assert_eq!(hybrid.operations, vec!["preview_hybrid_memory_retrieval"]);
        assert_eq!(
            hybrid.permission.mode,
            CapabilityPermissionMode::ExplicitPreview
        );
        assert!(!hybrid.effects.contains(&CapabilityEffect::LocalWrite));
        let conversation_learning = registered(&snapshot, "memory.conversationlearning.propose");
        assert_eq!(
            conversation_learning.operations,
            vec!["preview_conversation_learning"]
        );
        assert_eq!(
            conversation_learning.permission.mode,
            CapabilityPermissionMode::ExplicitPreview
        );
        assert!(!conversation_learning
            .effects
            .contains(&CapabilityEffect::LocalWrite));
        let graph = registered(&snapshot, "memory.graph.inspect");
        assert_eq!(
            graph.operations,
            vec![
                "knowledge_graph_snapshot",
                "preview_knowledge_graph_association",
                "knowledge_graph_associations"
            ]
        );
        assert_eq!(graph.effects, vec![CapabilityEffect::LocalRead]);
        assert_eq!(
            graph.permission.enforced_by,
            CapabilityPermissionEnforcer::Native
        );
        assert_eq!(graph.state, CapabilityState::Unavailable);
        assert_eq!(
            registered(&snapshot, "cloud.providers.inspect").state,
            CapabilityState::Idle
        );
        assert_eq!(
            registered(&snapshot, "cloud.conversation.send").state,
            CapabilityState::Unavailable
        );
        assert_eq!(
            registered(&snapshot, "context.foreground.control").state,
            CapabilityState::Disabled
        );
        assert_eq!(
            registered(&snapshot, "memory.records.read").state,
            CapabilityState::Unavailable
        );
        assert_eq!(
            registered(&snapshot, "memory.working.manage").state,
            CapabilityState::Idle
        );
        assert_eq!(
            registered(&snapshot, "memory.working.manage").maturity,
            CapabilityMaturity::Implemented
        );
        let conversation_history = registered(&snapshot, "memory.conversation.history");
        assert_eq!(conversation_history.domain, CapabilityDomain::Memory);
        assert_eq!(conversation_history.kind, CapabilityKind::Mutation);
        assert_eq!(
            conversation_history.effects,
            vec![CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite]
        );
        assert_eq!(
            registered(&snapshot, "avatar.vrm.render").state,
            CapabilityState::Unavailable
        );
        let tasks = registered(&snapshot, "tasks.registry.inspect");
        assert_eq!(tasks.domain, CapabilityDomain::Task);
        assert_eq!(tasks.state, CapabilityState::Unavailable);
        assert_eq!(tasks.operations, vec!["task_registry_status"]);
        assert_eq!(tasks.effects, vec![CapabilityEffect::LocalRead]);
        assert_eq!(
            tasks.permission.enforced_by,
            CapabilityPermissionEnforcer::Native
        );
        let read_check = registered(&snapshot, "tasks.capability.readcheck");
        assert_eq!(read_check.domain, CapabilityDomain::Task);
        assert_eq!(read_check.kind, CapabilityKind::Query);
        assert_eq!(
            read_check.operations,
            vec!["run_read_only_capability_check"]
        );
        assert_eq!(read_check.effects, vec![CapabilityEffect::LocalRead]);
        let task_write = registered(&snapshot, "tasks.registry.write");
        assert_eq!(task_write.domain, CapabilityDomain::Task);
        assert_eq!(task_write.state, CapabilityState::Idle);
        assert_eq!(task_write.kind, CapabilityKind::Mutation);
        assert_eq!(
            task_write.operations,
            vec!["preview_task_mutation", "confirm_task_mutation"]
        );
        assert_eq!(
            task_write.effects,
            vec![CapabilityEffect::LocalRead, CapabilityEffect::LocalWrite]
        );
        assert_eq!(
            task_write.permission.mode,
            CapabilityPermissionMode::ExplicitConfirmation
        );
        let temporal = registered(&snapshot, "tasks.temporal.evaluate");
        assert_eq!(temporal.domain, CapabilityDomain::Task);
        assert_eq!(temporal.state, CapabilityState::Disabled);
        assert_eq!(temporal.kind, CapabilityKind::Observation);
        assert_eq!(
            temporal.operations,
            vec!["task_engine_status", "set_task_engine_enabled"]
        );
        assert_eq!(temporal.effects, vec![CapabilityEffect::LocalRead]);
        assert_eq!(
            temporal.permission.enforced_by,
            CapabilityPermissionEnforcer::CurrentUi
        );
        let reservation = registered(&snapshot, "tasks.dispatch.reserve");
        assert_eq!(reservation.domain, CapabilityDomain::Task);
        assert_eq!(reservation.kind, CapabilityKind::Mutation);
        assert_eq!(
            reservation.operations,
            vec!["task_attempt_ledger_status", "reserve_task_attempt"]
        );
        assert_eq!(
            reservation.permission.mode,
            CapabilityPermissionMode::ExplicitConfirmation
        );
        let notification = registered(&snapshot, "tasks.notification.deliver");
        assert_eq!(notification.domain, CapabilityDomain::Task);
        assert_eq!(notification.kind, CapabilityKind::Presentation);
        assert_eq!(notification.operations, vec!["dispatch_task_notification"]);
        assert!(notification
            .effects
            .contains(&CapabilityEffect::UserNotification));

        let planned = snapshot
            .capabilities
            .iter()
            .filter(|capability| capability.maturity == CapabilityMaturity::Planned)
            .collect::<Vec<_>>();
        assert_eq!(planned.len(), 8);
        assert!(planned.iter().all(|capability| {
            capability.state == CapabilityState::Unavailable
                && capability.adapter == "none"
                && capability.last_execution.is_none()
                && capability.health.checked_at.is_none()
        }));
        let voice = registered(&snapshot, "output.voice.synthesize");
        assert_eq!(voice.maturity, CapabilityMaturity::Partial);
        assert_eq!(voice.adapter, "fish-audio-native");
        assert_eq!(
            voice.permission.mode,
            CapabilityPermissionMode::ExplicitConfirmation
        );
        assert_eq!(
            voice.permission.enforced_by,
            CapabilityPermissionEnforcer::Native
        );
        assert!(voice.effects.contains(&CapabilityEffect::NetworkSend));
        let voice_input = registered(&snapshot, "perception.voice.transcribe");
        assert_eq!(voice_input.maturity, CapabilityMaturity::Partial);
        assert_eq!(voice_input.operations, vec!["transcribe_voice_turn"]);
        assert!(voice_input
            .effects
            .contains(&CapabilityEffect::MicrophoneObserve));

        for id in [
            "perception.media.inspect",
            "perception.desktop.observe",
            "perception.face.landmarks",
        ] {
            let capability = registered(&snapshot, id);
            assert_eq!(capability.domain, CapabilityDomain::Perception);
            assert_eq!(capability.risk, CapabilityRisk::High);
            assert_eq!(capability.effects, vec![CapabilityEffect::None]);
            assert_eq!(
                capability.permission.mode,
                CapabilityPermissionMode::SessionOptIn
            );
        }

        let screen = registered(&snapshot, "perception.screen.observe");
        assert_eq!(screen.maturity, CapabilityMaturity::Partial);
        assert_eq!(screen.state, CapabilityState::Idle);
        assert_eq!(screen.health.status, CapabilityHealthStatus::Healthy);
        assert_eq!(
            screen.effects,
            vec![CapabilityEffect::ScreenObserve, CapabilityEffect::LocalRead]
        );
        assert_eq!(
            screen.permission.enforced_by,
            CapabilityPermissionEnforcer::OperatingSystem
        );
        assert_eq!(screen.operations, vec!["analyze_screen_frame"]);

        let facial = registered(&snapshot, "perception.face.landmarks");
        assert_eq!(facial.operations, vec!["deriveAuthorizedFaceLandmarks"]);
        assert_eq!(facial.data_scopes, vec!["facialLandmarksEphemeral"]);
        assert!(facial
            .requirements
            .iter()
            .any(|requirement| requirement.contains("permiso facial R2 específico")));
        assert!(snapshot
            .capabilities
            .iter()
            .all(|capability| capability.id != "perception.gesture.derive"));

        for (id, effect) in [
            ("perception.camera.observe", CapabilityEffect::CameraObserve),
            (
                "perception.microphone.observe",
                CapabilityEffect::MicrophoneObserve,
            ),
        ] {
            let capability = registered(&snapshot, id);
            assert_eq!(capability.maturity, CapabilityMaturity::Partial);
            assert_eq!(capability.state, CapabilityState::Degraded);
            assert_eq!(capability.health.status, CapabilityHealthStatus::Degraded);
            assert_eq!(
                capability.permission.enforced_by,
                CapabilityPermissionEnforcer::Native
            );
            assert_eq!(
                capability.effects,
                vec![effect, CapabilityEffect::ProcessLaunch]
            );
        }
    }

    #[test]
    fn registry_maps_configured_active_and_valid_probe_states() {
        let mut probes = unavailable_probes();
        probes.gemma_installed = true;
        probes.cloud.configured_provider_count = 1;
        probes.cloud.ollama_configured = true;
        probes.observation = Ok(ObservationCapabilityProbe {
            enabled: true,
            has_latest_context: false,
        });
        probes.memory = MemoryCapabilityProbe {
            directory_exists: true,
            manifest: MemoryResourceState::Valid,
            records: MemoryResourceState::Valid,
            backup: MemoryResourceState::Valid,
        };
        probes.avatar = Ok(AvatarCapabilityProbe {
            available: true,
            size_bytes: 42,
        });
        let snapshot = registry(&probes);

        for id in [
            "cloud.conversation.send",
            "context.foreground.read",
            "memory.records.read",
            "memory.records.write",
            "memory.records.export",
            "memory.records.restore",
            "memory.directory.open",
            "memory.retrieval.lexical",
            "memory.retrieval.hybrid.preview",
            "memory.learning.propose",
            "memory.conversationlearning.propose",
            "avatar.vrm.inspect",
            "avatar.vrm.render",
        ] {
            assert_eq!(
                registered(&snapshot, id).state,
                CapabilityState::Idle,
                "{id}"
            );
        }
        let observation = registered(&snapshot, "context.foreground.control");
        assert_eq!(observation.state, CapabilityState::Active);
        assert_eq!(
            observation.permission.enforced_by,
            CapabilityPermissionEnforcer::Native
        );
        assert_eq!(
            observation.operations,
            vec!["execute_context_observation_grant"]
        );
        assert_eq!(
            registered(&snapshot, "context.foreground.read")
                .permission
                .enforced_by,
            CapabilityPermissionEnforcer::Native
        );
        assert_eq!(
            registered(&snapshot, "memory.records.restore").operations,
            vec![
                "restore_memory_backup",
                "rollback_layered_memory",
                "restore_consolidation_transaction"
            ]
        );
        assert_eq!(
            observation.health.checked_at.as_deref(),
            Some("2026-08-08T18:00:00-03:00")
        );
    }

    #[test]
    fn registry_reports_invalid_memory_and_probe_failures_as_errors() {
        let mut probes = unavailable_probes();
        probes.memory.directory_exists = true;
        probes.memory.manifest = MemoryResourceState::Valid;
        probes.memory.records = MemoryResourceState::Invalid;
        probes.memory.backup = MemoryResourceState::Invalid;
        probes.observation = Err("Estado de observación no disponible".into());
        probes.avatar = Err("Ruta de avatar no válida".into());
        let snapshot = registry(&probes);

        for id in [
            "memory.records.read",
            "memory.records.restore",
            "context.foreground.control",
            "avatar.vrm.inspect",
        ] {
            assert_eq!(registered(&snapshot, id).state, CapabilityState::Error);
            assert_eq!(
                registered(&snapshot, id).health.status,
                CapabilityHealthStatus::Error
            );
        }
    }

    #[test]
    fn collecting_probes_does_not_create_a_missing_data_root() {
        let root = std::env::temp_dir().join(format!(
            "alice-registry-probe-missing-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        assert!(!root.exists());

        let probes = CapabilityProbeSnapshot::collect(
            &root,
            &ObservationStore::default(),
            &SensorLeaseStore::default(),
        );
        let snapshot = registry(&probes);

        assert_eq!(snapshot.capabilities.len(), 42);
        assert!(!root.exists());
    }

    #[test]
    fn registry_generation_is_idempotent_for_the_same_timestamp_and_probes() {
        let probes = unavailable_probes();

        assert_eq!(registry(&probes), registry(&probes));
    }

    #[test]
    fn utc_timestamp_formatter_handles_epoch_leap_day_and_day_boundary() {
        assert_eq!(format_utc_timestamp(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_utc_timestamp(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(format_utc_timestamp(1_704_067_199), "2023-12-31T23:59:59Z");
    }
}
