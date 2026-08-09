use crate::audit::audit_diagnostic_probe;
use crate::avatar::{avatar_capability_probe, AvatarCapabilityProbe};
use crate::cloud::cloud_configuration_probe;
use crate::memory::{memory_capability_probe, MemoryResourceState};
use crate::observation::{ObservationCapabilityProbe, ObservationStore};
use crate::permissions::{PermissionDiagnosticProbe, PermissionGateway};
use crate::sensory::{sensor_runtime_available, SensorLeaseStore};
use crate::util::{alice_data_root_path, timestamp_ms};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

const DIAGNOSTIC_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DiagnosticCategory {
    Path,
    DataVersion,
    Provider,
    Adapter,
    Permission,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DiagnosticStatus {
    Healthy,
    ConfigurationPending,
    Unavailable,
    Error,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DiagnosticOverallStatus {
    Healthy,
    Attention,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiagnosticCheck {
    id: String,
    category: DiagnosticCategory,
    label: String,
    status: DiagnosticStatus,
    summary: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiagnosticSummary {
    total: usize,
    healthy: usize,
    configuration_pending: usize,
    unavailable: usize,
    errors: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DiagnosticSnapshot {
    schema_version: u32,
    generated_at_ms: u64,
    overall_status: DiagnosticOverallStatus,
    summary: DiagnosticSummary,
    checks: Vec<DiagnosticCheck>,
}

#[derive(Clone)]
struct DiagnosticInputs {
    data_root: PathBuf,
    providers: Vec<(String, String, Result<bool, String>)>,
    observation: Result<ObservationCapabilityProbe, String>,
    avatar: Result<AvatarCapabilityProbe, String>,
    sensor_runtime: Result<bool, String>,
    sensor_activity: Result<(bool, bool), String>,
    permission: Result<PermissionDiagnosticProbe, String>,
}

fn check(
    id: impl Into<String>,
    category: DiagnosticCategory,
    label: impl Into<String>,
    status: DiagnosticStatus,
    summary: impl Into<String>,
) -> DiagnosticCheck {
    DiagnosticCheck {
        id: id.into(),
        category,
        label: label.into(),
        status,
        summary: summary.into(),
    }
}

fn path_check(data_root: &Path) -> DiagnosticCheck {
    let (status, summary) = if data_root.is_dir() {
        (
            DiagnosticStatus::Healthy,
            format!("Ruta local disponible: {}", data_root.display()),
        )
    } else if data_root.exists() {
        (
            DiagnosticStatus::Error,
            format!(
                "La ruta existe pero no es una carpeta: {}",
                data_root.display()
            ),
        )
    } else {
        (
            DiagnosticStatus::ConfigurationPending,
            format!("La carpeta todavía no existe: {}", data_root.display()),
        )
    };
    check(
        "path.data-root",
        DiagnosticCategory::Path,
        "Directorio de datos",
        status,
        summary,
    )
}

fn audit_checks(data_root: &Path) -> Vec<DiagnosticCheck> {
    let path = data_root.join("audit").join("events-v1.jsonl");
    match audit_diagnostic_probe(data_root) {
        Ok(probe) if !probe.exists => vec![
            check(
                "path.audit-r3",
                DiagnosticCategory::Path,
                "Archivo de auditoría R3",
                DiagnosticStatus::ConfigurationPending,
                format!("Se creará con el primer evento: {}", path.display()),
            ),
            check(
                "version.audit-v1",
                DiagnosticCategory::DataVersion,
                "Esquema de auditoría v1",
                DiagnosticStatus::ConfigurationPending,
                "Todavía no existe un archivo para validar.",
            ),
        ],
        Ok(probe) => {
            let status = if probe.invalid_lines == 0 {
                DiagnosticStatus::Healthy
            } else {
                DiagnosticStatus::Error
            };
            vec![
                check(
                    "path.audit-r3",
                    DiagnosticCategory::Path,
                    "Archivo de auditoría R3",
                    DiagnosticStatus::Healthy,
                    format!(
                        "{} bytes actuales y {} bytes rotados en {}",
                        probe.current_bytes,
                        probe.rotated_bytes,
                        path.display()
                    ),
                ),
                check(
                    "version.audit-v1",
                    DiagnosticCategory::DataVersion,
                    "Esquema de auditoría v1",
                    status,
                    format!(
                        "{} eventos válidos; {} líneas inválidas.",
                        probe.valid_events, probe.invalid_lines
                    ),
                ),
            ]
        }
        Err(error) => vec![check(
            "version.audit-v1",
            DiagnosticCategory::DataVersion,
            "Esquema de auditoría v1",
            DiagnosticStatus::Error,
            format!("No se pudo inspeccionar: {error}"),
        )],
    }
}

fn resource_status(state: MemoryResourceState) -> DiagnosticStatus {
    match state {
        MemoryResourceState::Valid => DiagnosticStatus::Healthy,
        MemoryResourceState::Missing => DiagnosticStatus::ConfigurationPending,
        MemoryResourceState::Invalid | MemoryResourceState::Error => DiagnosticStatus::Error,
    }
}

fn resource_label(state: MemoryResourceState) -> &'static str {
    match state {
        MemoryResourceState::Valid => "válido",
        MemoryResourceState::Missing => "pendiente",
        MemoryResourceState::Invalid => "inválido",
        MemoryResourceState::Error => "no legible",
    }
}

fn memory_checks(data_root: &Path) -> Vec<DiagnosticCheck> {
    let probe = memory_capability_probe(data_root);
    let directory = data_root.join("memory");
    vec![
        check(
            "path.memory",
            DiagnosticCategory::Path,
            "Directorio de memoria",
            if probe.directory_exists {
                DiagnosticStatus::Healthy
            } else {
                DiagnosticStatus::ConfigurationPending
            },
            format!("Ruta local: {}", directory.display()),
        ),
        check(
            "version.memory-v1",
            DiagnosticCategory::DataVersion,
            "Manifiesto de memoria v1",
            resource_status(probe.manifest),
            format!("Manifest: {}.", resource_label(probe.manifest)),
        ),
        check(
            "data.memory-records",
            DiagnosticCategory::DataVersion,
            "Registros de memoria",
            resource_status(probe.records),
            format!("records.json: {}.", resource_label(probe.records)),
        ),
        check(
            "data.memory-backup",
            DiagnosticCategory::DataVersion,
            "Respaldo de memoria",
            resource_status(probe.backup),
            format!("Respaldo vigente: {}.", resource_label(probe.backup)),
        ),
    ]
}

fn provider_checks(providers: Vec<(String, String, Result<bool, String>)>) -> Vec<DiagnosticCheck> {
    providers
        .into_iter()
        .map(|(id, label, configured)| {
            let (status, summary) = match configured {
                Ok(true) => (
                    DiagnosticStatus::Healthy,
                    "Configuración presente; no se realizó ninguna conexión.".to_string(),
                ),
                Ok(false) => (
                    DiagnosticStatus::ConfigurationPending,
                    "Sin configuración completa; esto no es un fallo de red.".to_string(),
                ),
                Err(error) => (DiagnosticStatus::Error, error),
            };
            check(
                format!("provider.{id}"),
                DiagnosticCategory::Provider,
                label,
                status,
                summary,
            )
        })
        .collect()
}

fn adapter_checks(inputs: &DiagnosticInputs) -> Vec<DiagnosticCheck> {
    let observation = match &inputs.observation {
        Ok(probe) => check(
            "adapter.foreground",
            DiagnosticCategory::Adapter,
            "Observador de ventana",
            DiagnosticStatus::Healthy,
            format!(
                "Adaptador disponible; sesión {} y contexto {}.",
                if probe.enabled { "activa" } else { "inactiva" },
                if probe.has_latest_context {
                    "presente"
                } else {
                    "ausente"
                }
            ),
        ),
        Err(error) => check(
            "adapter.foreground",
            DiagnosticCategory::Adapter,
            "Observador de ventana",
            DiagnosticStatus::Error,
            format!("No se pudo leer el estado: {error}"),
        ),
    };
    let avatar = match &inputs.avatar {
        Ok(probe) if probe.available => check(
            "adapter.avatar",
            DiagnosticCategory::Adapter,
            "Avatar VRM",
            DiagnosticStatus::Healthy,
            format!("Archivo privado disponible; {} bytes.", probe.size_bytes),
        ),
        Ok(_) => check(
            "adapter.avatar",
            DiagnosticCategory::Adapter,
            "Avatar VRM",
            DiagnosticStatus::ConfigurationPending,
            "No se encontró el archivo VRM configurado.",
        ),
        Err(error) => check(
            "adapter.avatar",
            DiagnosticCategory::Adapter,
            "Avatar VRM",
            DiagnosticStatus::Error,
            format!("Configuración inválida: {error}"),
        ),
    };
    let sensory = match inputs.sensor_runtime {
        Ok(true) => {
            let activity = match inputs.sensor_activity {
                Ok((camera, microphone)) => format!(
                    "Runtime local disponible; cámara {} y micrófono {}. No se abrió hardware.",
                    if camera { "activa" } else { "inactiva" },
                    if microphone { "activo" } else { "inactivo" }
                ),
                Err(ref error) => {
                    format!("Runtime disponible; estado de leases no legible: {error}")
                }
            };
            check(
                "adapter.sensory-runtime",
                DiagnosticCategory::Adapter,
                "Runtime sensorial Python",
                if inputs.sensor_activity.is_ok() {
                    DiagnosticStatus::Healthy
                } else {
                    DiagnosticStatus::Error
                },
                activity,
            )
        }
        Ok(false) => check(
            "adapter.sensory-runtime",
            DiagnosticCategory::Adapter,
            "Runtime sensorial Python",
            DiagnosticStatus::Unavailable,
            "Python/OpenCV/sounddevice/NumPy/FFmpeg no están disponibles como conjunto.",
        ),
        Err(ref error) => check(
            "adapter.sensory-runtime",
            DiagnosticCategory::Adapter,
            "Runtime sensorial Python",
            DiagnosticStatus::Error,
            format!("La sonda pasiva falló: {error}"),
        ),
    };
    let planned_output = check(
        "adapter.face-body-output",
        DiagnosticCategory::Adapter,
        "Salida de rostro y cuerpo",
        DiagnosticStatus::Unavailable,
        "No existe adaptador de salida conectado; permanece planificado.",
    );
    vec![observation, avatar, sensory, planned_output]
}

fn permission_checks(inputs: &DiagnosticInputs) -> Vec<DiagnosticCheck> {
    let gateway = match inputs.permission {
        Ok(probe) => {
            let healthy = probe.deny_by_default && !probe.persistent_grants;
            check(
                "permission.gateway-r2",
                DiagnosticCategory::Permission,
                "Gateway nativo R2",
                if healthy {
                    DiagnosticStatus::Healthy
                } else {
                    DiagnosticStatus::Error
                },
                format!(
                    "Denegación predeterminada: {}; grants persistentes: {}; {} solicitudes y {} grants en memoria.",
                    probe.deny_by_default,
                    probe.persistent_grants,
                    probe.request_count,
                    probe.grant_count
                ),
            )
        }
        Err(ref error) => check(
            "permission.gateway-r2",
            DiagnosticCategory::Permission,
            "Gateway nativo R2",
            DiagnosticStatus::Error,
            format!("El almacén no superó la validación pasiva: {error}"),
        ),
    };
    let operating_system = check(
        "permission.hardware-os",
        DiagnosticCategory::Permission,
        "Permisos de cámara y micrófono",
        DiagnosticStatus::Unavailable,
        "No se sondean permisos del sistema porque hacerlo podría abrir o solicitar hardware.",
    );
    vec![gateway, operating_system]
}

fn build_snapshot(generated_at_ms: u64, inputs: DiagnosticInputs) -> DiagnosticSnapshot {
    let mut checks = vec![path_check(&inputs.data_root)];
    checks.extend(audit_checks(&inputs.data_root));
    checks.extend(memory_checks(&inputs.data_root));
    checks.extend(provider_checks(inputs.providers.clone()));
    checks.extend(adapter_checks(&inputs));
    checks.extend(permission_checks(&inputs));
    let summary = DiagnosticSummary {
        total: checks.len(),
        healthy: checks
            .iter()
            .filter(|item| item.status == DiagnosticStatus::Healthy)
            .count(),
        configuration_pending: checks
            .iter()
            .filter(|item| item.status == DiagnosticStatus::ConfigurationPending)
            .count(),
        unavailable: checks
            .iter()
            .filter(|item| item.status == DiagnosticStatus::Unavailable)
            .count(),
        errors: checks
            .iter()
            .filter(|item| item.status == DiagnosticStatus::Error)
            .count(),
    };
    let overall_status = if summary.errors > 0 {
        DiagnosticOverallStatus::Error
    } else if summary.configuration_pending > 0 || summary.unavailable > 0 {
        DiagnosticOverallStatus::Attention
    } else {
        DiagnosticOverallStatus::Healthy
    };
    DiagnosticSnapshot {
        schema_version: DIAGNOSTIC_SCHEMA_VERSION,
        generated_at_ms,
        overall_status,
        summary,
        checks,
    }
}

#[tauri::command]
pub(crate) fn diagnostic_snapshot(
    app: AppHandle,
    observation_store: State<ObservationStore>,
    sensor_store: State<SensorLeaseStore>,
    permission_gateway: State<PermissionGateway>,
) -> Result<DiagnosticSnapshot, String> {
    let generated_at_ms = u64::try_from(timestamp_ms()?)
        .map_err(|_| "El reloj excede el rango del diagnóstico".to_string())?;
    Ok(build_snapshot(
        generated_at_ms,
        DiagnosticInputs {
            data_root: alice_data_root_path(&app)?,
            providers: cloud_configuration_probe(),
            observation: observation_store.capability_probe(),
            avatar: avatar_capability_probe(),
            sensor_runtime: sensor_runtime_available(),
            sensor_activity: sensor_store.diagnostic_activity_probe(),
            permission: permission_gateway.diagnostic_probe(),
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::{append_event_at, AuditEvent, AUDIT_MAX_BYTES};
    use sha2::{Digest, Sha256};
    use std::fs;
    use uuid::Uuid;

    fn temp_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("alice-r3-diagnostic-{label}-{}", Uuid::new_v4()))
    }

    fn inputs(data_root: PathBuf) -> DiagnosticInputs {
        DiagnosticInputs {
            data_root,
            providers: vec![
                ("openrouter".into(), "OpenRouter".into(), Ok(true)),
                ("openai".into(), "OpenAI".into(), Ok(false)),
            ],
            observation: Ok(ObservationCapabilityProbe {
                enabled: false,
                has_latest_context: false,
            }),
            avatar: Ok(AvatarCapabilityProbe {
                available: true,
                size_bytes: 128,
            }),
            sensor_runtime: Ok(true),
            sensor_activity: Ok((false, false)),
            permission: Ok(PermissionDiagnosticProbe {
                deny_by_default: true,
                persistent_grants: false,
                request_count: 0,
                grant_count: 0,
            }),
        }
    }

    fn fingerprints(root: &Path) -> Vec<(PathBuf, u64, String)> {
        fn visit(root: &Path, directory: &Path, output: &mut Vec<(PathBuf, u64, String)>) {
            if !directory.exists() {
                return;
            }
            for entry in fs::read_dir(directory).expect("read diagnostic fixture") {
                let path = entry.expect("read diagnostic entry").path();
                if path.is_dir() {
                    visit(root, &path, output);
                } else {
                    let content = fs::read(&path).expect("read diagnostic file");
                    output.push((
                        path.strip_prefix(root).unwrap().to_path_buf(),
                        u64::try_from(content.len()).unwrap(),
                        format!("{:x}", Sha256::digest(&content)),
                    ));
                }
            }
        }
        let mut output = Vec::new();
        visit(root, root, &mut output);
        output.sort_by(|left, right| left.0.cmp(&right.0));
        output
    }

    #[test]
    fn passive_snapshot_reads_real_files_without_modifying_them() {
        let root = temp_root("healthy");
        let memory = root.join("memory");
        fs::create_dir_all(memory.join("backups")).unwrap();
        fs::write(
            memory.join("manifest.json"),
            r#"{"format":"alice-memory","version":1,"recordsFile":"records.json"}"#,
        )
        .unwrap();
        fs::write(memory.join("records.json"), "[]").unwrap();
        fs::write(memory.join("backups").join("records.backup.json"), "[]").unwrap();
        append_event_at(
            &root,
            &AuditEvent::process_started().unwrap(),
            AUDIT_MAX_BYTES,
        )
        .unwrap();
        let before = fs::read(memory.join("records.json")).unwrap();

        let snapshot = build_snapshot(1_786_280_000_000, inputs(root.clone()));

        assert_eq!(snapshot.schema_version, 1);
        assert_eq!(snapshot.overall_status, DiagnosticOverallStatus::Attention);
        assert_eq!(snapshot.summary.errors, 0);
        assert!(snapshot.checks.iter().any(|item| {
            item.id == "version.audit-v1" && item.status == DiagnosticStatus::Healthy
        }));
        assert!(snapshot.checks.iter().any(|item| {
            item.id == "provider.openai" && item.status == DiagnosticStatus::ConfigurationPending
        }));
        assert_eq!(fs::read(memory.join("records.json")).unwrap(), before);
        assert_eq!(
            fs::read_dir(root.join("audit")).unwrap().count(),
            1,
            "diagnosis must not create or rotate audit files"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn passive_snapshot_distinguishes_missing_unavailable_and_corrupt() {
        let root = temp_root("corrupt");
        fs::create_dir_all(root.join("memory")).unwrap();
        fs::write(root.join("memory").join("manifest.json"), "not-json").unwrap();
        fs::create_dir_all(root.join("audit")).unwrap();
        fs::write(root.join("audit").join("events-v1.jsonl"), "not-json\n").unwrap();
        let mut diagnostic_inputs = inputs(root.clone());
        diagnostic_inputs.sensor_runtime = Ok(false);

        let snapshot = build_snapshot(1_786_280_000_000, diagnostic_inputs);

        assert_eq!(snapshot.overall_status, DiagnosticOverallStatus::Error);
        assert!(snapshot.summary.errors >= 2);
        assert!(snapshot.summary.configuration_pending >= 1);
        assert!(snapshot.summary.unavailable >= 2);
        assert_eq!(
            fs::read_to_string(root.join("memory").join("manifest.json")).unwrap(),
            "not-json"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_root_is_reported_without_being_created() {
        let root = temp_root("missing");
        assert!(!root.exists());
        let snapshot = build_snapshot(1_786_280_000_000, inputs(root.clone()));
        assert!(snapshot.summary.configuration_pending >= 4);
        assert!(!root.exists());
    }

    #[test]
    #[ignore = "requiere los datos canónicos y el runtime Python local autorizados"]
    fn live_passive_diagnostic_reads_canonical_state_without_writes() {
        let root = std::env::var_os("ALICE_DATA_DIR")
            .map(PathBuf::from)
            .expect("ALICE_DATA_DIR is required for the live diagnostic probe");
        assert!(root.is_absolute() && root.is_dir());
        let before = fingerprints(&root);
        let observation = ObservationStore::default();
        let sensors = SensorLeaseStore::default();
        let permissions = PermissionGateway::default();

        let snapshot = build_snapshot(
            u64::try_from(timestamp_ms().unwrap()).unwrap(),
            DiagnosticInputs {
                data_root: root.clone(),
                providers: cloud_configuration_probe(),
                observation: observation.capability_probe(),
                avatar: avatar_capability_probe(),
                sensor_runtime: sensor_runtime_available(),
                sensor_activity: sensors.diagnostic_activity_probe(),
                permission: permissions.diagnostic_probe(),
            },
        );

        assert_eq!(snapshot.schema_version, DIAGNOSTIC_SCHEMA_VERSION);
        assert_eq!(snapshot.summary.errors, 0);
        assert!(snapshot.summary.healthy > 0);
        assert!(snapshot.summary.unavailable >= 2);
        assert_eq!(fingerprints(&root), before);
    }
}
