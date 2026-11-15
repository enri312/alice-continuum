use crate::model::{Activity, ActivityStatus};
use dioxus::prelude::*;

// Shared visual presentation; activity is supplied by the existing R3 poller.
#[component]
pub fn ActivityIntro(
    activity: Activity,
    code: &'static str,
    title: &'static str,
    description: &'static str,
) -> Element {
    let view_state = activity.view_state();
    let audit_state = activity.audit_state();
    let activity_class = match activity.status {
        ActivityStatus::Loading => "loading",
        ActivityStatus::Ready => "ready",
        ActivityStatus::Unavailable => "unavailable",
    };
    let header_class = format!("neuro-heading nucleus-page-header is-{view_state}");
    let live_class = format!("neuro-live {view_state} is-{view_state}");
    let provenance_class = format!(
        "core-activity-provenance {activity_class} is-{view_state} {}",
        if audit_state == "degraded" {
            "degraded"
        } else {
            ""
        }
    );
    let method = activity
        .method
        .as_deref()
        .unwrap_or("r3-recency-motor-v2")
        .to_uppercase();
    let summary = activity.summary();
    let label = activity.label();
    rsx! {
        div { class: header_class, "data-activity-state": view_state,
            div {
                p { class: "eyebrow", "{code} · ESTADO VERIFICABLE" }
                h2 { id: "{code}-title", "{title}" }
                p { class: "nucleus-page-description", "{description}" }
            }
            span { class: live_class, "data-activity-state": view_state,
                "data-signal-present": view_state == "ready", role: "status",
                "aria-live": "polite", "aria-atomic": "true", "aria-busy": view_state == "loading",
                i { "aria-hidden": "true" } "{label}"
            }
        }
        div { class: provenance_class, "data-activity-state": view_state,
            "data-audit-state": audit_state, role: "status", "aria-live": "polite",
            "aria-atomic": "true", "aria-busy": view_state == "loading",
            strong { "R3 · ACTIVIDAD DERIVADA" }
            span { "{summary}" }
            small { "HEURÍSTICA {method} · NO ES EMOCIÓN NI CONCIENCIA" }
        }
    }
}
