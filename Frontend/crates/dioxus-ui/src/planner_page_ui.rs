use crate::planner_page_model::{
    Action, Mutation, Payload, RegistryState, Request, ReservationState, State,
};
use dioxus::prelude::*;
use futures_channel::mpsc::UnboundedReceiver;
use futures_util::StreamExt;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::JsValue;

#[derive(Clone)]
pub struct PageProps {
    pub initial: Payload,
    pub rx: Rc<RefCell<Option<UnboundedReceiver<Payload>>>>,
    pub on_action: js_sys::Function,
    pub on_ready: js_sys::Function,
}

impl PartialEq for PageProps {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

fn emit(callback: &js_sys::Function, serialized: &str) {
    let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(serialized));
}

fn submit(mut state: Signal<State>, callback: &js_sys::Function, action: Action) {
    let request: Option<Request> = state.write().start(action);
    if let Some(serialized) = request.and_then(|request| serde_json::to_string(&request).ok()) {
        emit(callback, &serialized);
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Selection {
    Response,
    Intention,
    Utility,
    Risk,
    Novelty,
    Trace,
}

impl Selection {
    fn details(self) -> (&'static str, &'static str, &'static str) {
        match self {
            Self::Response => ("Respuesta seleccionada", "ninguna", "El planificador todavía no recibió ni comparó respuestas candidatas."),
            Self::Intention => ("Intención", "sin evaluar", "No existe todavía un clasificador de intención conectado al planificador."),
            Self::Utility => ("Utilidad", "sin calcular", "Esta futura puntuación deberá medir el ajuste al objetivo; no representará certeza ni conciencia."),
            Self::Risk => ("Riesgo", "sin calcular", "La revisión previa ya limita los envíos, pero todavía no existe una puntuación formal de riesgo de respuesta."),
            Self::Novelty => ("Novedad", "sin calcular", "No se mide repetición o novedad. El valor permanecerá vacío hasta definir un método verificable."),
            Self::Trace => ("Traza de decisión", "vacía", "No hay una decisión que explicar. La pantalla solo enumera las etapas que deberán producir evidencia real."),
        }
    }
}

pub fn page(props: PageProps) -> Element {
    let Payload::Configure {
        desktop_app,
        persistent_memory_count,
        focus,
        minimum,
    } = &props.initial
    else {
        return rsx! { p { role: "alert", "Planificador no disponible." } };
    };
    let mut state = use_signal(|| {
        State::new(
            *desktop_app,
            *persistent_memory_count > 0,
            focus.clone(),
            minimum.clone(),
        )
    });
    let mut selected = use_signal(|| Selection::Response);
    let rx = props.rx.clone();
    let callback = props.on_action.clone();
    use_future(move || {
        let receiver = rx.borrow_mut().take();
        let callback = callback.clone();
        async move {
            let mut connected = false;
            if let Some(mut receiver) = receiver {
                while let Some(payload) = receiver.next().await {
                    match payload {
                        Payload::Configure {
                            persistent_memory_count,
                            focus,
                            ..
                        } => {
                            let desktop = {
                                let mut view = state.write();
                                view.has_memory = persistent_memory_count > 0;
                                view.focus = focus;
                                view.desktop
                            };
                            if desktop && !connected {
                                connected = true;
                                emit(&callback, r#"{"type":"connect"}"#);
                                submit(state, &callback, Action::Refresh);
                            }
                        }
                        Payload::Activity { value } => state.write().set_activity(value),
                        Payload::TaskResult { id, result } => {
                            let refresh = state.write().complete(id, result);
                            if refresh {
                                submit(state, &callback, Action::Refresh);
                            }
                        }
                    }
                }
            }
        }
    });
    let callback = props.on_action.clone();
    use_future(move || {
        let callback = callback.clone();
        async move {
            while crate::browser_timer::delay(1_000).await.is_ok() {
                if state.peek().can_tick() {
                    submit(state, &callback, Action::Tick);
                }
            }
        }
    });
    let ready = props.on_ready.clone();
    use_effect(move || {
        let _ = ready.call0(&JsValue::NULL);
    });
    let request = use_callback(move |action: Action| submit(state, &props.on_action, action));

    let view = state.read();
    let signal = view.activity.view_state();
    let audit = view.activity.audit_state();
    let signal_label = view.activity.label();
    let provenance = view.activity.summary();
    let listen_state = match &view.activity.status {
        crate::model::ActivityStatus::Ready => "ready",
        crate::model::ActivityStatus::Loading => "loading",
        crate::model::ActivityStatus::Unavailable => "unavailable",
    };
    let method = view
        .activity
        .method
        .as_deref()
        .unwrap_or("r3-recency-motor-v2")
        .to_uppercase();
    let activity = view.has_memory || view.activity.signal_present;
    let source = if activity {
        view.focus.as_str()
    } else {
        "NINGUNA ENTRADA REGISTRADA"
    };
    let selected_item = selected();
    let (label, value, detail) = selected_item.details();
    rsx! {
        section { class: "neuro-panel nucleus-page", "data-activity-state": signal, "aria-labelledby": "[04]-title",
            div { class: "neuro-heading nucleus-page-header is-{signal}", "data-activity-state": signal,
                div { p { class: "eyebrow", "[04] · ESTADO VERIFICABLE" }
                    h2 { id: "[04]-title", "Planificador de acción" }
                    p { class: "nucleus-page-description", "Área reservada para explicar decisiones cognitivas y revisar intenciones temporales gobernadas por el propietario." }
                }
                span { class: "neuro-live {signal} is-{signal}", "data-activity-state": signal, "data-signal-present": signal == "ready",
                    role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-busy": signal == "loading",
                    i { "aria-hidden": "true" } "{signal_label}" }
            }
            div { class: "core-activity-provenance {listen_state} is-{signal} {audit}", "data-activity-state": signal,
                "data-audit-state": audit, role: "status", "aria-live": "polite", "aria-atomic": "true", "aria-busy": signal == "loading",
                strong { "R3 · ACTIVIDAD DERIVADA" } span { "{provenance}" }
                small { "HEURÍSTICA {method} · NO ES EMOCIÓN NI CONCIENCIA" }
            }
            div { class: "neuro-layout",
                div { class: "neuro-stage",
                    div { class: if activity { "action-planner has-context" } else { "action-planner is-empty" },
                        header { class: "planner-header", div { span { "[04]" } strong { "ACTION / LANGUAGE PLANNER" } }
                            p { i {} if activity { "CONTEXTO LOCAL DISPONIBLE" } else { "SIN ENTRADA" } } }
                        section { class: "planner-source", "aria-label": "Fuente del planificador",
                            span { "INPUT CHECKPOINT" } strong { "{source}" }
                            small { if activity { "La entrada existe, pero aún no fue evaluada por un planificador." } else { "Nyxia espera una interacción verificable." } } }
                        button { class: if selected_item == Selection::Response { "planner-response selected" } else { "planner-response" },
                            r#type: "button", "aria-pressed": selected_item == Selection::Response, onclick: move |_| selected.set(Selection::Response),
                            span { "SELECTED RESPONSE // CANDIDATE 000" } strong { "NO HAY RESPUESTA SELECCIONADA" }
                            small { "0 candidatas · generador sin implementar" } i { "aria-hidden": "true" }
                        }
                        section { class: "planner-metrics", "aria-label": "Evaluaciones sin calcular",
                            for (item, code) in [(Selection::Intention,"INT"),(Selection::Utility,"UTL"),(Selection::Risk,"RSK"),(Selection::Novelty,"NOV")] {
                                button { key: "{code}", class: if selected_item == item { "selected" } else { "" },
                                    r#type: "button", "aria-pressed": selected_item == item, onclick: move |_| selected.set(item),
                                    span { i { "{code}" } "{item.details().0}" } span { class: "planner-meter", i {} }
                                    strong { "—" } small { "SIN CALCULAR" }
                                }
                            }
                        }
                        button { class: if selected_item == Selection::Trace { "planner-trace selected" } else { "planner-trace" },
                            r#type: "button", "aria-pressed": selected_item == Selection::Trace, onclick: move |_| selected.set(Selection::Trace),
                            span { class: "planner-section-title", "DECISION TRACE // VACÍA " small { "0 evidencias" } }
                            for (number, module, status) in [("01","CANDIDATE_GENERATOR","NO IMPLEMENTADO"),("02","INTENT_CLASSIFIER","NO IMPLEMENTADO"),("03","SAFETY_SCORER","NO IMPLEMENTADO"),("04","RESPONSE_ARBITER","SIN SELECCIÓN")] {
                                span { key: "{number}", class: "planner-trace-row", i { "{number}" } strong { "{module}" } em { "{status}" } }
                            }
                        }
                        div { class: "planner-queue", span { "CANDIDATE QUEUE" } strong { "000" } i {} small { "Ningún texto espera evaluación o salida." } }
                    }
                }
                aside { class: "neuro-inspector", p { class: "eyebrow", "INSPECTOR" } h3 { "{label}" }
                    span { class: "inspector-value", "{value}" } p { "{detail}" } small { "La pantalla es descriptiva; no genera, selecciona ni ejecuta respuestas." } }
            }
            {tasks(state, request)}
            p { class: "neuro-footnote", "El planificador cognitivo no inventa intención, utilidad, riesgo ni novedad. R7 sólo persiste un recordatorio después de una revisión y confirmación explícitas; todavía no lo ejecuta." }
        }
    }
}

fn tasks(mut state: Signal<State>, request: Callback<Action>) -> Element {
    let view = state.read();
    let mode = view.indicator();
    let busy = view.busy();
    let registry = view.registry.as_ref();
    let engine = view.engine.as_ref();
    let ledger = view.ledger.as_ref();
    let plan = view.plan.as_ref();
    let registry_state = registry.map(|item| item.state.attr()).unwrap_or("missing");
    let registry_label = if mode == "status" {
        "LEYENDO".into()
    } else {
        match registry_state {
            "ready" => format!("{} REGISTRADAS", registry.map_or(0, |item| item.task_count)),
            "invalid" => "REGISTRO BLOQUEADO".into(),
            _ => "REGISTRO NUEVO".into(),
        }
    };
    let running = engine.is_some_and(|engine| engine.background_enabled);
    let due_count = engine.map_or(0, |engine| engine.due_count);
    let no_next = "SIN PRÓXIMA EJECUCIÓN";
    let reservation_count = ledger.map_or(0, |ledger| ledger.reservation_count);
    let accepted = ledger.map_or(0, |ledger| {
        ledger
            .reservations
            .iter()
            .filter(|item| item.state == ReservationState::Accepted)
            .count()
    });
    let ledger_label = match ledger.map(|item| &item.state) {
        Some(RegistryState::Ready) => "VÁLIDO",
        Some(RegistryState::Invalid) => "BLOQUEADO",
        _ => "VACÍO",
    };
    let ledger_blocked = ledger.is_none_or(|item| item.state == RegistryState::Invalid);
    rsx! {
        section { class: "task-registry", "aria-labelledby": "task-registry-title",
            header { class: "task-registry-heading",
                div { p { class: "eyebrow", "R7 · CONTROL DEL PROPIETARIO" } h3 { id: "task-registry-title", "Recordatorios e intenciones temporales" }
                    p { "Preparar no guarda. Confirmar vuelve a leer identidad, hora, alcance y huella antes de escribir." } }
                div { class: "task-registry-state {registry_state}", i {} "{registry_label}" }
            }
            if !view.desktop {
                div { class: "task-registry-unavailable", strong { "ESCRITORIO NATIVO REQUERIDO" } span { "El navegador no puede confirmar ni cancelar tareas locales." } }
            } else {
                div { class: "task-registry-grid",
                    section { class: "task-composer",
                        header { span { "01" } div { strong { "PREPARAR RECORDATORIO ÚNICO" } small { "Sin escritura · sin notificación · sin ejecutor" } } }
                        label { "TÍTULO VISIBLE" input { value: "{view.title}", maxlength: 120, disabled: busy, placeholder: "Ej.: Recordarme revisar el Roadmap",
                            oninput: move |event| { let mut view = state.write(); if !view.busy() { view.discard(); view.title = event.value(); } } } }
                        label { "FECHA Y HORA LOCAL" input { r#type: "datetime-local", min: "{view.minimum}", value: "{view.next_run_local}", disabled: busy,
                            oninput: move |event| { let mut view = state.write(); if !view.busy() { view.discard(); view.next_run_local = event.value(); } } } }
                        button { r#type: "button", class: "task-primary", disabled: !view.can_prepare(),
                            onclick: move |_| {
                                let (title, next_run_local) = { let view = state.peek(); (view.title.clone(), view.next_run_local.clone()) };
                                request.call(Action::Prepare { title, next_run_local });
                            },
                            if mode == "preview" { "PREPARANDO…" } else { "PREPARAR VISTA PREVIA" }
                        }
                        small { "La hora se convierte a UTC en el plan, pero aquí se muestra en tu zona local." }
                    }
                    section { class: if plan.is_some() { "task-preview ready" } else { "task-preview empty" },
                        header { span { "02" } div { strong { "REVISIÓN HUMANA" } small { if plan.is_some() { "Plan ligado por SHA-256" } else { "Esperando una vista previa" } } } }
                        if let Some(plan) = plan {
                            {
                                let cancel = plan.action == Mutation::CancelTask;
                                let id = plan.plan_id.clone();
                                rsx! {
                                    dl {
                                        div { dt { "Operación" } dd { if cancel { "CANCELAR" } else { "PROGRAMAR" } } }
                                        div { dt { "Título" } dd { "{plan.title}" } }
                                        div { dt { "Hora" } dd { "{plan.time_label}" } }
                                        div { dt { "Identidad" } dd { title: "{plan.task_id}", "{plan.task_id}" } }
                                        div { dt { "Alcance" } dd { "NOTIFICACIÓN LOCAL" } }
                                        div { dt { "Respaldo" } dd { if plan.backup_required { "OBLIGATORIO" } else { "FUENTE NUEVA" } } }
                                        div { dt { "Ejecución" } dd { class: "safe", "APAGADA" } }
                                    }
                                    label { class: "task-review-check",
                                        input { r#type: "checkbox", checked: view.reviewed, disabled: busy,
                                            onchange: move |event| { let mut view = state.write(); if !view.busy() { view.reviewed = event.checked(); } } }
                                        span { "Revisé título, fecha, identidad y alcance. Quiero confirmar exactamente este plan." }
                                    }
                                    div { class: "task-preview-actions",
                                        button { r#type: "button", disabled: busy, onclick: move |_| state.write().discard(), "DESCARTAR" }
                                        button { r#type: "button", class: if cancel { "task-danger" } else { "task-confirm" }, disabled: !view.reviewed || busy,
                                            onclick: move |_| request.call(Action::Confirm { plan_id: id.clone() }),
                                            if mode == "confirm" { "CONFIRMANDO…" } else if cancel { "CONFIRMAR CANCELACIÓN" } else { "CONFIRMAR RECORDATORIO" }
                                        }
                                    }
                                }
                            }
                        } else {
                            div { class: "task-preview-empty", span { "SHA-256" } strong { "NINGÚN PLAN PREPARADO" } small { "Los campos de la izquierda todavía no han producido ninguna escritura." } }
                        }
                    }
                }
                if !view.error.is_empty() {
                    div { class: "task-registry-error", role: "alert", strong { "OPERACIÓN BLOQUEADA" } span { "{view.error}" } }
                }
                if let Some(receipt) = &view.receipt {
                    div { class: "task-registry-receipt", role: "status",
                        strong { if receipt.audit.idempotent { "OPERACIÓN YA APLICADA" } else { "OPERACIÓN CONFIRMADA" } }
                        span { "Revisión {receipt.revision_id} · auditoría " if receipt.audit.audit_written { "escrita" } else { "sin duplicar" } " · ejecución automática apagada" }
                    }
                }
                if let Some(receipt) = &view.reservation {
                    div { class: "task-registry-receipt", role: "status", strong { if receipt.idempotent { "RESERVA YA EXISTENTE" } else { "RESERVA DURABLE CREADA" } }
                        span { "Sin aviso, salida ni cambio de tarea · auditoría " if receipt.audit_written { "escrita" } else { "sin duplicar" } } }
                }
                if let Some(receipt) = &view.notification {
                    div { class: if receipt.notification_accepted { "task-registry-receipt" } else { "task-registry-receipt failed" }, role: "status",
                        strong { if receipt.notification_accepted { "NOTIFICACIÓN ACEPTADA POR EL SISTEMA" } else { "NOTIFICACIÓN RECHAZADA" } }
                        span { if receipt.audit.idempotent { "Resultado terminal recuperado sin repetir" } else { "Resultado nuevo" }
                            " · red OFF · procesos externos 0 · auditoría " if receipt.audit.audit_written { "escrita" } else { "pendiente" } } }
                }
                section { class: "task-clock",
                    header { div { span { "05" } div { strong { "COMPROBACIÓN R7.5 · SÓLO LECTURA" } small { "Relee R1 ahora; no ejecuta la capacidad elegida" } } } b { "MEMORIA OFF" } }
                    div { class: "task-clock-body", div {
                        p { "La comprobación bloquea mutaciones, red, procesos, notificaciones, cámara, micrófono y pantalla. Si una capacidad exige R2, verifica que su grant siga activo; nunca lo crea ni lo consume." }
                        label { "CAPACIDAD R1" select { value: "{view.capability_id}", disabled: busy,
                            onchange: move |event| { let mut view = state.write(); if !view.busy() { view.capability_id = event.value(); view.check = None; } },
                            for capability in &view.capabilities { option { key: "{capability.id}", value: "{capability.id}", "{capability.label} · {capability.id}" } }
                        } }
                        button { r#type: "button", disabled: busy || view.capability_id.is_empty(),
                            onclick: move |_| { let capability_id = state.peek().capability_id.clone(); request.call(Action::Check { capability_id }); },
                            if mode == "check" { "COMPROBANDO…" } else { "COMPROBAR ESTADO ACTUAL" }
                        }
                    } }
                    if let Some(receipt) = &view.check {
                        footer { span { if receipt.capability_state == "eligible" { "APTA PARA LECTURA" } else { "COMPROBACIÓN BLOQUEADA" } }
                            span { "{receipt.reason}" } span { "R2 " if receipt.r2_required { if receipt.r2_active { "ACTIVO" } else { "REQUERIDO" } } else { "NO REQUERIDO" } }
                            span { "EJECUCIÓN 0 · MEMORIA 0 · ESCRITURAS 0 · RED 0" } }
                    }
                }
                section { class: if running { "task-clock active" } else { "task-clock off" },
                    header { div { span { "03" } div { strong { "SENTIDO TEMPORAL · R7.3-A" } small { "Clasifica el tiempo; no intenta actuar" } } }
                        b { if running { "EVALUACIÓN ACTIVA" } else { "APAGADO" } } }
                    div { class: "task-clock-body",
                        dl {
                            div { dt { "FUTURAS" } dd { "{engine.map_or(0, |engine| engine.waiting_count)}" } }
                            div { dt { "VENCIDAS" } dd { class: if due_count > 0 { "due" } else { "" }, "{due_count}" } }
                            div { dt { "EXCLUIDAS" } dd { "{engine.map_or(0, |engine| engine.excluded_count)}" } }
                            div { dt { "PRÓXIMA EVALUACIÓN ÚTIL" } dd { "{engine.map_or(no_next, |engine| engine.next_label.as_str())}" } }
                        }
                        div {
                            p { if running { "Nyxia relee el reloj una vez por segundo. El estado vive sólo en RAM y vuelve apagado al reiniciar." }
                                else { "La evaluación periódica está detenida. La lectura manual de esta pantalla no escribe ni activa procesos de salida." } }
                            button { r#type: "button", disabled: busy || engine.is_none_or(|engine| engine.registry_state == RegistryState::Invalid),
                                onclick: move |_| request.call(Action::Toggle { enabled: !running }),
                                if running { "DETENER EVALUACIÓN" } else { "ACTIVAR RELOJ INTERNO" }
                            }
                        }
                    }
                    footer { span { "EJECUCIÓN OFF" } span { "NOTIFICACIONES OFF" } span { "ESCRITURAS 0" }
                        span { if let Some(pulse) = engine.and_then(|engine| engine.pulse_label.as_ref()) { "ÚLTIMO PULSO {pulse}" } else { "SIN PULSOS EN SEGUNDO PLANO" } } }
                }
                section { class: "task-clock",
                    header { div { span { "03B" } div { strong { "RESERVAS DE DESPACHO · R7.3-B" } small { "Protección contra duplicados antes de una futura salida" } } } b { "{reservation_count} RESERVAS" } }
                    div { class: "task-clock-body", dl {
                        div { dt { "LEDGER" } dd { "{ledger_label}" } } div { dt { "RESERVAS" } dd { "{reservation_count}" } }
                        div { dt { "ACEPTADAS" } dd { "{accepted}" } } div { dt { "AUTOMÁTICAS" } dd { "OFF" } }
                    } div { p { "Reservar no muestra nada. Entregar exige otra confirmación y registra el resultado antes de permitir cualquier reintento." } } }
                    if let Some(engine) = engine {
                        for due in &engine.due {
                            {
                                let reservation = ledger.and_then(|ledger| ledger.reservations.iter().find(|entry| entry.task_id == due.task_id && entry.scheduled_for == due.scheduled_for));
                                let reservation_status = reservation.map(|entry| entry.state.attr()).unwrap_or("unreserved");
                                let reserve = Action::Reserve { task_id: due.task_id.clone(), scheduled_for: due.scheduled_for.clone() };
                                rsx! {
                                    div { key: "{due.task_id}", class: "task-reserve-row {reservation_status}",
                                        span { "{due.title} · {due.time_label}" }
                                        if let Some(entry) = reservation {
                                            if entry.state == ReservationState::Reserved {
                                                {
                                                    let deliver = Action::Dispatch { attempt_id: entry.attempt_id.clone(), idempotency_key: entry.idempotency_key.clone() };
                                                    rsx! { button { r#type: "button", disabled: busy || ledger_blocked, onclick: move |_| request.call(deliver.clone()), "ENTREGAR AVISO LOCAL" } }
                                                }
                                            } else {
                                                b { if entry.state == ReservationState::Accepted { "ACEPTADA POR EL SISTEMA" }
                                                    else if entry.state == ReservationState::Failed { "ENTREGA FALLIDA" } else { "RESULTADO INCIERTO · NO REINTENTAR" } }
                                            }
                                        } else {
                                            button { r#type: "button", disabled: busy || ledger_blocked, onclick: move |_| request.call(reserve.clone()), "RESERVAR UNA VEZ" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                section { class: "task-list",
                    header { div { span { "04" } strong { "REGISTRO LOCAL" } } small { "{registry.map_or(0, |registry| registry.scheduled_count)} programadas · {registry.map_or(0, |registry| registry.cancelled_count)} canceladas" } }
                    if let Some(registry) = registry.filter(|registry| !registry.tasks.is_empty()) {
                        div { class: "task-list-items",
                            for task in &registry.tasks {
                                {
                                    let (status, label) = task.status.display();
                                    let task_id = task.task_id.clone();
                                    rsx! {
                                        article { key: "{task.task_id}",
                                            div { span { class: "task-status {status}", "{label}" } strong { "{task.title}" }
                                                small { "{task.time_label} · " if task.local_notification { "AVISO LOCAL" } else { "LECTURA R1" } } }
                                            button { r#type: "button", disabled: busy || !task.cancellable,
                                                onclick: move |_| request.call(Action::Cancel { task_id: task_id.clone() }),
                                                if task.cancellable { "PREPARAR CANCELACIÓN" } else { "SIN ACCIÓN" } }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        div { class: "task-list-empty", strong { "0 TAREAS REALES" } span { "No se fabricaron tareas para poblar esta pantalla." } }
                    }
                }
            }
            footer { span { "DESPACHO MANUAL" } span { "NOTIFICACIONES AUTOMÁTICAS OFF" } span { "RED OFF" } span { "AUTOMATIC EXECUTION FALSE" } }
        }
    }
}
