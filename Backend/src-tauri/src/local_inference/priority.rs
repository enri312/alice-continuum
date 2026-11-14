//! Priority between queued foreground requests and opportunistic study turns.
//! This does not own processes or the cross-engine residency permit.
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Default)]
struct PriorityState {
    foreground: AtomicUsize,
    background_epoch: AtomicU64,
}

#[derive(Default)]
pub(super) struct RequestPriority(Arc<PriorityState>);

/// Owned so the reservation survives being moved into a blocking worker.
#[must_use = "Hold the foreground intent until the request finishes or is cancelled"]
pub(super) struct ForegroundIntent(Arc<PriorityState>);

impl RequestPriority {
    pub(super) fn reserve_foreground(&self) -> ForegroundIntent {
        // Register before preempting or scheduling the worker: a study turn must
        // not capture the new epoch and jump ahead while that worker is queued.
        self.0.foreground.fetch_add(1, Ordering::AcqRel);
        self.preempt_background();
        ForegroundIntent(self.0.clone())
    }

    pub(super) fn foreground_pending(&self) -> bool {
        self.0.foreground.load(Ordering::Acquire) > 0
    }

    pub(super) fn background_epoch(&self) -> u64 {
        self.0.background_epoch.load(Ordering::Acquire)
    }

    pub(super) fn preempt_background(&self) {
        self.0.background_epoch.fetch_add(1, Ordering::AcqRel);
    }

    pub(super) fn should_yield(&self, epoch: u64) -> bool {
        self.foreground_pending() || self.background_epoch() != epoch
    }
}

impl Drop for ForegroundIntent {
    fn drop(&mut self) {
        let previous = self.0.foreground.fetch_sub(1, Ordering::AcqRel);
        debug_assert!(previous > 0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn foreground_reservation_blocks_even_a_background_turn_with_the_new_epoch() {
        let priority = RequestPriority::default();
        let foreground = priority.reserve_foreground();
        let epoch = priority.background_epoch();
        assert!(priority.should_yield(epoch));
        drop(foreground);
        assert!(!priority.should_yield(epoch));
    }

    #[test]
    fn all_foreground_reservations_must_finish_before_background_can_resume() {
        let priority = RequestPriority::default();
        let first = priority.reserve_foreground();
        let second = priority.reserve_foreground();
        let epoch = priority.background_epoch();
        drop(first);
        assert!(priority.should_yield(epoch));
        drop(second);
        assert!(!priority.should_yield(epoch));
    }

    #[test]
    fn an_interrupted_background_epoch_stays_displaced_after_foreground_finishes() {
        let priority = RequestPriority::default();
        let epoch = priority.background_epoch();
        let foreground = priority.reserve_foreground();
        drop(foreground);
        assert!(priority.should_yield(epoch));
        assert!(!priority.should_yield(priority.background_epoch()));
    }

    #[test]
    fn foreground_error_releases_its_reservation() {
        let priority = RequestPriority::default();
        let fail = || -> Result<(), ()> {
            let _foreground = priority.reserve_foreground();
            Err(())
        };
        assert!(fail().is_err());
        assert!(!priority.foreground_pending());
    }
}
