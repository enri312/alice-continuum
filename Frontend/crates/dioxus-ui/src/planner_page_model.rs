use crate::{
    core_activity_model::Snapshot,
    model::{Activity, ActivityStatus},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Payload {
    Configure {
        desktop_app: bool,
        persistent_memory_count: usize,
        focus: String,
        minimum: String,
    },
    Activity {
        value: Option<Value>,
    },
    TaskResult {
        id: u32,
        result: TaskResult,
    },
}

impl Payload {
    pub fn parse(raw: &str) -> Result<Self, String> {
        serde_json::from_str(raw).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RegistryState {
    Missing,
    Ready,
    Invalid,
}

impl RegistryState {
    pub fn attr(&self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::Ready => "ready",
            Self::Invalid => "invalid",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub state: RegistryState,
    pub task_count: u32,
    pub scheduled_count: u32,
    pub cancelled_count: u32,
    pub tasks: Vec<Task>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub task_id: String,
    pub title: String,
    pub status: TaskStatus,
    pub time_label: String,
    pub local_notification: bool,
    pub cancellable: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Scheduled,
    Paused,
    Completed,
    Cancelled,
}

impl TaskStatus {
    pub fn display(&self) -> (&'static str, &'static str) {
        match self {
            Self::Scheduled => ("scheduled", "PROGRAMADO"),
            Self::Paused => ("paused", "PAUSADO"),
            Self::Completed => ("completed", "COMPLETADO"),
            Self::Cancelled => ("cancelled", "CANCELADO"),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Engine {
    pub registry_state: RegistryState,
    pub background_enabled: bool,
    pub waiting_count: u32,
    pub due_count: u32,
    pub excluded_count: u32,
    pub next_label: String,
    pub pulse_label: Option<String>,
    pub due: Vec<Due>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Due {
    pub task_id: String,
    pub title: String,
    pub scheduled_for: String,
    pub time_label: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ledger {
    pub state: RegistryState,
    pub reservation_count: u32,
    pub reservations: Vec<Reservation>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reservation {
    pub attempt_id: String,
    pub idempotency_key: String,
    pub task_id: String,
    pub scheduled_for: String,
    pub state: ReservationState,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReservationState {
    Reserved,
    Dispatching,
    Accepted,
    Failed,
}

impl ReservationState {
    pub fn attr(&self) -> &'static str {
        match self {
            Self::Reserved => "reserved",
            Self::Dispatching => "dispatching",
            Self::Accepted => "accepted",
            Self::Failed => "failed",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct Capability {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub plan_id: String,
    pub task_id: String,
    pub title: String,
    pub time_label: String,
    pub backup_required: bool,
    pub action: Mutation,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mutation {
    ScheduleLocalReminder,
    CancelTask,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub audit_written: bool,
    pub idempotent: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationReceipt {
    pub action: Mutation,
    pub revision_id: String,
    #[serde(flatten)]
    pub audit: Receipt,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DispatchReceipt {
    pub notification_accepted: bool,
    #[serde(flatten)]
    pub audit: Receipt,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckReceipt {
    pub capability_state: String,
    pub reason: String,
    pub r2_required: bool,
    pub r2_active: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TaskResult {
    Refreshed {
        registry: Registry,
        engine: Engine,
        ledger: Ledger,
        capabilities: Vec<Capability>,
    },
    Engine {
        engine: Engine,
    },
    Preview {
        plan: Plan,
    },
    Confirmed {
        receipt: MutationReceipt,
    },
    Reserved {
        receipt: Receipt,
    },
    Dispatched {
        receipt: DispatchReceipt,
    },
    Checked {
        receipt: CheckReceipt,
    },
    Failed {
        message: String,
    },
    Declined,
}

#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Action {
    Refresh,
    Tick,
    Toggle {
        enabled: bool,
    },
    Prepare {
        title: String,
        next_run_local: String,
    },
    Cancel {
        task_id: String,
    },
    Confirm {
        plan_id: String,
    },
    Reserve {
        task_id: String,
        scheduled_for: String,
    },
    Dispatch {
        attempt_id: String,
        idempotency_key: String,
    },
    Check {
        capability_id: String,
    },
}

#[derive(Clone, Serialize)]
pub struct Request {
    pub id: u32,
    #[serde(flatten)]
    pub action: Action,
}

pub struct State {
    pub desktop: bool,
    pub has_memory: bool,
    pub focus: String,
    pub minimum: String,
    pub activity: Activity,
    pub registry: Option<Registry>,
    pub engine: Option<Engine>,
    pub ledger: Option<Ledger>,
    pub capabilities: Vec<Capability>,
    pub capability_id: String,
    pub title: String,
    pub next_run_local: String,
    pub plan: Option<Plan>,
    pub reviewed: bool,
    pub receipt: Option<MutationReceipt>,
    pub reservation: Option<Receipt>,
    pub notification: Option<DispatchReceipt>,
    pub check: Option<CheckReceipt>,
    pub error: String,
    pending: Option<Request>,
    pending_tick: Option<u32>,
    next_id: u32,
}

impl State {
    pub fn new(desktop: bool, has_memory: bool, focus: String, minimum: String) -> Self {
        Self {
            desktop,
            has_memory,
            focus,
            minimum,
            activity: absent_activity(desktop),
            registry: None,
            engine: None,
            ledger: None,
            capabilities: Vec::new(),
            capability_id: String::new(),
            title: String::new(),
            next_run_local: String::new(),
            plan: None,
            reviewed: false,
            receipt: None,
            reservation: None,
            notification: None,
            check: None,
            error: String::new(),
            pending: None,
            pending_tick: None,
            next_id: 0,
        }
    }

    pub fn set_activity(&mut self, value: Option<Value>) {
        self.activity = value
            .filter(|_| self.desktop)
            .and_then(|value| Snapshot::parse(value).ok())
            .map(|snapshot| snapshot.activity())
            .unwrap_or_else(|| absent_activity(false));
    }

    pub fn busy(&self) -> bool {
        self.pending.is_some()
    }

    pub fn indicator(&self) -> &'static str {
        match self.pending.as_ref().map(|request| &request.action) {
            Some(Action::Refresh | Action::Toggle { .. }) => "status",
            Some(Action::Prepare { .. } | Action::Cancel { .. }) => "preview",
            Some(Action::Confirm { .. }) => "confirm",
            Some(Action::Check { .. }) => "check",
            _ => "",
        }
    }

    pub fn can_prepare(&self) -> bool {
        !self.busy()
            && !self.title.trim().is_empty()
            && !self.next_run_local.is_empty()
            && self
                .registry
                .as_ref()
                .is_some_and(|item| item.state != RegistryState::Invalid)
    }

    pub fn can_tick(&self) -> bool {
        !self.busy()
            && self.pending_tick.is_none()
            && self
                .engine
                .as_ref()
                .is_some_and(|engine| engine.background_enabled)
    }

    pub fn discard(&mut self) {
        if !self.busy() {
            self.plan = None;
            self.reviewed = false;
        }
    }

    pub fn start(&mut self, action: Action) -> Option<Request> {
        if !self.desktop || self.busy() {
            return None;
        }
        let permitted = match &action {
            Action::Refresh => true,
            Action::Tick => self.can_tick(),
            Action::Prepare {
                title,
                next_run_local,
            } => {
                self.can_prepare() && title == &self.title && next_run_local == &self.next_run_local
            }
            Action::Cancel { task_id } => self.registry.as_ref().is_some_and(|registry| {
                registry
                    .tasks
                    .iter()
                    .any(|task| task.task_id == *task_id && task.cancellable)
            }),
            Action::Confirm { plan_id } => {
                self.reviewed
                    && self
                        .plan
                        .as_ref()
                        .is_some_and(|plan| plan.plan_id == *plan_id)
            }
            Action::Toggle { enabled } => self.engine.as_ref().is_some_and(|engine| {
                engine.registry_state != RegistryState::Invalid
                    && engine.background_enabled != *enabled
            }),
            Action::Reserve {
                task_id,
                scheduled_for,
            } => {
                self.engine.as_ref().is_some_and(|engine| {
                    engine
                        .due
                        .iter()
                        .any(|due| &due.task_id == task_id && &due.scheduled_for == scheduled_for)
                }) && self.ledger.as_ref().is_some_and(|ledger| {
                    ledger.state != RegistryState::Invalid
                        && !ledger.reservations.iter().any(|entry| {
                            &entry.task_id == task_id && &entry.scheduled_for == scheduled_for
                        })
                })
            }
            Action::Dispatch {
                attempt_id,
                idempotency_key,
            } => self.ledger.as_ref().is_some_and(|ledger| {
                ledger.state != RegistryState::Invalid
                    && ledger.reservations.iter().any(|entry| {
                        &entry.attempt_id == attempt_id
                            && &entry.idempotency_key == idempotency_key
                            && entry.state == ReservationState::Reserved
                            && self.engine.as_ref().is_some_and(|engine| {
                                engine.due.iter().any(|due| {
                                    due.task_id == entry.task_id
                                        && due.scheduled_for == entry.scheduled_for
                                })
                            })
                    })
            }),
            Action::Check { capability_id } => self
                .capabilities
                .iter()
                .any(|item| &item.id == capability_id),
        };
        if !permitted {
            return None;
        }
        match &action {
            Action::Prepare { .. } | Action::Cancel { .. } => {
                self.discard();
                self.receipt = None;
            }
            Action::Confirm { .. } => self.reviewed = false,
            Action::Reserve { .. } => self.reservation = None,
            Action::Dispatch { .. } => self.notification = None,
            Action::Check { .. } => self.check = None,
            _ => {}
        }
        self.next_id = self.next_id.wrapping_add(1).max(1);
        let request = Request {
            id: self.next_id,
            action,
        };
        if matches!(request.action, Action::Tick) {
            self.pending_tick = Some(request.id);
        } else {
            self.error.clear();
            self.pending = Some(request.clone());
        }
        Some(request)
    }

    pub fn complete(&mut self, id: u32, result: TaskResult) -> bool {
        if self.pending_tick == Some(id) {
            self.pending_tick = None;
            if id == self.next_id {
                match result {
                    TaskResult::Engine { engine } => self.engine = Some(engine),
                    TaskResult::Failed { message } => self.error = message,
                    _ => self.error = "Respuesta inesperada del motor temporal.".into(),
                }
            }
            return false;
        }
        if self.pending.as_ref().map(|request| request.id) != Some(id) {
            return false;
        }
        let request = self.pending.take().expect("checked above");
        match (request.action, result) {
            (
                Action::Refresh,
                TaskResult::Refreshed {
                    registry,
                    engine,
                    ledger,
                    capabilities,
                },
            ) => {
                self.registry = Some(registry);
                self.engine = Some(engine);
                self.ledger = Some(ledger);
                if !capabilities
                    .iter()
                    .any(|item| item.id == self.capability_id)
                {
                    self.capability_id = capabilities
                        .first()
                        .map(|item| item.id.clone())
                        .unwrap_or_default();
                }
                self.capabilities = capabilities;
            }
            (Action::Toggle { .. }, TaskResult::Engine { engine }) => self.engine = Some(engine),
            (Action::Prepare { .. } | Action::Cancel { .. }, TaskResult::Preview { plan }) => {
                self.plan = Some(plan)
            }
            (Action::Confirm { .. }, TaskResult::Confirmed { receipt }) => {
                if receipt.action == Mutation::ScheduleLocalReminder {
                    self.title.clear();
                    self.next_run_local.clear();
                }
                self.discard();
                self.receipt = Some(receipt);
                return true;
            }
            (Action::Reserve { .. }, TaskResult::Reserved { receipt }) => {
                self.reservation = Some(receipt);
                return true;
            }
            (Action::Dispatch { .. }, TaskResult::Dispatched { receipt }) => {
                self.notification = Some(receipt);
                return true;
            }
            (Action::Check { .. }, TaskResult::Checked { receipt }) => {
                self.check = Some(receipt);
                return true;
            }
            (_, TaskResult::Failed { message }) => self.error = message,
            (Action::Reserve { .. } | Action::Dispatch { .. }, TaskResult::Declined) => {}
            _ => self.error = "Respuesta inesperada del registro de tareas.".into(),
        }
        false
    }
}

fn absent_activity(loading: bool) -> Activity {
    Activity {
        status: if loading {
            ActivityStatus::Loading
        } else {
            ActivityStatus::Unavailable
        },
        signal_present: false,
        audit_healthy: None,
        window_event_count: 0,
        window_ms: 0,
        overall_signal: 0.0,
        method: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine(background_enabled: bool) -> Engine {
        Engine {
            registry_state: RegistryState::Ready,
            background_enabled,
            waiting_count: 0,
            due_count: 0,
            excluded_count: 0,
            next_label: String::new(),
            pulse_label: None,
            due: Vec::new(),
        }
    }

    #[test]
    fn outdated_clock_read_cannot_block_or_undo_toggle() {
        let mut state = State {
            engine: Some(engine(true)),
            ..State::new(true, false, String::new(), String::new())
        };
        let tick = state.start(Action::Tick).unwrap();
        assert!(!state.busy());
        assert!(state.start(Action::Tick).is_none());
        let toggle = state.start(Action::Toggle { enabled: false }).unwrap();
        state.complete(
            toggle.id,
            TaskResult::Engine {
                engine: engine(false),
            },
        );
        state.complete(
            tick.id,
            TaskResult::Engine {
                engine: engine(true),
            },
        );
        assert!(!state.engine.unwrap().background_enabled);
    }

    #[test]
    fn confirmation_requires_review_of_the_current_plan() {
        let mut state = State {
            plan: Some(Plan {
                plan_id: "active".into(),
                task_id: "task".into(),
                title: "Recordatorio".into(),
                time_label: "Mañana".into(),
                backup_required: false,
                action: Mutation::ScheduleLocalReminder,
            }),
            ..State::new(true, false, String::new(), String::new())
        };
        let confirm = Action::Confirm {
            plan_id: "active".into(),
        };
        assert!(state.start(confirm.clone()).is_none());
        state.reviewed = true;
        assert!(state
            .start(Action::Confirm {
                plan_id: "old".into()
            })
            .is_none());
        assert!(state.start(confirm).is_some());
        assert!(!state.reviewed);
    }
}
