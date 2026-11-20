use crate::navigation_model::{Screen, Workspace};
use dioxus::prelude::*;

struct ScreenInfo {
    slug: &'static str,
    label: &'static str,
    accessible: &'static str,
    title: &'static str,
    icon_kind: &'static str,
    svg: &'static str,
}

impl ScreenInfo {
    fn for_screen(screen: Screen) -> Self {
        let (slug, label, accessible, title, icon_kind, svg) = match screen {
            Screen::Dashboard => ("dashboard", "Dashboard", "Dashboard", "DASHBOARD", "", ""),
            Screen::Identificacion => (
                "identificacion",
                "Conversación",
                "Conversación con Alice",
                "CONVERSATION",
                "identification",
                include_str!("../../../icons/cognitive-conversation-channel.svg"),
            ),
            Screen::Nucleo => (
                "nucleo",
                "Volumen cognitivo",
                "Volumen cognitivo",
                "COGNITIVE VOLUME",
                "volume",
                include_str!("../../../icons/cognitive-neural-volume.svg"),
            ),
            Screen::Flujo => (
                "flujo",
                "Flujo cognitivo",
                "Flujo cognitivo",
                "EVIDENCE FLOW",
                "flow",
                include_str!("../../../icons/cognitive-evidence-flow.svg"),
            ),
            Screen::Estado => (
                "estado",
                "Estado y controles",
                "Estado y controles",
                "STATE & CONTROLS",
                "state",
                include_str!("../../../icons/cognitive-state-controls.svg"),
            ),
            Screen::Planificador => (
                "planificador",
                "Planificador",
                "Planificador de acción",
                "ACTION PLANNER",
                "planner",
                include_str!("../../../icons/cognitive-action-planner.svg"),
            ),
            Screen::Memoria => (
                "memoria",
                "Memoria",
                "Memoria",
                "MEMORY VAULT",
                "memory",
                include_str!("../../../icons/cognitive-memory-vault.svg"),
            ),
            Screen::Actividad => (
                "actividad",
                "Actividad",
                "Actividad",
                "COGNITIVE ACTIVITY",
                "activity",
                include_str!("../../../icons/cognitive-activity-timeline.svg"),
            ),
            Screen::Rostro => (
                "rostro",
                "Rostro",
                "Control facial",
                "FACE CALIBRATION",
                "face",
                include_str!("../../../icons/embodiment-face-calibration.svg"),
            ),
            Screen::Cuerpo => (
                "cuerpo",
                "Cuerpo",
                "Solucionador corporal",
                "BODY SOLVER",
                "body",
                include_str!("../../../icons/embodiment-body-solver.svg"),
            ),
            Screen::Avatar => (
                "avatar",
                "Avatar",
                "Avatar local",
                "AVATAR VRM",
                "avatar",
                include_str!("../../../icons/embodiment-avatar-vrm.svg"),
            ),
            Screen::Puentes => (
                "puentes",
                "Capacidades y permisos",
                "Capacidades y permisos",
                "CAPACIDADES Y PERMISOS",
                "bridges",
                include_str!("../../../icons/governance-permissions-gateway.svg"),
            ),
            Screen::Auditoria => (
                "auditoria",
                "Auditoría y diagnóstico",
                "Auditoría y diagnóstico",
                "AUDITORÍA Y DIAGNÓSTICO",
                "audit",
                include_str!("../../../icons/governance-audit-diagnostics.svg"),
            ),
            Screen::Procedimientos => (
                "procedimientos",
                "Procedimientos",
                "Procedimientos observados",
                "PROCEDIMIENTOS OBSERVADOS",
                "procedures",
                include_str!("../../../icons/governance-procedure-observer.svg"),
            ),
            Screen::Habilidades => (
                "habilidades",
                "Taller de habilidades",
                "Taller de habilidades",
                "TALLER DE HABILIDADES",
                "skills",
                include_str!("../../../icons/governance-skill-workshop.svg"),
            ),
            Screen::Configuracion => (
                "configuracion",
                "Configuración",
                "Configuración",
                "CONFIGURACIÓN",
                "settings",
                include_str!("../../../icons/governance-system-settings.svg"),
            ),
        };
        Self {
            slug,
            label,
            accessible,
            title,
            icon_kind,
            svg,
        }
    }
}

pub fn frame(
    screen: Screen,
    (memories, events): (usize, usize),
    mut selected: Signal<(Screen, bool)>,
) -> Element {
    let info = ScreenInfo::for_screen(screen);
    if screen == Screen::Dashboard {
        return rsx! { div { id: "alice-page-outlet", "data-route": "dashboard" } };
    }

    let workspace = screen.workspace();
    let (class, system, title, badge, nav_label) = match workspace {
        Workspace::Cognitive => (
            "cognitive",
            "[SYS.01] COGNITIVE WORKSPACE",
            "ALICE_NEURAL_CORE",
            "LOCAL COGNITIVE CORE",
            "Pantallas del núcleo cognitivo",
        ),
        Workspace::Body => (
            "body",
            "[SYS.02] EMBODIMENT WORKSPACE",
            "ALICE_NEURAL_CORE",
            "PHYSICAL OUTPUT · SAFE OFF",
            "Pantallas de Body Solver",
        ),
        Workspace::Governance => (
            "governance",
            "[SIS.00] GOBERNANZA",
            "CONTROL LOCAL DE ALICE",
            "CONTROL LOCAL DEL PROPIETARIO",
            "Herramientas de gobierno local",
        ),
    };
    let shell = match screen {
        Screen::Identificacion => "shell is-conversation",
        Screen::Nucleo => "shell is-volume",
        _ => "shell",
    };

    rsx! {
        main { class: shell, "data-screen": info.slug,
            header { class: "hero",
                div { class: "brand-line",
                    div { class: "monogram", aria_hidden: "true", "A" }
                    p { class: "eyebrow", "ALICE CONTINUUM · MEMORIA, COGNICIÓN Y PRESENCIA" }
                }
                h1 { span { "Una presencia digital," } " " em { "bajo tu control." } }
                span { class: "privacy-badge", i {} "Local-first" }
            }
            button { r#type: "button", class: "dashboard-entry", onclick: move |_| selected.set((Screen::Dashboard, false)), "← Dashboard" }
            nav { class: "core-system-selector", aria_label: "Sistemas de Alice", role: "tablist",
                for (group, class, code, label, caption) in [
                    (Workspace::Cognitive, "cognitive", "SYS 01 · MENTE Y CONDUCTA", "COGNITIVE CORE", "percepción · memoria · estado · actividad"),
                    (Workspace::Body, "body", "SYS 02 · PRESENCIA FÍSICA", "EMBODIMENT CORE", "rostro · cuerpo · avatar · entorno futuro"),
                    (Workspace::Governance, "governance", "SIS. 00 · CONTROL DEL PROPIETARIO", "NÚCLEO DE GOBERNANZA", "permisos · auditoría · habilidades · ajustes"),
                ] {
                    button { key: "{class}", r#type: "button", role: "tab", aria_selected: workspace == group,
                        class: if workspace == group { format!("selected {class}") } else { class.to_owned() },
                        onclick: move |_| selected.set((group.screens()[0], false)),
                        span { "{code}" } strong { "{label}" } small { "{caption}" }
                    }
                }
            }
            section { class: "core-system-frame system-{class}", aria_labelledby: "active-system-title",
                header { class: "core-system-heading",
                    div {
                        span { "{system}" }
                        h2 { id: "active-system-title", "{title} " em { "// {info.title}" } }
                    }
                    p { i {} "{badge}" }
                }
                nav { class: "screen-tabs grouped", aria_label: nav_label,
                    for &destination in workspace.screens() {
                        {
                            let tab = ScreenInfo::for_screen(destination);
                            let current = destination == screen;
                            let count = match destination {
                                Screen::Memoria => Some((memories, "recuerdos")),
                                Screen::Actividad => Some((events, "eventos")),
                                _ => None,
                            };
                            let accessible = count
                                .map(|(number, kind)| format!("{}, {number} {kind}", tab.accessible))
                                .unwrap_or_else(|| tab.accessible.to_owned());
                            let icon_class = format!("screen-tab-icon icon-{}{}", tab.icon_kind, if current { " is-active" } else { "" });
                            rsx! {
                                button { key: "{tab.slug}", class: if current { "selected" } else { "" },
                                    r#type: "button", aria_label: accessible, "data-tooltip": tab.label,
                                    aria_current: current.then_some("page"),
                                    onclick: move |_| selected.set((destination, destination == Screen::Auditoria)),
                                    // Only the 15 SVGs checked into the project can reach this markup.
                                    span { class: icon_class, aria_hidden: "true", dangerous_inner_html: tab.svg }
                                    span { class: "screen-tab-label", "{tab.label}" }
                                    if let Some((number, _)) = count {
                                        span { class: "screen-count", "{number}" }
                                    }
                                }
                            }
                        }
                    }
                }
                div { id: "alice-page-outlet", class: "core-system-content", "data-route": info.slug }
            }
        }
    }
}
