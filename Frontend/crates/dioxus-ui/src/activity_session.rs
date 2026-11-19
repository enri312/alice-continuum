use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const EVENT_LIMIT: usize = 200;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
enum Module {
    System,
    Perception,
    Memory,
    Workspace,
    Output,
    Security,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "UPPERCASE")]
enum Level {
    Info,
    Trace,
    Warn,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Draft {
    id: String,
    created_at: String,
    module: Module,
    level: Level,
    node: String,
    payload: String,
}

#[derive(Serialize)]
struct Event {
    sequence: u64,
    #[serde(flatten)]
    draft: Draft,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Batch {
    clear: bool,
    discarded: u64,
    records: Vec<Draft>,
}

#[derive(Default)]
struct ActivitySession {
    events: VecDeque<Event>,
    sequence: u64,
}

impl ActivitySession {
    fn apply(&mut self, batch: Batch) -> Result<(), &'static str> {
        let count = batch.records.len();
        let sequence = self
            .sequence
            .checked_add(batch.discarded)
            .filter(|value| count <= EVENT_LIMIT && *value <= (1u64 << 53) - 1 - count as u64)
            .ok_or("Lote de actividad fuera de rango")?;
        self.sequence = sequence;
        if batch.clear {
            self.events.clear();
        }
        for draft in batch.records {
            if self.events.len() == EVENT_LIMIT {
                self.events.pop_front();
            }
            self.sequence += 1;
            self.events.push_back(Event {
                sequence: self.sequence,
                draft,
            });
        }
        Ok(())
    }
}

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::{ActivitySession, Batch};
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;

    thread_local! {
        // One buffer per loaded WebView, independent of the mounted screen.
        static SESSION: RefCell<ActivitySession> = RefCell::new(ActivitySession::default());
    }

    #[wasm_bindgen]
    pub fn apply_activity_batch(raw: &str) -> Result<String, JsValue> {
        let batch: Batch =
            serde_json::from_str(raw).map_err(|error| JsValue::from_str(&error.to_string()))?;
        SESSION.with(|session| {
            let mut current = session.borrow_mut();
            current.apply(batch).map_err(JsValue::from_str)?;
            serde_json::to_string(&current.events)
                .map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draft() -> Draft {
        Draft {
            id: "event".into(),
            created_at: "2026-11-19T12:00:00.000Z".into(),
            module: Module::Memory,
            level: Level::Info,
            node: "TEST".into(),
            payload: "evento".into(),
        }
    }

    #[test]
    fn keeps_only_the_last_200_events_with_monotonic_sequences() {
        let mut session = ActivitySession::default();
        for _ in 0..3 {
            session
                .apply(Batch {
                    clear: false,
                    discarded: 0,
                    records: (0..100).map(|_| draft()).collect(),
                })
                .unwrap();
        }
        assert_eq!(session.events.len(), 200);
        assert_eq!(session.events.front().unwrap().sequence, 101);
        assert_eq!(session.events.back().unwrap().sequence, 300);
    }

    #[test]
    fn delayed_clear_drops_old_records_and_keeps_the_sequence() {
        let mut session = ActivitySession::default();
        session
            .apply(Batch {
                clear: false,
                discarded: 0,
                records: vec![draft()],
            })
            .unwrap();
        session
            .apply(Batch {
                clear: true,
                discarded: 250,
                records: vec![draft()],
            })
            .unwrap();
        assert_eq!(session.events.len(), 1);
        assert_eq!(session.events[0].sequence, 252);
    }
}
