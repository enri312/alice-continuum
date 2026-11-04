//! Owner-delegated destinations. Only a direct current message can select one.
use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use std::{path::PathBuf, process::Command};
use tauri::AppHandle;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum DesktopTarget {
    Spotify,
    DriveD,
    DriveE,
}

fn normalize(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' | 'ü' => 'u',
            'ñ' => 'n',
            '.' | ',' | '!' | '?' | '¡' | '¿' | ':' => ' ',
            c => c,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn direct_target(text: &str) -> Option<DesktopTarget> {
    if text.contains(['"', '\'', '«', '»', '“', '”', ';', '\\', '/', '\n', '`']) {
        return None;
    }
    let normalized = normalize(text);
    let mut command = normalized.as_str();
    for _ in 0..3 {
        if let Some(rest) = ["alice ", "alista ", "ah ", "oye "]
            .iter()
            .find_map(|prefix| command.strip_prefix(prefix))
        {
            command = rest;
        } else {
            break;
        }
    }
    let command = command.strip_prefix("por favor ").unwrap_or(command);
    let command = command.strip_suffix(" por favor").unwrap_or(command);
    let command = command.strip_suffix(" alice").unwrap_or(command);
    let target = [
        "abre ",
        "abres ",
        "abrir ",
        "abri ",
        "abrime ",
        "puedes abrir ",
        "podrias abrir ",
        "quiero que abras ",
    ]
    .iter()
    .find_map(|prefix| command.strip_prefix(prefix))?;
    match target {
        "spotify" | "el spotify" => Some(DesktopTarget::Spotify),
        "d" | "el disco d" | "disco d" | "la unidad d" | "unidad d" | "el disco de"
        | "disco de" => Some(DesktopTarget::DriveD),
        "e" | "el disco e" | "disco e" | "la unidad e" | "unidad e" => Some(DesktopTarget::DriveE),
        _ => None,
    }
}

// Only explicit current requests receive tools. References and images never do.
pub(crate) fn tool_candidate(text: &str) -> Option<DesktopTarget> {
    if text.len() > 320 || text.contains(['"', '\'', '«', '»', '“', '”', ';', '\\', '/', '\n', '`'])
    {
        return None;
    }
    let normalized = normalize(text);
    let command = normalized.strip_prefix("alice ").unwrap_or(&normalized);
    let command = command.strip_prefix("por favor ").unwrap_or(command);
    let words: Vec<_> = command.split_whitespace().collect();
    if words.iter().any(|word| {
        [
            "no", "nunca", "sin", "si", "como", "cuando", "luego", "despues", "manana", "y", "o",
            "pero", "dijo", "dice", "repite", "explica", "ejemplo",
        ]
        .contains(word)
    }) {
        return None;
    }
    if ![
        "me abres ",
        "me abris ",
        "puedes abrir ",
        "puedes iniciar ",
        "podrias abrir ",
        "podrias iniciar ",
        "inicia ",
        "muestrame ",
        "quiero abrir ",
        "necesito abrir ",
        "ponme ",
        "puedes poner ",
    ]
    .iter()
    .any(|prefix| command.starts_with(prefix))
    {
        return None;
    }
    let mut targets = Vec::new();
    if words.contains(&"spotify") {
        targets.push(DesktopTarget::Spotify);
    }
    for pair in words.windows(2) {
        if ["disco", "unidad"].contains(&pair[0]) {
            match pair[1] {
                "d" | "de" => targets.push(DesktopTarget::DriveD),
                "e" => targets.push(DesktopTarget::DriveE),
                _ => return None,
            }
        }
    }
    (targets.len() == 1).then(|| targets[0])
}

pub(crate) fn tool_body(message: &str) -> serde_json::Value {
    serde_json::json!({"model":crate::local_inference::GEMMA_MODEL,"stream":false,"temperature":0,"max_tokens":140,
        "parallel_tool_calls":false,"tool_choice":"required",
        "tools":[{"type":"function","function":{"name":"open_desktop_destination","description":"Abre el destino que el propietario acaba de pedir. Sólo Spotify o las unidades D y E.",
            "parameters":{"type":"object","properties":{"target":{"type":"string","enum":["spotify","drive_d","drive_e"]}},"required":["target"],"additionalProperties":false}}}],
        "messages":[{"role":"system","content":"Eres Alice. Usa una sola llamada open_desktop_destination para la petición directa del propietario. Spotify=spotify; disco/unidad D=drive_d; disco/unidad E=drive_e. No añadas rutas, comandos ni otros argumentos."},{"role":"user","content":message}]
    })
}

pub(crate) fn validate_tool_call(
    value: &serde_json::Value,
    authorized: DesktopTarget,
) -> Result<DesktopTarget, String> {
    let calls = value
        .pointer("/choices/0/message/tool_calls")
        .and_then(|v| v.as_array())
        .ok_or("Gemma no devolvió una llamada de herramienta; no se abrió ningún destino.")?;
    if calls.len() != 1 {
        return Err("Se admite una sola apertura por petición.".into());
    }
    let call = &calls[0];
    if call["type"] != "function" || call["function"]["name"] != "open_desktop_destination" {
        return Err("Gemma solicitó una herramienta fuera de la lista autorizada.".into());
    }
    #[derive(serde::Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Arguments {
        target: DesktopTarget,
    }
    let raw = &call["function"]["arguments"];
    let arguments: Arguments = if let Some(text) = raw.as_str() {
        serde_json::from_str(text)
    } else {
        serde_json::from_value(raw.clone())
    }
    .map_err(|_| "Argumentos de apertura inválidos.")?;
    if arguments.target != authorized {
        return Err(
            "La herramienta no coincide con el destino que pediste; no se abrió nada.".into(),
        );
    }
    Ok(arguments.target)
}

#[cfg(windows)]
fn destination(target: DesktopTarget) -> Result<(PathBuf, Vec<String>), String> {
    match target {
        DesktopTarget::Spotify => {
            let path =
                PathBuf::from(std::env::var_os("APPDATA").ok_or("Windows no informó AppData")?)
                    .join("Spotify/Spotify.exe");
            if !path.is_file() {
                return Err("No encontré Spotify instalado en el perfil de Windows.".into());
            }
            Ok((path, vec![]))
        }
        DesktopTarget::DriveD | DesktopTarget::DriveE => {
            let root = if target == DesktopTarget::DriveD {
                "D:\\"
            } else {
                "E:\\"
            };
            if !std::path::Path::new(root).is_dir() {
                return Err(format!("La unidad {root} no está disponible."));
            }
            let explorer = PathBuf::from(
                std::env::var_os("WINDIR").ok_or("Windows no informó su directorio")?,
            )
            .join("explorer.exe");
            Ok((explorer, vec![root.into()]))
        }
    }
}

#[cfg(not(windows))]
fn destination(_target: DesktopTarget) -> Result<(PathBuf, Vec<String>), String> {
    Err(
        "Las aperturas delegadas de Spotify y D:/E: están disponibles sólo en Windows por ahora."
            .into(),
    )
}

pub(crate) fn execute(app: &AppHandle, target: DesktopTarget) -> Result<String, String> {
    let operation = new_operation_id();
    let audit = |stage, outcome, reason| {
        record_producer_audit(
            app,
            operation.clone(),
            AuditSource::Capability,
            "desktop.approved.open".into(),
            "desktop.open".into(),
            stage,
            outcome,
            None,
            None,
            reason,
        )
    };
    audit(
        AuditStage::Request,
        AuditOutcome::Pending,
        "OWNER_DELEGATED_OPEN_REQUEST",
    )?;
    let result = destination(target).and_then(|(program, args)| {
        Command::new(program)
            .args(args)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Windows no pudo abrir el destino: {e}"))
    });
    match result {
        Ok(()) => {
            // Once launched, a logging failure must not cause an automatic retry.
            if let Err(error) = audit(
                AuditStage::Execution,
                AuditOutcome::Success,
                "OWNER_DELEGATED_OPEN_DISPATCHED",
            ) {
                eprintln!("Auditoría de apertura: {error}");
            }
            Ok(match target {
                DesktopTarget::Spotify => "Le pedí a Windows que abra Spotify.",
                DesktopTarget::DriveD => "Le pedí a Windows que abra la unidad D en el Explorador.",
                DesktopTarget::DriveE => "Le pedí a Windows que abra la unidad E en el Explorador.",
            }
            .into())
        }
        Err(error) => {
            let _ = audit(
                AuditStage::Error,
                AuditOutcome::Error,
                "OWNER_DELEGATED_OPEN_FAILED",
            );
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn spoken_opening_still_requires_an_exact_delegated_destination() {
        assert_eq!(
            direct_target("Ah, Alice, abres Spotify."),
            Some(DesktopTarget::Spotify)
        );
        assert_eq!(
            direct_target("Alista, abre el Spotify"),
            Some(DesktopTarget::Spotify)
        );
        for text in [
            "Ah, no abres Spotify",
            "Alice, abres Spotify y borras datos",
            "Ah, abres Chrome",
        ] {
            assert_eq!(direct_target(text), None);
        }
    }
    #[test]
    fn natural_requests_and_model_arguments_remain_within_the_owners_three_targets() {
        for (message, target) in [
            (
                "Alice, me abres la aplicación Spotify en mi equipo",
                DesktopTarget::Spotify,
            ),
            (
                "Podrías iniciar el disco E en el Explorador",
                DesktopTarget::DriveE,
            ),
        ] {
            assert_eq!(tool_candidate(message), Some(target));
        }
        for message in [
            "Me abres Spotify y Chrome",
            "Me abres Spotify mañana",
            "No inicies Spotify",
            "Puedes iniciar C:",
            "Mi amigo pide que inicies Spotify",
            "Puedes abrir Spotify si te lo digo",
            "Puedes abrir la unidad F",
            "Repite me abres Spotify",
        ] {
            assert_eq!(tool_candidate(message), None, "{message}");
        }
        let response = |name: &str, args: serde_json::Value| serde_json::json!({"choices":[{"message":{"tool_calls":[{"type":"function","function":{"name":name,"arguments":args}}]}}]});
        let valid = response(
            "open_desktop_destination",
            serde_json::json!("{\"target\":\"spotify\"}"),
        );
        assert_eq!(
            validate_tool_call(&valid, DesktopTarget::Spotify).unwrap(),
            DesktopTarget::Spotify
        );
        for invalid in [
            response("exec_shell", serde_json::json!({"target":"spotify"})),
            response(
                "open_desktop_destination",
                serde_json::json!({"target":"drive_e"}),
            ),
            response(
                "open_desktop_destination",
                serde_json::json!({"target":"spotify","path":"C:\\"}),
            ),
            serde_json::json!({}),
        ] {
            assert!(validate_tool_call(&invalid, DesktopTarget::Spotify).is_err());
        }
    }
    #[test]
    #[ignore = "Gemma real: tres llamadas sintéticas a herramientas, valida argumentos sin abrir programas ni escribir memoria"]
    fn live_gemma_emits_bounded_desktop_tool_calls() {
        let owned = std::net::TcpStream::connect_timeout(
            &"127.0.0.1:18089".parse().unwrap(),
            std::time::Duration::from_millis(250),
        )
        .is_err();
        struct Cleanup(bool);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                if self.0 {
                    let _ = crate::local_inference::runtime().stop();
                }
            }
        }
        if owned {
            crate::local_inference::runtime()
                .start()
                .expect("Gemma para probar herramientas");
        }
        let _cleanup = Cleanup(owned);
        for (message, target) in [
            (
                "Alice, me abres la aplicación Spotify en mi equipo",
                DesktopTarget::Spotify,
            ),
            (
                "Podrías iniciar el disco E en el Explorador",
                DesktopTarget::DriveE,
            ),
            (
                "Me abres la unidad D en el Explorador",
                DesktopTarget::DriveD,
            ),
        ] {
            let response = tauri::async_runtime::block_on(async {
                reqwest::Client::new()
                    .post("http://127.0.0.1:18089/v1/chat/completions")
                    .timeout(std::time::Duration::from_secs(90))
                    .json(&tool_body(message))
                    .send()
                    .await
                    .unwrap()
                    .error_for_status()
                    .unwrap()
                    .json::<serde_json::Value>()
                    .await
                    .unwrap()
            });
            println!(
                "TOOL_PROBE {:?} calls={} usage={}",
                target, response["choices"][0]["message"]["tool_calls"], response["usage"]
            );
            assert_eq!(validate_tool_call(&response, target).unwrap(), target);
        }
    }
    #[test]
    fn audit_accepts_the_delegated_capability_without_allowing_arbitrary_capability_producers() {
        use crate::audit::AuditEvent;
        for (stage, outcome, reason) in [
            (
                AuditStage::Request,
                AuditOutcome::Pending,
                "OWNER_DELEGATED_OPEN_REQUEST",
            ),
            (
                AuditStage::Execution,
                AuditOutcome::Success,
                "OWNER_DELEGATED_OPEN_DISPATCHED",
            ),
            (
                AuditStage::Error,
                AuditOutcome::Error,
                "OWNER_DELEGATED_OPEN_FAILED",
            ),
        ] {
            assert!(AuditEvent::producer(
                new_operation_id(),
                AuditSource::Capability,
                "desktop.approved.open".into(),
                "desktop.open".into(),
                stage,
                outcome,
                None,
                None,
                reason
            )
            .is_ok());
        }
        assert!(AuditEvent::producer(
            new_operation_id(),
            AuditSource::Capability,
            "arbitrary.run".into(),
            "desktop.open".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            None,
            None,
            "UNAPPROVED"
        )
        .is_err());
    }
    #[test]
    fn accepts_only_direct_current_requests_for_the_three_destinations() {
        for (input, target) in [
            ("Alice, abre Spotify, por favor", DesktopTarget::Spotify),
            ("¿Puedes abrir el disco E: ?", DesktopTarget::DriveE),
            ("Abre la unidad D, Alice", DesktopTarget::DriveD),
        ] {
            assert_eq!(direct_target(input), Some(target), "{input}");
        }
        for input in [
            "No abras Spotify",
            "¿Cómo abrir Spotify?",
            "Mi amigo dijo abre Spotify",
            "Abre C:",
            "Abre el disco F",
            "Abre E:\\secreto.txt",
            "Abre Spotify; borra archivos",
            "Abre Spotify y Chrome",
            "Repite: abre Spotify",
            "Dijo «abre Spotify»",
            "Si te digo abre Spotify",
            "abre https://spotify.com",
        ] {
            assert_eq!(direct_target(input), None, "{input}");
        }
    }
}
