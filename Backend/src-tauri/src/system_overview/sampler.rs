use super::platform::{disk_capacity, power};
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
pub(super) struct Capacity {
    used_bytes: u64,
    total_bytes: u64,
}

impl Capacity {
    pub(super) fn from_available(total: u64, available: u64) -> Option<Self> {
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
pub(super) struct Power {
    pub(super) plugged_in: Option<bool>,
    pub(super) battery_percent: Option<u8>,
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

pub(super) fn read(data_root: Option<&Path>) -> Result<SystemOverview, String> {
    let mut state = SAMPLER
        .lock()
        .map_err(|_| "Lectura del equipo no disponible.")?;
    let sampler = state.get_or_insert_with(|| Sampler {
        system: System::new(),
        networks: Networks::new(),
        last: None,
    });
    Ok(sampler.read(data_root))
}
