//! One active cycle, with a coalesced restart after an owner pause/resume.
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};

#[derive(Default)]
pub(super) struct Schedule {
    pub active: Option<u64>,
    pending: Option<u64>,
}
impl Schedule {
    pub fn request(&mut self, ticket: u64, restart: bool) -> Option<u64> {
        if self.active.is_none() {
            self.active = Some(ticket);
            Some(ticket)
        } else {
            if restart {
                self.pending = Some(ticket);
            }
            None
        }
    }
    pub fn cancel(&mut self) {
        self.pending = None;
    }
    pub fn finish(&mut self, ticket: u64, enabled: bool) -> Option<u64> {
        if self.active != Some(ticket) {
            return None;
        }
        self.active = if enabled {
            self.pending.take()
        } else {
            self.pending = None;
            None
        };
        self.active
    }
}
pub(super) struct Coordinator {
    pub schedule: Mutex<Schedule>,
    epoch: AtomicU64,
    enabled: AtomicBool,
}
impl Coordinator {
    pub const fn new() -> Self {
        Self {
            schedule: Mutex::new(Schedule {
                active: None,
                pending: None,
            }),
            epoch: AtomicU64::new(0),
            enabled: AtomicBool::new(true),
        }
    }
    pub fn ticket(&self) -> u64 {
        self.epoch.load(Ordering::Acquire)
    }
    pub fn current(&self, ticket: u64) -> bool {
        self.enabled.load(Ordering::Acquire) && self.ticket() == ticket
    }
    // Caller holds schedule and the store write lock, so stale I/O cannot commit
    // between the owner transition and the generation change.
    pub fn control(&self, enabled: bool) {
        if !enabled {
            self.epoch.fetch_add(1, Ordering::AcqRel);
        }
        self.enabled.store(enabled, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rapid_resume_coalesces_and_hands_off_without_overlap() {
        let coordinator = Coordinator::new();
        let mut schedule = coordinator.schedule.lock().unwrap();
        let first = coordinator.ticket();
        assert_eq!(schedule.request(first, false), Some(first));
        coordinator.control(false);
        assert!(!coordinator.current(first));
        coordinator.control(true);
        let next = coordinator.ticket();
        assert!(!coordinator.current(first));
        assert_eq!(schedule.request(next, true), None);
        assert_eq!(schedule.request(next, false), None);
        assert_eq!(schedule.active, Some(first));
        assert_eq!(schedule.finish(first, true), Some(next));
        assert_eq!(schedule.finish(first, true), None); // old cleanup cannot release its successor
        assert_eq!(schedule.active, Some(next));
        assert_eq!(schedule.finish(next, true), None);
        assert!(schedule.active.is_none());
    }
    #[test]
    fn another_pause_cancels_the_pending_restart() {
        let mut schedule = Schedule::default();
        schedule.request(0, false);
        schedule.request(1, true);
        schedule.cancel();
        assert_eq!(schedule.finish(0, false), None);
        assert!(schedule.active.is_none());
    }
    #[test]
    fn a_request_after_release_claims_a_new_worker() {
        let mut schedule = Schedule::default();
        schedule.request(0, false);
        assert_eq!(schedule.finish(0, true), None);
        assert_eq!(schedule.request(1, true), Some(1));
        assert_eq!(schedule.finish(1, true), None);
    }
}
