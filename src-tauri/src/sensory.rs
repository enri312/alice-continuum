use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex, MutexGuard, Weak};
use std::thread;
use std::time::Duration;

use crate::audit::{AuditOutcome, AuditStage};
use crate::permissions::{
    record_permission_audit, PermissionGateway, PermissionGrant, PermissionGrantState,
};
use tauri::{AppHandle, State};

pub(crate) const CAMERA_CAPABILITY: &str = "perception.camera.observe";
pub(crate) const CAMERA_OPERATION: &str = "observeAuthorizedCamera";
pub(crate) const CAMERA_STABLE_ID: &str = "camera-acer-hd-user-facing";
pub(crate) const CAMERA_LABEL: &str = "ACER HD User Facing";
pub(crate) const MICROPHONE_CAPABILITY: &str = "perception.microphone.observe";
pub(crate) const MICROPHONE_OPERATION: &str = "observeAuthorizedMicrophone";
pub(crate) const MICROPHONE_STABLE_ID: &str = "microphone-array-intel-smart-sound";
pub(crate) const MICROPHONE_LABEL: &str =
    "Microphone Array (2- Intel® Smart Sound Technology for Digital Microphones)";
pub(crate) const SENSOR_SESSION_DURATION_SECONDS: u32 = 60;

const SENSOR_SCHEMA_VERSION: u32 = 1;
const SENSOR_READY_TIMEOUT_SECONDS: u64 = 12;
const SENSOR_HELPER: &str = r#"
import json, re, subprocess, sys, time

kind, expected_label, duration_text = sys.argv[1:4]
duration = max(1, min(300, int(duration_text)))

def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)

try:
    if kind == "camera":
        import cv2
        device_query = subprocess.run(
            ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8
        )
        listing = device_query.stdout + device_query.stderr
        cameras = re.findall(r'"([^"\r\n]+)" \(video\)', listing)
        if expected_label not in cameras:
            raise RuntimeError("la cámara exacta autorizada no aparece en DirectShow")
        camera_index = cameras.index(expected_label)
        capture = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if not capture.isOpened():
            raise RuntimeError("no se pudo abrir la cámara por DirectShow")
        frames = 0
        width = 0
        height = 0
        limit = time.monotonic() + 6
        while frames < 3 and time.monotonic() < limit:
            ok, frame = capture.read()
            if ok and frame is not None:
                frames += 1
                height, width = frame.shape[:2]
        if frames == 0:
            capture.release()
            raise RuntimeError("la cámara abrió pero no entregó fotogramas vivos")
        emit({"status":"ready","deviceLabel":expected_label,"signalUnits":frames,"width":width,"height":height,"sampleRateHz":None})
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            capture.read()
            time.sleep(0.01)
        capture.release()
    elif kind == "microphone":
        import numpy as np
        import sounddevice as sd
        devices = sd.query_devices()
        selected = None
        for index, device in enumerate(devices):
            name = str(device.get("name", ""))
            normalized = name.lower().replace("®", "")
            if device.get("max_input_channels", 0) > 0 and "microphone array" in normalized and "smart sound technology" in normalized:
                selected = (index, name)
                break
        if selected is None:
            raise RuntimeError("no se encontró el arreglo de micrófonos autorizado")
        sample_rate = 44100
        counters = [0, 0.0]
        def callback(indata, frames, _time_info, status):
            if status:
                return
            counters[0] += frames
            counters[1] = max(counters[1], float(np.max(np.abs(indata))))
        with sd.InputStream(device=selected[0], samplerate=sample_rate, channels=1, dtype="float32", callback=callback):
            limit = time.monotonic() + 6
            while counters[0] < sample_rate // 4 and time.monotonic() < limit:
                time.sleep(0.025)
            if counters[0] == 0:
                raise RuntimeError("el micrófono abrió pero no entregó muestras vivas")
            emit({"status":"ready","deviceLabel":selected[1],"signalUnits":counters[0],"width":None,"height":None,"sampleRateHz":sample_rate})
            deadline = time.monotonic() + duration
            while time.monotonic() < deadline:
                time.sleep(0.05)
    else:
        raise RuntimeError("tipo de sensor no permitido")
except Exception as exc:
    emit({"status":"error","message":str(exc)[:240]})
    sys.exit(2)
"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SensorKind {
    Camera,
    Microphone,
}

impl SensorKind {
    pub(crate) fn from_capability(capability_id: &str, operation: &str) -> Result<Self, String> {
        match (capability_id, operation) {
            (CAMERA_CAPABILITY, CAMERA_OPERATION) => Ok(Self::Camera),
            (MICROPHONE_CAPABILITY, MICROPHONE_OPERATION) => Ok(Self::Microphone),
            _ => Err("El grant no autoriza una cámara o micrófono migrado a R2".into()),
        }
    }

    fn helper_name(self) -> &'static str {
        match self {
            Self::Camera => "camera",
            Self::Microphone => "microphone",
        }
    }

    pub(crate) fn capability_id(self) -> &'static str {
        match self {
            Self::Camera => CAMERA_CAPABILITY,
            Self::Microphone => MICROPHONE_CAPABILITY,
        }
    }

    pub(crate) fn stable_id(self) -> &'static str {
        match self {
            Self::Camera => CAMERA_STABLE_ID,
            Self::Microphone => MICROPHONE_STABLE_ID,
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Camera => CAMERA_LABEL,
            Self::Microphone => MICROPHONE_LABEL,
        }
    }

    fn adapter(self) -> &'static str {
        match self {
            Self::Camera => "OpenCV 5 · DirectShow · proceso local controlado",
            Self::Microphone => "PortAudio · WASAPI · proceso local controlado",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SensorDevice {
    pub(crate) kind: SensorKind,
    pub(crate) stable_id: String,
    pub(crate) label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SensorLeaseSnapshot {
    pub(crate) kind: SensorKind,
    pub(crate) capability_id: String,
    pub(crate) grant_id: String,
    pub(crate) device: SensorDevice,
    pub(crate) adapter: String,
    pub(crate) expires_at: String,
    pub(crate) maximum_duration_seconds: u32,
    pub(crate) indicator: String,
    pub(crate) raw_persistence: bool,
    pub(crate) verified_signal_units: u64,
    pub(crate) width: Option<u32>,
    pub(crate) height: Option<u32>,
    pub(crate) sample_rate_hz: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SensorLeaseStatus {
    pub(crate) schema_version: u32,
    pub(crate) leases: Vec<SensorLeaseSnapshot>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SensorCapabilityProbe {
    pub(crate) runtime_available: bool,
    pub(crate) camera_active: bool,
    pub(crate) microphone_active: bool,
    pub(crate) summary: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HelperReady {
    status: String,
    device_label: String,
    signal_units: u64,
    width: Option<u32>,
    height: Option<u32>,
    sample_rate_hz: Option<u32>,
}

struct ActiveSensor {
    snapshot: SensorLeaseSnapshot,
    child: Child,
}

#[derive(Default)]
struct SensorProcesses {
    active: HashMap<SensorKind, ActiveSensor>,
    finished_grant_ids: Vec<String>,
}

impl Drop for SensorProcesses {
    fn drop(&mut self) {
        for (_, mut sensor) in self.active.drain() {
            let _ = sensor.child.kill();
            let _ = sensor.child.wait();
        }
    }
}

#[derive(Clone, Default)]
pub(crate) struct SensorLeaseStore {
    inner: Arc<Mutex<SensorProcesses>>,
    start_transition: Arc<Mutex<()>>,
}

impl SensorLeaseStore {
    fn lock(&self) -> Result<MutexGuard<'_, SensorProcesses>, String> {
        self.inner
            .lock()
            .map_err(|_| "El almacén de leases sensoriales quedó bloqueado".to_string())
    }

    pub(crate) fn start(
        &self,
        kind: SensorKind,
        grant: &PermissionGrant,
        duration_seconds: u32,
    ) -> Result<SensorLeaseSnapshot, String> {
        let _transition = self
            .start_transition
            .lock()
            .map_err(|_| "La transición de apertura sensorial quedó bloqueada".to_string())?;
        if duration_seconds == 0 || duration_seconds > SENSOR_SESSION_DURATION_SECONDS {
            return Err("La duración sensorial debe estar entre 1 y 60 segundos".into());
        }
        {
            let mut store = self.lock()?;
            prune_finished(&mut store);
            if store.active.contains_key(&kind) {
                return Err("Ya existe un lease activo para este dispositivo".into());
            }
        }

        let mut child = spawn_helper(kind, duration_seconds)?;
        let stdout = child.stdout.take().ok_or_else(|| {
            "El adaptador sensorial no expuso su canal de confirmación".to_string()
        })?;
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let mut line = String::new();
            let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
            let _ = sender.send(result);
        });
        let line = match receiver.recv_timeout(Duration::from_secs(SENSOR_READY_TIMEOUT_SECONDS)) {
            Ok(Ok(line)) if !line.trim().is_empty() => line,
            Ok(Ok(_)) => {
                terminate(&mut child);
                return Err("El dispositivo terminó sin confirmar señal viva".into());
            }
            Ok(Err(error)) => {
                terminate(&mut child);
                return Err(format!(
                    "No se pudo leer la confirmación del dispositivo: {error}"
                ));
            }
            Err(_) => {
                terminate(&mut child);
                return Err("El dispositivo no confirmó señal viva dentro de 12 segundos".into());
            }
        };
        let value: serde_json::Value = serde_json::from_str(line.trim())
            .map_err(|_| "El adaptador sensorial devolvió una confirmación inválida".to_string())?;
        if value.get("status").and_then(serde_json::Value::as_str) == Some("error") {
            terminate(&mut child);
            let message = value
                .get("message")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("error no especificado");
            return Err(format!("El dispositivo rechazó la apertura: {message}"));
        }
        let ready: HelperReady = serde_json::from_value(value)
            .map_err(|_| "El adaptador sensorial devolvió campos inesperados".to_string())?;
        if ready.status != "ready" || ready.signal_units == 0 {
            terminate(&mut child);
            return Err("El adaptador no acreditó señal viva".into());
        }

        let snapshot = SensorLeaseSnapshot {
            kind,
            capability_id: kind.capability_id().into(),
            grant_id: grant.grant_id.clone(),
            device: SensorDevice {
                kind,
                stable_id: kind.stable_id().into(),
                label: ready.device_label,
            },
            adapter: kind.adapter().into(),
            expires_at: grant.expires_at.clone(),
            maximum_duration_seconds: duration_seconds,
            indicator: "ACTIVO · SEÑAL VIVA · DESCARTE INMEDIATO".into(),
            raw_persistence: false,
            verified_signal_units: ready.signal_units,
            width: ready.width,
            height: ready.height,
            sample_rate_hz: ready.sample_rate_hz,
        };
        self.lock()?.active.insert(
            kind,
            ActiveSensor {
                snapshot: snapshot.clone(),
                child,
            },
        );
        Ok(snapshot)
    }

    pub(crate) fn stop_grant(&self, grant_id: &str) -> Result<bool, String> {
        let mut store = self.lock()?;
        let kind = store
            .active
            .iter()
            .find_map(|(kind, sensor)| (sensor.snapshot.grant_id == grant_id).then_some(*kind));
        let Some(kind) = kind else {
            return Ok(false);
        };
        let mut sensor = store.active.remove(&kind).expect("kind found above");
        terminate(&mut sensor.child);
        Ok(true)
    }

    pub(crate) fn status(&self) -> Result<SensorLeaseStatus, String> {
        let mut store = self.lock()?;
        prune_finished(&mut store);
        let mut leases: Vec<_> = store
            .active
            .values()
            .map(|sensor| sensor.snapshot.clone())
            .collect();
        leases.sort_by_key(|lease| match lease.kind {
            SensorKind::Camera => 0,
            SensorKind::Microphone => 1,
        });
        Ok(SensorLeaseStatus {
            schema_version: SENSOR_SCHEMA_VERSION,
            leases,
        })
    }

    pub(crate) fn capability_probe(&self) -> Result<SensorCapabilityProbe, String> {
        let status = self.status()?;
        let runtime_available = sensor_runtime_available()?;
        Ok(SensorCapabilityProbe {
            runtime_available,
            camera_active: status
                .leases
                .iter()
                .any(|lease| lease.kind == SensorKind::Camera),
            microphone_active: status
                .leases
                .iter()
                .any(|lease| lease.kind == SensorKind::Microphone),
            summary: if runtime_available {
                "Python, OpenCV, sounddevice, NumPy y FFmpeg disponibles; la sonda no abrió dispositivos."
                    .into()
            } else {
                "El runtime local no pudo validar OpenCV, sounddevice, NumPy y FFmpeg.".into()
            },
        })
    }

    pub(crate) fn diagnostic_activity_probe(&self) -> Result<(bool, bool), String> {
        let store = self.lock()?;
        Ok((
            store.active.contains_key(&SensorKind::Camera),
            store.active.contains_key(&SensorKind::Microphone),
        ))
    }

    fn weak(&self) -> Weak<Mutex<SensorProcesses>> {
        Arc::downgrade(&self.inner)
    }
}

pub(crate) fn sensor_runtime_available() -> Result<bool, String> {
    let mut command = Command::new("python");
    command
        .args([
            "-c",
            "import cv2, sounddevice, numpy, shutil; assert shutil.which('ffmpeg')",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .env("PYTHONDONTWRITEBYTECODE", "1");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
        .status()
        .map(|status| status.success())
        .map_err(|error| format!("No se pudo sondear el runtime sensorial local: {error}"))
}

fn spawn_helper(kind: SensorKind, duration_seconds: u32) -> Result<Child, String> {
    let mut command = Command::new("python");
    command
        .args([
            "-u",
            "-c",
            SENSOR_HELPER,
            kind.helper_name(),
            kind.label(),
            &duration_seconds.to_string(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUNBUFFERED", "1");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
        .spawn()
        .map_err(|error| format!("No se pudo iniciar el adaptador local controlado: {error}"))
}

fn terminate(child: &mut Child) {
    if child.try_wait().ok().flatten().is_none() {
        let _ = child.kill();
    }
    let _ = child.wait();
}

fn prune_finished(store: &mut SensorProcesses) {
    let finished = store
        .active
        .iter_mut()
        .filter_map(|(kind, sensor)| match sensor.child.try_wait() {
            Ok(Some(_)) | Err(_) => Some((*kind, sensor.snapshot.grant_id.clone())),
            Ok(None) => None,
        })
        .collect::<Vec<_>>();
    for (kind, grant_id) in finished {
        store.active.remove(&kind);
        store.finished_grant_ids.push(grant_id);
    }
}

pub(crate) fn spawn_sensor_reaper_thread(
    sensors: SensorLeaseStore,
    gateway: PermissionGateway,
    app: AppHandle,
) {
    let weak = sensors.weak();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));
        let Some(inner) = weak.upgrade() else {
            break;
        };
        let (grant_ids, finished_grant_ids) = match inner.lock() {
            Ok(mut store) => {
                prune_finished(&mut store);
                let active = store
                    .active
                    .values()
                    .map(|sensor| sensor.snapshot.grant_id.clone())
                    .collect::<Vec<_>>();
                let finished = std::mem::take(&mut store.finished_grant_ids);
                (active, finished)
            }
            Err(_) => break,
        };
        for grant_id in finished_grant_ids {
            let context = gateway.audit_context_for_grant(&grant_id);
            if gateway
                .with_adapter_transition(|| gateway.stop_session(&grant_id))
                .is_ok()
            {
                if let Ok(context) = context {
                    if let Err(error) = record_permission_audit(
                        &app,
                        &context,
                        AuditStage::Stop,
                        None,
                        AuditOutcome::Success,
                        None,
                        "SESSION_FINISHED",
                    ) {
                        eprintln!("Lease finalizado sin evidencia R3: {error}");
                    }
                }
            }
        }
        for grant_id in grant_ids {
            if !gateway.session_is_active(&grant_id).unwrap_or(false) {
                if let Ok(mut store) = inner.lock() {
                    if let Some(kind) = store.active.iter().find_map(|(kind, sensor)| {
                        (sensor.snapshot.grant_id == grant_id).then_some(*kind)
                    }) {
                        if let Some(mut sensor) = store.active.remove(&kind) {
                            terminate(&mut sensor.child);
                        }
                    }
                }
                if let (Ok(context), Ok(grant)) = (
                    gateway.audit_context_for_grant(&grant_id),
                    gateway.grant(&grant_id),
                ) {
                    let reason = if grant.state == PermissionGrantState::Expired {
                        "GRANT_EXPIRED"
                    } else {
                        "SESSION_ENDED"
                    };
                    if let Err(error) = record_permission_audit(
                        &app,
                        &context,
                        AuditStage::Stop,
                        None,
                        AuditOutcome::Success,
                        None,
                        reason,
                    ) {
                        eprintln!("Lease cerrado sin evidencia R3: {error}");
                    }
                }
            }
        }
    });
}

#[tauri::command]
pub(crate) fn sensor_lease_status(
    sensors: State<'_, SensorLeaseStore>,
) -> Result<SensorLeaseStatus, String> {
    sensors.status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capability_mapping_is_closed_to_two_exact_profiles() {
        assert_eq!(
            SensorKind::from_capability(CAMERA_CAPABILITY, CAMERA_OPERATION).unwrap(),
            SensorKind::Camera
        );
        assert_eq!(
            SensorKind::from_capability(MICROPHONE_CAPABILITY, MICROPHONE_OPERATION).unwrap(),
            SensorKind::Microphone
        );
        assert!(
            SensorKind::from_capability("perception.screen.observe", "observeSelectedScreen")
                .is_err()
        );
    }

    #[test]
    fn empty_store_reports_no_fictitious_signal() {
        let store = SensorLeaseStore::default();
        assert!(store.status().unwrap().leases.is_empty());
    }
}
