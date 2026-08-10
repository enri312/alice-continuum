use crate::audit::{
    validated_visible_events_at, AuditEvent, AuditOutcome, AuditSource, AuditStage,
};
use crate::util::{alice_data_root_path, timestamp_ms};
use serde::Serialize;
use std::path::Path;
use tauri::AppHandle;

const CORE_ACTIVITY_SCHEMA_VERSION: u32 = 1;
const CORE_ACTIVITY_WINDOW_MS: u64 = 5 * 60 * 1000;
const CORE_ACTIVITY_METHOD: &str = "r3-recency-v1";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreActivityRegion {
    id: &'static str,
    label: &'static str,
    event_count: usize,
    signal: f64,
    last_event_at_ms: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreActivityLink {
    id: &'static str,
    from: &'static str,
    to: &'static str,
    evidence_count: usize,
    signal: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CoreActivitySnapshot {
    schema_version: u32,
    generated_at_ms: u64,
    method: &'static str,
    heuristic: bool,
    window_ms: u64,
    audit_healthy: bool,
    visible_event_count: usize,
    window_event_count: usize,
    latest_event_at_ms: Option<u64>,
    overall_signal: f64,
    regions: Vec<CoreActivityRegion>,
    links: Vec<CoreActivityLink>,
}

fn empty_regions() -> Vec<CoreActivityRegion> {
    vec![
        region("perception", "Percepción"),
        region("permission", "Permisos"),
        region("memory", "Memoria"),
        region("language", "Lenguaje"),
        region("workspace", "Contexto"),
        region("output", "Salida"),
    ]
}

fn region(id: &'static str, label: &'static str) -> CoreActivityRegion {
    CoreActivityRegion {
        id,
        label,
        event_count: 0,
        signal: 0.0,
        last_event_at_ms: None,
    }
}

fn empty_links() -> Vec<CoreActivityLink> {
    vec![
        link("permission-perception", "permission", "perception"),
        link("perception-workspace", "perception", "workspace"),
        link("memory-workspace", "memory", "workspace"),
        link("language-workspace", "language", "workspace"),
        link("workspace-output", "workspace", "output"),
    ]
}

fn link(id: &'static str, from: &'static str, to: &'static str) -> CoreActivityLink {
    CoreActivityLink {
        id,
        from,
        to,
        evidence_count: 0,
        signal: 0.0,
    }
}

fn stage_weight(stage: AuditStage) -> f64 {
    match stage {
        AuditStage::Request => 0.35,
        AuditStage::Authorization => 0.55,
        AuditStage::Execution => 1.0,
        AuditStage::Stop => 0.45,
        AuditStage::Revocation => 0.55,
        AuditStage::Block => 0.65,
        AuditStage::Error => 0.8,
    }
}

fn outcome_weight(outcome: AuditOutcome) -> f64 {
    match outcome {
        AuditOutcome::Pending => 0.7,
        AuditOutcome::Success | AuditOutcome::Error => 1.0,
        AuditOutcome::Blocked => 0.8,
    }
}

fn event_weight(event: &AuditEvent, now_ms: u64) -> Option<f64> {
    let age_ms = now_ms.checked_sub(event.timestamp_ms)?;
    if age_ms >= CORE_ACTIVITY_WINDOW_MS {
        return None;
    }
    let recency = 1.0 - age_ms as f64 / CORE_ACTIVITY_WINDOW_MS as f64;
    Some(recency * stage_weight(event.stage) * outcome_weight(event.outcome))
}

fn relevant_perception_capability(event: &AuditEvent) -> bool {
    event.capability_id.as_deref().is_some_and(|capability| {
        capability.starts_with("perception.") || capability.starts_with("context.")
    })
}

fn add_region(regions: &mut [CoreActivityRegion], id: &str, event: &AuditEvent, weight: f64) {
    if let Some(region) = regions.iter_mut().find(|region| region.id == id) {
        region.event_count += 1;
        region.signal += weight;
        region.last_event_at_ms =
            Some(region.last_event_at_ms.unwrap_or(0).max(event.timestamp_ms));
    }
}

fn add_link(links: &mut [CoreActivityLink], id: &str, weight: f64) {
    if let Some(link) = links.iter_mut().find(|link| link.id == id) {
        link.evidence_count += 1;
        link.signal += weight;
    }
}

fn derive_at(events: &[AuditEvent], audit_healthy: bool, now_ms: u64) -> CoreActivitySnapshot {
    let mut regions = empty_regions();
    let mut links = empty_links();
    let mut window_event_count = 0;
    let mut overall_weight = 0.0;
    let mut latest_event_at_ms = None;

    for event in events {
        let Some(weight) = event_weight(event, now_ms) else {
            continue;
        };
        window_event_count += 1;
        overall_weight += weight;
        latest_event_at_ms = Some(latest_event_at_ms.unwrap_or(0).max(event.timestamp_ms));

        match event.source {
            AuditSource::System => add_region(&mut regions, "workspace", event, weight),
            AuditSource::Memory => {
                add_region(&mut regions, "memory", event, weight);
                add_region(&mut regions, "workspace", event, weight);
                add_link(&mut links, "memory-workspace", weight);
            }
            AuditSource::Cloud => {
                add_region(&mut regions, "language", event, weight);
                add_region(&mut regions, "workspace", event, weight);
                add_region(&mut regions, "output", event, weight);
                add_link(&mut links, "language-workspace", weight);
                add_link(&mut links, "workspace-output", weight);
            }
            AuditSource::Permission | AuditSource::Capability => {
                add_region(&mut regions, "permission", event, weight);
                if relevant_perception_capability(event) {
                    add_region(&mut regions, "perception", event, weight);
                    add_region(&mut regions, "workspace", event, weight);
                    add_link(&mut links, "permission-perception", weight);
                    add_link(&mut links, "perception-workspace", weight);
                }
            }
        }
    }

    for region in &mut regions {
        region.signal = (region.signal / 3.0).clamp(0.0, 1.0);
    }
    for link in &mut links {
        link.signal = (link.signal / 3.0).clamp(0.0, 1.0);
    }

    CoreActivitySnapshot {
        schema_version: CORE_ACTIVITY_SCHEMA_VERSION,
        generated_at_ms: now_ms,
        method: CORE_ACTIVITY_METHOD,
        heuristic: true,
        window_ms: CORE_ACTIVITY_WINDOW_MS,
        audit_healthy,
        visible_event_count: events.len(),
        window_event_count,
        latest_event_at_ms,
        overall_signal: (overall_weight / 4.0).clamp(0.0, 1.0),
        regions,
        links,
    }
}

fn snapshot_at(data_root: &Path, now_ms: u64) -> Result<CoreActivitySnapshot, String> {
    let (audit_healthy, events) = validated_visible_events_at(data_root)?;
    Ok(derive_at(&events, audit_healthy, now_ms))
}

#[tauri::command]
pub(crate) fn core_activity_snapshot(app: AppHandle) -> Result<CoreActivitySnapshot, String> {
    let now_ms = u64::try_from(timestamp_ms()?)
        .map_err(|_| "El reloj del sistema excede el rango de actividad R3".to_string())?;
    snapshot_at(&alice_data_root_path(&app)?, now_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audit::{append_event_at, AuditDecision, AUDIT_MAX_BYTES, AUDIT_SCHEMA_VERSION};
    use std::fs;
    use uuid::Uuid;

    const NOW: u64 = 1_786_280_000_000;

    fn event(
        source: AuditSource,
        capability_id: Option<&str>,
        stage: AuditStage,
        outcome: AuditOutcome,
        age_ms: u64,
    ) -> AuditEvent {
        AuditEvent {
            schema_version: AUDIT_SCHEMA_VERSION,
            event_id: Uuid::new_v4().to_string(),
            operation_id: Uuid::new_v4().to_string(),
            timestamp_ms: NOW - age_ms,
            source,
            capability_id: capability_id.map(str::to_string),
            operation: "core.activity.test".into(),
            stage,
            decision: (stage == AuditStage::Authorization).then_some(AuditDecision::Allow),
            outcome,
            duration_ms: None,
            subject_digest: None,
            reason_code: "CORE_ACTIVITY_TEST".into(),
        }
    }

    fn temp_root() -> std::path::PathBuf {
        std::env::temp_dir().join(format!("alice-r3-core-activity-{}", Uuid::new_v4()))
    }

    fn region<'a>(snapshot: &'a CoreActivitySnapshot, id: &str) -> &'a CoreActivityRegion {
        snapshot
            .regions
            .iter()
            .find(|region| region.id == id)
            .unwrap()
    }

    fn link<'a>(snapshot: &'a CoreActivitySnapshot, id: &str) -> &'a CoreActivityLink {
        snapshot.links.iter().find(|link| link.id == id).unwrap()
    }

    #[test]
    fn empty_audit_does_not_invent_activity_or_create_storage() {
        let root = temp_root();
        let snapshot = snapshot_at(&root, NOW).unwrap();
        assert_eq!(snapshot.window_event_count, 0);
        assert_eq!(snapshot.overall_signal, 0.0);
        assert!(snapshot.regions.iter().all(|region| region.signal == 0.0));
        assert!(snapshot.links.iter().all(|link| link.signal == 0.0));
        assert!(!root.exists());
    }

    #[test]
    fn events_outside_window_have_zero_signal() {
        let old = event(
            AuditSource::Memory,
            Some("memory.records.write"),
            AuditStage::Execution,
            AuditOutcome::Success,
            CORE_ACTIVITY_WINDOW_MS,
        );
        let snapshot = derive_at(&[old], true, NOW);
        assert_eq!(snapshot.visible_event_count, 1);
        assert_eq!(snapshot.window_event_count, 0);
        assert_eq!(snapshot.overall_signal, 0.0);
    }

    #[test]
    fn permission_perception_event_activates_only_evidenced_route() {
        let camera = event(
            AuditSource::Permission,
            Some("perception.camera.observe"),
            AuditStage::Execution,
            AuditOutcome::Success,
            1_000,
        );
        let snapshot = derive_at(&[camera], true, NOW);
        assert!(region(&snapshot, "permission").signal > 0.0);
        assert!(region(&snapshot, "perception").signal > 0.0);
        assert!(region(&snapshot, "workspace").signal > 0.0);
        assert_eq!(region(&snapshot, "memory").signal, 0.0);
        assert_eq!(region(&snapshot, "language").signal, 0.0);
        assert!(link(&snapshot, "permission-perception").signal > 0.0);
        assert!(link(&snapshot, "perception-workspace").signal > 0.0);
        assert_eq!(link(&snapshot, "workspace-output").signal, 0.0);
    }

    #[test]
    fn memory_and_cloud_events_map_to_distinct_regions_and_links() {
        let events = [
            event(
                AuditSource::Memory,
                Some("memory.records.write"),
                AuditStage::Execution,
                AuditOutcome::Success,
                2_000,
            ),
            event(
                AuditSource::Cloud,
                Some("cloud.conversation.send"),
                AuditStage::Execution,
                AuditOutcome::Success,
                1_000,
            ),
        ];
        let snapshot = derive_at(&events, true, NOW);
        assert_eq!(snapshot.window_event_count, 2);
        assert!(region(&snapshot, "memory").signal > 0.0);
        assert!(region(&snapshot, "language").signal > 0.0);
        assert!(region(&snapshot, "output").signal > 0.0);
        assert!(link(&snapshot, "memory-workspace").signal > 0.0);
        assert!(link(&snapshot, "language-workspace").signal > 0.0);
        assert!(link(&snapshot, "workspace-output").signal > 0.0);
    }

    #[test]
    fn real_jsonl_snapshot_is_read_only() {
        let root = temp_root();
        let stored = event(
            AuditSource::System,
            None,
            AuditStage::Execution,
            AuditOutcome::Success,
            500,
        );
        append_event_at(&root, &stored, AUDIT_MAX_BYTES).unwrap();
        let path = root.join("audit").join("events-v1.jsonl");
        let before = fs::read(&path).unwrap();
        let snapshot = snapshot_at(&root, NOW).unwrap();
        let after = fs::read(&path).unwrap();
        assert_eq!(before, after);
        assert_eq!(snapshot.window_event_count, 1);
        assert!(region(&snapshot, "workspace").signal > 0.0);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "requiere ALICE_LIVE_DATA_DIR apuntando a los datos canónicos"]
    fn live_canonical_audit_derives_without_mutation() {
        let root = std::env::var_os("ALICE_LIVE_DATA_DIR")
            .map(std::path::PathBuf::from)
            .expect("ALICE_LIVE_DATA_DIR requerido");
        let path = root.join("audit").join("events-v1.jsonl");
        let before = fs::read(&path).expect("read live audit before");
        let now = u64::try_from(timestamp_ms().unwrap()).unwrap();
        let snapshot = snapshot_at(&root, now).expect("derive live activity");
        let after = fs::read(&path).expect("read live audit after");
        assert_eq!(before, after);
        assert!(snapshot.visible_event_count > 0);
        assert_eq!(snapshot.method, CORE_ACTIVITY_METHOD);
        assert!(snapshot.heuristic);
    }
}
