use serde::Deserialize;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Payload {
    pub draft: String,
    pub desktop_app: bool,
    pub failed: bool,
    pub snapshot: Option<Overview>,
    pub assets: Assets,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Assets {
    pub emblem: String,
    pub conversation: String,
    pub planner: String,
    pub memory: String,
    pub permissions: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Overview {
    cpu_percent: Option<f64>,
    memory: Option<Capacity>,
    disk: Option<Capacity>,
    network: Option<NetworkRate>,
    power: Option<Power>,
    uptime_seconds: u64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Capacity {
    used_bytes: u64,
    total_bytes: u64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NetworkRate {
    received_bytes_per_second: f64,
    transmitted_bytes_per_second: f64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Power {
    plugged_in: Option<bool>,
    battery_percent: Option<u8>,
}

pub struct Metric {
    pub label: &'static str,
    pub symbol: &'static str,
    pub value: String,
    pub detail: Option<String>,
}

fn decimal(value: f64) -> String {
    format!("{value:.1}")
        .trim_end_matches(".0")
        .replace('.', ",")
}

fn percentage(value: Option<f64>) -> String {
    value.map_or_else(|| "—".into(), |value| format!("{} %", value.round() as u8))
}

fn rate(bytes_per_second: f64) -> String {
    let kilobits = bytes_per_second * 8.0 / 1000.0;
    if kilobits >= 1000.0 {
        format!("{} Mb/s", decimal(kilobits / 1000.0))
    } else {
        format!("{} kb/s", decimal(kilobits))
    }
}

fn uptime(seconds: u64) -> String {
    let days = seconds / 86_400;
    let hours = seconds / 3600 % 24;
    let minutes = seconds / 60 % 60;
    if days > 0 {
        format!("{days} d {hours} h")
    } else {
        format!("{hours} h {minutes} min")
    }
}

impl Capacity {
    fn percent(&self) -> Option<f64> {
        (self.total_bytes > 0 && self.used_bytes <= self.total_bytes)
            .then(|| 100.0 * self.used_bytes as f64 / self.total_bytes as f64)
    }
}

fn capacity_metric(
    label: &'static str,
    symbol: &'static str,
    capacity: Option<&Capacity>,
) -> Metric {
    let ratio = capacity.and_then(Capacity::percent);
    let detail = capacity.filter(|_| ratio.is_some()).map(|capacity| {
        let gib = |bytes| decimal(bytes as f64 / 1_073_741_824.0);
        format!(
            "{} de {} GiB",
            gib(capacity.used_bytes),
            gib(capacity.total_bytes)
        )
    });
    Metric {
        label,
        symbol,
        value: percentage(ratio),
        detail,
    }
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|_| "Datos del Dashboard inválidos".into())
    }

    pub fn reading_status(&self) -> &'static str {
        match &self.snapshot {
            _ if !self.desktop_app => "Disponible en Alice Desktop",
            _ if self.failed => "Lectura no disponible. Se reintentará.",
            None => "Leyendo el equipo…",
            Some(reading) if reading.cpu_percent.is_none() || reading.network.is_none() => {
                "Esperando muestras de CPU y red"
            }
            Some(_) => "Lecturas locales",
        }
    }

    pub fn ram_percent(&self) -> Option<f64> {
        self.snapshot.as_ref()?.memory.as_ref()?.percent()
    }

    pub fn ram_text(&self) -> String {
        percentage(self.ram_percent())
    }

    pub fn metrics(&self) -> [Metric; 6] {
        let snapshot = self.snapshot.as_ref();
        let network = snapshot.and_then(|reading| reading.network.as_ref());
        let power = snapshot.and_then(|reading| reading.power.as_ref());
        let supply = match power.and_then(|power| power.plugged_in) {
            Some(true) => "Conectado",
            Some(false) => "Batería",
            None => "—",
        };
        [
            Metric {
                label: "Procesador",
                symbol: "CPU",
                value: percentage(snapshot.and_then(|reading| reading.cpu_percent)),
                detail: None,
            },
            capacity_metric(
                "Memoria RAM",
                "RAM",
                snapshot.and_then(|reading| reading.memory.as_ref()),
            ),
            capacity_metric(
                "Disco de Alice",
                "VOL",
                snapshot.and_then(|reading| reading.disk.as_ref()),
            ),
            Metric {
                label: "Red",
                symbol: "RED",
                value: network.map_or_else(
                    || "—".into(),
                    |rate_data| format!("↓ {}", rate(rate_data.received_bytes_per_second)),
                ),
                detail: network
                    .map(|rate_data| format!("↑ {}", rate(rate_data.transmitted_bytes_per_second))),
            },
            Metric {
                label: "Energía",
                symbol: "PWR",
                value: supply.into(),
                detail: power
                    .and_then(|power| power.battery_percent)
                    .map(|battery| format!("Batería al {battery} %")),
            },
            Metric {
                label: "Tiempo encendido",
                symbol: "CLK",
                value: snapshot
                    .map_or_else(|| "—".into(), |reading| uptime(reading.uptime_seconds)),
                detail: None,
            },
        ]
    }
}
