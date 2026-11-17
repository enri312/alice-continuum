use serde::Serialize;
use std::{
    path::Path,
    sync::Mutex,
    time::{Duration, Instant},
};
use sysinfo::{MemoryRefreshKind, Networks, System, MINIMUM_CPU_UPDATE_INTERVAL};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SystemOverview {
    cpu_percent: Option<f32>,
    memory: Option<Capacity>,
    disk: Option<Capacity>,
    network: Option<NetworkRate>,
    power: Option<Power>,
    uptime_seconds: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Capacity {
    used_bytes: u64,
    total_bytes: u64,
}

impl Capacity {
    fn from_available(total: u64, available: u64) -> Option<Self> {
        (total > 0 && available <= total).then(|| Self {
            total_bytes: total,
            used_bytes: total - available,
        })
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NetworkRate {
    received_bytes_per_second: f64,
    transmitted_bytes_per_second: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Power {
    plugged_in: Option<bool>,
    battery_percent: Option<u8>,
}

struct Sampler {
    system: System,
    networks: Networks,
    last: Option<(Instant, SystemOverview)>,
}

static SAMPLER: Mutex<Option<Sampler>> = Mutex::new(None);

impl Sampler {
    fn read(&mut self, data_root: Option<&Path>) -> SystemOverview {
        let now = Instant::now();
        let elapsed = self.last.as_ref().map(|(at, _)| now.duration_since(*at));
        if let Some((_, snapshot)) = &self.last {
            if elapsed.is_some_and(|elapsed| elapsed < MINIMUM_CPU_UPDATE_INTERVAL) {
                return snapshot.clone();
            }
        }

        self.system.refresh_cpu_usage();
        self.system
            .refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
        self.networks.refresh(true);
        // Skip the first rate and the interval after a long pause or navigation.
        let measured = elapsed.filter(|elapsed| *elapsed <= Duration::from_secs(15));
        let cpu = self.system.global_cpu_usage();
        let cpu_percent = measured
            .filter(|_| cpu.is_finite() && !self.system.cpus().is_empty())
            .map(|_| cpu.clamp(0.0, 100.0));
        let network = measured
            .filter(|_| !self.networks.is_empty())
            .map(|elapsed| {
                let (received, transmitted) =
                    self.networks.values().fold((0u64, 0u64), |(rx, tx), link| {
                        (
                            rx.saturating_add(link.received()),
                            tx.saturating_add(link.transmitted()),
                        )
                    });
                NetworkRate {
                    received_bytes_per_second: received as f64 / elapsed.as_secs_f64(),
                    transmitted_bytes_per_second: transmitted as f64 / elapsed.as_secs_f64(),
                }
            });
        let snapshot = SystemOverview {
            cpu_percent,
            memory: Capacity::from_available(
                self.system.total_memory(),
                self.system.available_memory(),
            ),
            disk: data_root.and_then(disk_capacity),
            network,
            power: power(),
            uptime_seconds: System::uptime(),
        };
        self.last = Some((now, snapshot.clone()));
        snapshot
    }
}

#[cfg(windows)]
fn disk_capacity(path: &Path) -> Option<Capacity> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{core::PCWSTR, Win32::Storage::FileSystem::GetDiskFreeSpaceExW};
    let folder = path.ancestors().find(|path| path.is_dir())?;
    let wide: Vec<u16> = folder.as_os_str().encode_wide().chain([0]).collect();
    let (mut available, mut total) = (0, 0);
    // The path and both output buffers live until the synchronous call returns.
    unsafe {
        GetDiskFreeSpaceExW(
            PCWSTR(wide.as_ptr()),
            Some(&mut available),
            Some(&mut total),
            None,
        )
    }
    .ok()?;
    Capacity::from_available(total, available)
}

#[cfg(not(windows))]
fn disk_capacity(path: &Path) -> Option<Capacity> {
    let folder = path.ancestors().find_map(|path| path.canonicalize().ok())?;
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk = disks
        .iter()
        .filter(|disk| folder.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().components().count())?;
    Capacity::from_available(disk.total_space(), disk.available_space())
}

#[cfg(windows)]
fn power() -> Option<Power> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut status = SYSTEM_POWER_STATUS::default();
    // Writes to the live stack buffer and returns synchronously.
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;
    Some(Power {
        plugged_in: match status.ACLineStatus {
            0 => Some(false),
            1 => Some(true),
            _ => None,
        },
        battery_percent: (status.BatteryLifePercent <= 100 && status.BatteryFlag & 128 == 0)
            .then_some(status.BatteryLifePercent),
    })
}

#[cfg(not(windows))]
fn power() -> Option<Power> {
    None
}

#[tauri::command]
pub(crate) async fn system_overview(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<SystemOverview, String> {
    if window.label() != "main" {
        return Err("El estado del equipo se consulta desde la ventana principal.".into());
    }
    let path = crate::util::alice_data_root_path(&app).ok();
    tauri::async_runtime::spawn_blocking(move || {
        let mut state = SAMPLER
            .lock()
            .map_err(|_| "Lectura del equipo no disponible.")?;
        let sampler = state.get_or_insert_with(|| Sampler {
            system: System::new(),
            networks: Networks::new(),
            last: None,
        });
        Ok(sampler.read(path.as_deref()))
    })
    .await
    .map_err(|_| "No se pudo consultar el equipo.".to_string())?
}
