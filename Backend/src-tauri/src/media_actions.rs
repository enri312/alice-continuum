//! Current owner requests only. Song names are data, never URLs or commands.
use crate::audit::{
    new_operation_id, record_producer_audit, AuditOutcome, AuditSource, AuditStage,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MediaService {
    Spotify,
    Youtube,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum MediaOperation {
    Open,
    Play,
    Resume,
    Pause,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MediaRequest {
    pub service: Option<MediaService>,
    pub operation: MediaOperation,
    pub query: Option<String>,
}
#[derive(Default)]
struct PlaybackContext {
    service: Option<MediaService>,
    youtube_id: Option<String>,
}
#[derive(Clone, Default)]
pub(crate) struct MediaPlaybackStore(Arc<Mutex<PlaybackContext>>);
impl MediaPlaybackStore {
    pub(crate) fn opened_spotify(&self) {
        if let Ok(mut context) = self.0.lock() {
            context.service = Some(MediaService::Spotify);
        }
    }
    fn remember(&self, service: MediaService, video: Option<String>) {
        if let Ok(mut context) = self.0.lock() {
            context.service = Some(service);
            if video.is_some() {
                context.youtube_id = video;
            }
        }
    }
}
pub(crate) type CancellationCheck = Arc<dyn Fn() -> Result<(), String> + Send + Sync>;

fn folded(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' | 'ü' => 'u',
            'ñ' => 'n',
            c => c,
        })
        .collect()
}
struct Word {
    text: String,
    start: usize,
    end: usize,
}
fn words(text: &str) -> Vec<Word> {
    let mut result = Vec::new();
    let mut start = None;
    for (at, c) in text
        .char_indices()
        .chain(std::iter::once((text.len(), ' ')))
    {
        if c.is_alphanumeric() {
            if start.is_none() {
                start = Some(at);
            }
        } else if let Some(from) = start.take() {
            result.push(Word {
                text: folded(&text[from..at]),
                start: from,
                end: at,
            });
        }
    }
    result
}
fn likes(text: &str) -> bool {
    // Collapse ASR hesitations only for known collection aliases, never song titles.
    let mut words: Vec<&str> = text
        .trim_matches(|c: char| !c.is_alphanumeric())
        .split_whitespace()
        .collect();
    words.dedup();
    let text = words.join(" ");
    matches!(
        text.as_str(),
        "tus me gusta"
            | "mis me gusta"
            | "me gusta"
            | "liked songs"
            | "mis canciones favoritas"
            | "canciones que me gustan"
            | "canciones que te gustan"
            | "musica"
            | "la musica"
            | "mi musica"
            | "mi playlist"
            | "mi lista"
            | "mi lista de reproduccion"
    )
}

fn request_start(all: &[Word]) -> Option<usize> {
    let mut from = 0;
    // Spoken fillers and the observed ASR rendering of Alice are accepted only
    // before a direct verb. This does not scan stories for embedded commands.
    for _ in 0..5 {
        match all.get(from)?.text.as_str() {
            "alice" | "alista" | "ah" | "eh" | "oye" | "hola" | "bueno" | "puedes" | "podrias"
            | "me" => from += 1,
            "por" if all.get(from + 1)?.text == "favor" => from += 2,
            "quiero" if all.get(from + 1)?.text == "que" => from += 2,
            _ => break,
        }
    }
    Some(from)
}

fn verb_operation(word: &str) -> Option<MediaOperation> {
    Some(match word {
        "abre" | "abres" | "abras" | "abrir" | "abri" | "abrime" => MediaOperation::Open,
        "reproduce" | "reproduces" | "reproduzcas" | "reproducir" | "reproduci" | "pon"
        | "ponme" | "pones" | "poner" | "toca" => MediaOperation::Play,
        "reanuda" | "reanudas" | "continua" | "continuas" | "retoma" => MediaOperation::Resume,
        "pausa" | "pausas" | "pausar" | "deten" | "detener" => MediaOperation::Pause,
        _ => return None,
    })
}

pub(crate) fn parse_request(text: &str) -> Option<MediaRequest> {
    let text = text.trim();
    if text.len() > 900
        || text.starts_with(['"', '\'', '«', '“', '`'])
        || text.contains(['\n', '\r', '\0'])
    {
        return None;
    }
    let all = words(text);
    let mut from = request_start(&all)?;
    let mut end = all.len();
    if all.last()?.text == "alice" {
        end -= 1;
    }
    if end >= 2 && all[end - 2].text == "por" && all[end - 1].text == "favor" {
        end -= 2;
    }
    let verb = all.get(from)?;
    if text[..verb.start].contains(['"', '\'', '«', '“', '`']) {
        return None;
    }
    let operation = verb_operation(&verb.text)?;
    from += 1;
    let mut browser_play = false;
    if operation == MediaOperation::Open {
        let mut browser = from;
        if all.get(browser).is_some_and(|w| w.text == "el") {
            browser += 1;
        }
        if all
            .get(browser)
            .is_some_and(|w| matches!(w.text.as_str(), "navegador" | "chrome"))
            && all.get(browser + 1).is_some_and(|w| w.text == "y")
            && all.get(browser + 2).and_then(|w| verb_operation(&w.text))
                == Some(MediaOperation::Play)
        {
            browser_play = true;
            from = browser + 3;
        }
    }
    if operation == MediaOperation::Open {
        for _ in 0..2 {
            if all.get(from).and_then(|w| verb_operation(&w.text)) == Some(operation) {
                from += 1;
            }
        }
    }
    if from >= end {
        return (operation != MediaOperation::Open).then_some(MediaRequest {
            service: None,
            operation,
            query: None,
        });
    }
    // Optional explicit browser qualifier. No other browser or destination is accepted.
    let mut names: Vec<&str> = all[from..end].iter().map(|w| w.text.as_str()).collect();
    for suffix in [&["en", "google", "chrome"][..], &["en", "chrome"][..]] {
        if names.ends_with(suffix) {
            end -= suffix.len();
            names.truncate(names.len() - suffix.len());
            break;
        }
    }
    let service_of = |word: &str| match word {
        "spotify" => Some(MediaService::Spotify),
        "youtube" => Some(MediaService::Youtube),
        _ => None,
    };
    let mut service = None;
    if end > from && service_of(&all[end - 1].text).is_some() {
        service = service_of(&all[end - 1].text);
        end -= 1;
        if end > from && matches!(all[end - 1].text.as_str(), "en" | "de" | "del") {
            end -= 1;
        }
    } else {
        let mut prefix = from;
        if all.get(prefix)?.text == "en" {
            prefix += 1;
        }
        if all
            .get(prefix)
            .is_some_and(|w| matches!(w.text.as_str(), "el" | "la"))
        {
            prefix += 1;
        }
        if all
            .get(prefix)
            .is_some_and(|w| matches!(w.text.as_str(), "aplicacion" | "programa"))
        {
            prefix += 1;
        }
        if let Some(found) = all.get(prefix).and_then(|w| service_of(&w.text)) {
            service = Some(found);
            from = prefix + 1;
        }
    }
    // Opening and playing the same explicit service is one bounded operation.
    if browser_play && service != Some(MediaService::Youtube) {
        return None;
    }
    let mut operation = if browser_play {
        MediaOperation::Play
    } else {
        operation
    };
    if operation == MediaOperation::Open && from < end && all[from].text == "y" {
        from += 1;
        if verb_operation(&all.get(from)?.text) == Some(MediaOperation::Play) {
            operation = MediaOperation::Play;
            from += 1;
        } else {
            return None;
        }
    }
    let mut explicit_song = false;
    let mut explicit_playlist = false;
    if from < end
        && (matches!(all[from].text.as_str(), "la" | "el")
            || (all[from].text == "mi"
                && all
                    .get(from + 1)
                    .is_some_and(|word| word.text == "playlist")
                && from + 2 < end))
        && all
            .get(from + 1)
            .is_some_and(|w| w.text == "cancion" || w.text == "playlist")
    {
        explicit_song = true;
        explicit_playlist = all[from + 1].text == "playlist";
        from += 2;
    }
    if from < end && matches!(all[from].text.as_str(), "cancion" | "playlist") {
        explicit_song = true;
        explicit_playlist = all[from].text == "playlist";
        from += 1;
    }
    let query = (from < end).then(|| {
        let start_byte = if from > 0 {
            all[from - 1].end
        } else {
            all[from].start
        };
        let end_byte = if end < all.len() {
            all[end].start
        } else {
            text.len()
        };
        let raw = text[start_byte..end_byte]
            .trim()
            .trim_end_matches(',')
            .trim();
        let mut title = raw;
        for (left, right) in [("\"", "\""), ("'", "'"), ("«", "»"), ("“", "”")] {
            if let Some(inner) = raw.strip_prefix(left).and_then(|v| v.strip_suffix(right)) {
                title = inner;
                break;
            }
        }
        title.trim().to_string()
    });
    let query = query.filter(|q| !q.is_empty());
    let query = query.map(|q| {
        if explicit_playlist && !likes(&folded(&q)) {
            format!("playlist {q}")
        } else {
            q
        }
    });
    if service.is_none()
        && query
            .as_deref()
            .is_some_and(|q| likes(&folded(q)) || crate::spotify_playlists::refers_to_favorites(q))
    {
        service = Some(MediaService::Spotify);
    }
    if service.is_none() && query.is_some() && !explicit_song && operation == MediaOperation::Play {
        return None;
    }
    if operation == MediaOperation::Open {
        if service != Some(MediaService::Youtube) || query.is_some() {
            return None;
        }
    } else if matches!(operation, MediaOperation::Pause | MediaOperation::Resume)
        && query.as_deref().is_some_and(|q| {
            !matches!(
                folded(q).as_str(),
                "musica" | "la musica" | "eso" | "la reproduccion"
            )
        })
    {
        return None;
    }
    if query.as_ref().is_some_and(|q| q.chars().count() > 180) {
        return None;
    }
    // Generic playback may refer to the service actually opened by Alice.
    let query = if service == Some(MediaService::Spotify)
        && query.as_deref().is_some_and(|q| likes(&folded(q)))
    {
        None
    } else {
        query
    };
    Some(MediaRequest {
        service,
        operation,
        query: if operation == MediaOperation::Play {
            query
        } else {
            None
        },
    })
}

// A declined direct request must not fall through to a model inventing a receipt.
// These replies never execute an action or infer authority from previous turns.
fn ambiguous_addressed_action(text: &str, all: &[Word]) -> bool {
    // This is a bounded ambiguity check, not a general Spanish verb parser.
    // Never turn an unrecognised word into a delegated media operation.
    if text.contains(['¿', '?'])
        || all.len() != 3
        || all[0].text != "alice"
        || !matches!(all[2].text.as_str(), "spotify" | "youtube")
    {
        return false;
    }
    let candidate = all[1].text.as_str();
    if !(3..=32).contains(&candidate.len())
        || !candidate.bytes().all(|byte| byte.is_ascii_alphabetic())
        || verb_operation(candidate).is_some()
        || !(candidate.ends_with(['a', 'e']) || candidate.starts_with("re"))
    {
        return false;
    }
    // Preserve short informational phrases that share that surface form.
    !matches!(
        candidate,
        "nunca"
            | "aunque"
            | "quiza"
            | "ojala"
            | "que"
            | "donde"
            | "porque"
            | "explica"
            | "explicame"
            | "define"
            | "defineme"
            | "describe"
            | "describeme"
            | "resume"
            | "resumeme"
            | "recomienda"
            | "recomiendas"
            | "recomiendame"
            | "recomiendo"
            | "dime"
            | "cuenta"
            | "cuentame"
            | "habla"
            | "hablame"
            | "comenta"
            | "comentame"
            | "compara"
            | "comparame"
            | "analiza"
            | "analizame"
            | "aclara"
            | "aclarame"
            | "detalla"
            | "detallame"
            | "ensena"
            | "ensename"
            | "responde"
            | "respondeme"
            | "respondes"
            | "historia"
            | "funciona"
            | "coste"
            | "tarifa"
            | "musica"
            | "artista"
            | "ayuda"
            | "alternativa"
            | "problema"
            | "reproduccion"
            | "reproductor"
            | "recomendacion"
            | "recuerdo"
    )
}

pub(crate) fn clarification(text: &str) -> Option<&'static str> {
    if text.len() > 900 || text.contains(['"', '\'', '«', '»', '“', '”', '`', '\n', '\r']) {
        return None;
    }
    if crate::desktop_actions::direct_target(text).is_some()
        || crate::desktop_actions::tool_candidate(text).is_some()
    {
        return None;
    }
    let all = words(text);
    let service = all
        .iter()
        .any(|w| matches!(w.text.as_str(), "spotify" | "youtube"));
    let bare_service = all.len() == 1 && service;
    // ASR may preserve the addressee and service while losing the action.
    // This bounded mention must ask for clarification, never guess playback.
    let addressed_service = all.len() == 2 && all[0].text == "alice" && service;
    let direct = request_start(&all)
        .and_then(|from| all.get(from))
        .and_then(|w| verb_operation(&w.text))
        .is_some();
    (bare_service || addressed_service || ambiguous_addressed_action(text, &all) || (service && direct)).then_some(
        "No entendí si quieres abrir, pausar, reanudar o reproducir música. No envié ninguna orden al reproductor. Repite la petición completa, incluyendo la acción y el servicio.",
    )
}
pub(crate) fn asks_tool_choice(text: &str) -> bool {
    let text = folded(text);
    text.split(|c: char| !c.is_alphanumeric())
        .any(|w| w == "puedes" || w == "podrias")
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum ToolService {
    Spotify,
    Youtube,
    Last,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ToolArguments {
    service: ToolService,
    operation: MediaOperation,
    query: String,
}
fn tool_arguments(request: &MediaRequest) -> serde_json::Value {
    serde_json::json!({"service":match request.service {Some(MediaService::Spotify)=>"spotify",Some(MediaService::Youtube)=>"youtube",None=>"last"},"operation":request.operation,"query":request.query.as_deref().unwrap_or("")})
}
pub(crate) fn tool_body(message: &str) -> serde_json::Value {
    let authorized = parse_request(message)
        .map(|r| tool_arguments(&r))
        .unwrap_or(serde_json::Value::Null);
    serde_json::json!({"model":crate::local_inference::GEMMA_MODEL,"stream":false,"temperature":0,"max_tokens":220,"parallel_tool_calls":false,"tool_choice":"required",
        "tools":[{"type":"function","function":{"name":"control_media","description":"Controla exclusivamente Spotify o YouTube en Chrome con los argumentos autorizados.","parameters":{"type":"object","properties":{"service":{"type":"string","enum":["spotify","youtube","last"]},"operation":{"type":"string","enum":["open","play","resume","pause"]},"query":{"type":"string"}},"required":["service","operation","query"],"additionalProperties":false}}}],
        "messages":[{"role":"system","content":format!("Eres Alice. Emite una sola llamada control_media. Copia exactamente estos argumentos ya validados de la petición actual: {authorized}. query es una cadena vacía cuando no hay título. No traduzcas el título ni cambies el servicio. No escribas explicaciones.")},{"role":"user","content":message}]
    })
}
pub(crate) fn validate_tool_call(
    value: &serde_json::Value,
    authorized: &MediaRequest,
) -> Result<(), String> {
    let calls = value
        .pointer("/choices/0/message/tool_calls")
        .and_then(|v| v.as_array())
        .ok_or("Gemma no devolvió una herramienta musical válida")?;
    if calls.len() != 1
        || calls[0]["type"] != "function"
        || calls[0]["function"]["name"] != "control_media"
    {
        return Err("La llamada musical salió del contrato autorizado".into());
    }
    let raw = &calls[0]["function"]["arguments"];
    let args: ToolArguments = if let Some(raw) = raw.as_str() {
        serde_json::from_str(raw)
    } else {
        serde_json::from_value(raw.clone())
    }
    .map_err(|_| "Argumentos musicales inválidos")?;
    let service = match args.service {
        ToolService::Spotify => Some(MediaService::Spotify),
        ToolService::Youtube => Some(MediaService::Youtube),
        ToolService::Last => None,
    };
    let query = if args.query.is_empty()
        || (service == Some(MediaService::Spotify) && likes(&folded(&args.query)))
    {
        None
    } else {
        Some(args.query)
    };
    let request = MediaRequest {
        service,
        operation: args.operation,
        query,
    };
    if &request != authorized {
        return Err(
            "La herramienta cambió la canción o el reproductor solicitado; no se ejecutó".into(),
        );
    }
    Ok(())
}

#[cfg(any(windows, test))]
#[derive(Clone, Debug)]
pub(crate) struct YoutubeVideo {
    pub id: String,
    pub title: String,
}
#[cfg(any(windows, test))]
fn video_id(id: &str) -> bool {
    id.len() == 11
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
#[cfg(any(windows, test))]
pub(crate) fn youtube_watch_url(id: &str) -> Result<String, String> {
    if !video_id(id) {
        return Err("YouTube devolvió un identificador de vídeo inválido".into());
    }
    Ok(format!("https://www.youtube.com/watch?v={id}&autoplay=1"))
}
#[cfg(any(windows, test))]
pub(crate) fn youtube_search_url(query: &str) -> Result<reqwest::Url, String> {
    reqwest::Url::parse_with_params(
        "https://www.youtube.com/results",
        &[("search_query", query), ("hl", "es")],
    )
    .map_err(|e| e.to_string())
}

// Metadata comes from the visible, requested YouTube search in Chrome.
// Links are treated as untrusted data; only canonical YouTube watch IDs survive.
#[cfg(any(windows, test))]
pub(crate) fn select_youtube_link(
    links: Vec<(String, String)>,
    query: &str,
) -> Result<YoutubeVideo, String> {
    let normalized = folded(query);
    let terms: Vec<_> = normalized
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() > 1 && !["de", "la", "el", "cancion", "video"].contains(w))
        .collect();
    let mut best = None;
    let mut best_score = 0;
    let mut ids = std::collections::HashSet::new();
    for (href, title) in links {
        let Ok(url) = reqwest::Url::parse(&href) else {
            continue;
        };
        if url.scheme() != "https"
            || !matches!(url.host_str(), Some("www.youtube.com" | "youtube.com"))
            || url.path() != "/watch"
            || !url.username().is_empty()
            || url.password().is_some()
        {
            continue;
        }
        let Some(id) = url
            .query_pairs()
            .find(|(k, _)| k == "v")
            .map(|(_, v)| v.into_owned())
        else {
            continue;
        };
        if !video_id(&id) || title.is_empty() || !ids.insert((id.clone(), title.clone())) {
            continue;
        }
        let score = terms
            .iter()
            .filter(|term| folded(&title).contains(**term))
            .count();
        if score > best_score || (best.is_none() && terms.is_empty()) {
            best_score = score;
            best = Some(YoutubeVideo {
                id,
                title: title
                    .chars()
                    .filter(|c| !c.is_control())
                    .take(250)
                    .collect(),
            });
        }
        if ids.len() >= 24 {
            break;
        }
    }
    best.ok_or_else(|| {
        "No encontré un resultado de vídeo que coincida con la canción indicada".into()
    })
}

pub(crate) async fn execute(
    app: &AppHandle,
    request: MediaRequest,
    check: CancellationCheck,
) -> Result<String, String> {
    check()?;
    let state = app.state::<MediaPlaybackStore>().inner().clone();
    let service = request
        .service
        .or_else(|| state.0.lock().ok().and_then(|c| c.service))
        .ok_or("Indica Spotify o YouTube para saber dónde reproducir")?;
    let operation = new_operation_id();
    let audit = |stage, outcome, reason| {
        record_producer_audit(
            app,
            operation.clone(),
            AuditSource::Capability,
            "desktop.approved.media".into(),
            "desktop.media".into(),
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
        "OWNER_MEDIA_REQUEST",
    )?;

    let spotify_target =
        if service == MediaService::Spotify && request.operation == MediaOperation::Play {
            Some(crate::spotify_playlists::resolve_at(
                &crate::util::alice_data_root_path(app)?,
                request.query.as_deref(),
            ))
        } else {
            None
        };
    let previous_video = state.0.lock().ok().and_then(|c| c.youtube_id.clone());
    let query = request.query.clone();
    let operation_kind = request.operation;
    let check = check.clone();
    let execution = tauri::async_runtime::spawn_blocking(move || {
        check()?;
        match service {
            MediaService::Spotify => {
                #[cfg(target_os = "linux")]
                {
                    if matches!(spotify_target.transpose()?, Some(crate::spotify_playlists::SpotifyTarget::Playlist { .. })) {
                        return Err("La playlist de Spotify con nombre está preparada para Windows. En Ubuntu sigue disponible Tus me gusta, pausa y reanudación.".into());
                    }
                    crate::media_linux::spotify(operation_kind, None, check).map(|text| (text, None))
                }
                #[cfg(not(target_os = "linux"))]
                {
                    let target = spotify_target
                        .transpose()?
                        .unwrap_or(crate::spotify_playlists::SpotifyTarget::LikedSongs);
                    crate::media_windows::spotify(operation_kind, target, check)
                        .map(|text| (text, None))
                }
            }
            MediaService::Youtube => {
                #[cfg(target_os = "linux")]
                {
                    crate::media_linux::youtube(operation_kind, query, previous_video, check)
                }
                #[cfg(not(target_os = "linux"))]
                {
                    crate::media_windows::youtube(operation_kind, query, previous_video, check)
                }
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Ok((_, video_id)) = &execution {
        state.remember(service, video_id.clone());
        if service == MediaService::Youtube && operation_kind == MediaOperation::Open {
            if let Ok(mut context) = state.0.lock() {
                context.youtube_id = None;
            }
        }
    }
    let execution = execution.map(|(text, _)| text);
    let success = execution.is_ok();
    let _ = audit(
        if success {
            AuditStage::Execution
        } else {
            AuditStage::Error
        },
        if success {
            AuditOutcome::Success
        } else {
            AuditOutcome::Error
        },
        if success {
            "OWNER_MEDIA_RESULT"
        } else {
            "OWNER_MEDIA_FAILED"
        },
    );
    execution
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn favorites_playlist_is_not_normalized_to_liked_songs() {
        for (text, expected) in [
            (
                "Alice, abre Spotify y reproduce mi playlist Mis favoritos",
                "playlist Mis favoritos",
            ),
            (
                "abre Spotify y reproduce la playlist Mis favoritos",
                "playlist Mis favoritos",
            ),
            ("reproduce Mis favoritos", "Mis favoritos"),
            ("reproduce Mis favoritos.", "Mis favoritos."),
            (
                "abre Spotify y reproduce la playlist «Mis favoritos».",
                "playlist «Mis favoritos».",
            ),
        ] {
            let parsed = parse_request(text).unwrap();
            assert_eq!(parsed.service, Some(MediaService::Spotify));
            assert_eq!(parsed.operation, MediaOperation::Play);
            assert_eq!(parsed.query.as_deref(), Some(expected));
        }
        assert_eq!(
            parse_request("reproduce Tus me gusta en Spotify")
                .unwrap()
                .query,
            None
        );
        let generic = parse_request("reproduce mi playlist").unwrap();
        assert_eq!(generic.service, Some(MediaService::Spotify));
        assert_eq!(generic.query, None);
        assert!(parse_request("El video dice reproduce Mis favoritos").is_none());
    }
    #[test]
    fn named_playlists_and_browser_open_requests_keep_their_scope() {
        let playlist =
            parse_request("Alice, reproduce la playlist Musica para estudiar en YouTube").unwrap();
        assert_eq!(playlist.service, Some(MediaService::Youtube));
        assert_eq!(
            playlist.query.as_deref(),
            Some("playlist Musica para estudiar")
        );
        let liked = parse_request("Alice, reproduce el playlist Tus me gusta en Spotify").unwrap();
        assert_eq!(liked.query, None);
        let browser =
            parse_request("Alice, abre el navegador y reproduce Numb de Linkin Park en YouTube")
                .unwrap();
        assert_eq!(browser.operation, MediaOperation::Play);
        assert_eq!(browser.query.as_deref(), Some("Numb de Linkin Park"));
        assert!(parse_request("abre el navegador y reproduce algo en otro sitio").is_none());
    }

    #[cfg(target_os = "linux")]
    #[test]
    #[ignore = "Real Spotify account and Alice's Chrome profile; isolated ALICE_DATA_DIR required"]
    fn live_linux_owned_music_acceptance() {
        let completed = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let outcome = completed.clone();
        let data = std::env::var("ALICE_DATA_DIR").expect("isolated ALICE_DATA_DIR required");
        assert!(std::path::Path::new(&data).starts_with(std::env::temp_dir()));
        assert!(std::env::var("ALICE_YOUTUBE_PLAYLIST_URL").is_ok());
        let mut context = tauri::generate_context!();
        for window in &mut context.config_mut().app.windows {
            window.visible = false;
        }
        let exit_code = tauri::Builder::default()
            .any_thread()
            .manage(MediaPlaybackStore::default())
            .setup(move |app| {
                let handle = app.handle().clone();
                let outcome = outcome.clone();
                tauri::async_runtime::spawn(async move {
                    let check: CancellationCheck = Arc::new(|| Ok(()));
                    for text in [
                        "Alice, abre Spotify y reproduce Tus me gusta",
                        "Alice, reproduce Tus me gusta en Spotify",
                        "Alice, pausa Spotify",
                        "Alice, reproduce mi playlist en YouTube",
                        "Alice, pausa YouTube",
                        "Alice, continua YouTube",
                    ] {
                        let result =
                            execute(&handle, parse_request(text).unwrap(), check.clone()).await;
                        println!("LINUX_MEDIA_ACCEPTANCE: {result:?}");
                        if result.is_err() {
                            handle.exit(1);
                            return;
                        }
                    }
                    outcome.store(true, std::sync::atomic::Ordering::Release);
                    handle.exit(0);
                });
                Ok(())
            })
            .build(context)
            .unwrap()
            .run_return(|_, _| {});
        assert_eq!(exit_code, 0);
        assert!(completed.load(std::sync::atomic::Ordering::Acquire));
    }
    #[test]
    fn actual_failed_voice_phrases_now_select_the_spotify_collection() {
        for text in [
            "Alista abre abre el Spotify y reproducir la música.",
            "ah, abres Spotify y reproduces mi playlist.",
            "Abres Spotify y reproduce mi mi música.",
            "Alice, abre la aplicación Spotify y reproduce mi música, por favor.",
            "Quiero que abras Spotify y reproduzcas mi lista de reproducción",
            "Reproduce mi música en Spotify.",
        ] {
            let request = parse_request(text).unwrap_or_else(|| panic!("{text}"));
            assert_eq!(request.service, Some(MediaService::Spotify), "{text}");
            assert_eq!(request.operation, MediaOperation::Play, "{text}");
            assert_eq!(request.query, None, "{text}");
        }
    }
    #[test]
    fn natural_music_requests_still_require_current_intent_and_exact_titles() {
        let request =
            parse_request("Ah, Alice, abres YouTube y reproduces Help! de The Beatles").unwrap();
        assert_eq!(request.service, Some(MediaService::Youtube));
        assert_eq!(request.query.as_deref(), Some("Help! de The Beatles"));
        for text in [
            "Ah, no abres Spotify ni reproduces mi música",
            "Alista, si abres Spotify reproduce mi música",
            "Mi amigo dijo abres Spotify y reproduces mi música",
            "Alice, «abres Spotify y reproduces mi música»",
            "¿Qué pasa cuando abres Spotify?",
            "Detén la conversación Alice",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
            assert!(clarification(text).is_none(), "{text}");
        }
        assert!(clarification("Spotify").is_some());
        assert!(clarification("abre Spotify y elimina archivos").is_some());
        assert!(clarification("abre Spotify").is_none());
        assert!(clarification("Alice, me abres Spotify en mi equipo").is_none());
    }
    #[test]
    fn an_addressed_service_without_an_action_gets_a_balanced_local_clarification() {
        let notice = clarification("Spotify").unwrap();
        for text in [
            "Alice, Spotify.",
            "Alice Spotify",
            "ALICE, SPOTIFY.",
            "Alice, YouTube.",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
            assert_eq!(clarification(text), Some(notice), "{text}");
        }
        for operation in ["abrir", "pausar", "reanudar", "reproducir"] {
            assert!(
                notice.contains(operation),
                "The clarification must include {operation}"
            );
        }
        assert!(notice.contains("No envié ninguna orden"));
        assert!(notice.contains("Repite la petición completa"));
    }
    #[test]
    fn an_unknown_short_imperative_gets_clarification_without_guessing_an_action() {
        let notice = clarification("Alice, Spotify.").unwrap();
        for text in [
            "Alice. Reclosa Spotify.",
            "Alice, replosa Spotify.",
            "ALICE, RECARGA SPOTIFY.",
            "Alice, reinicia YouTube.",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
            assert!(
                crate::desktop_actions::direct_target(text).is_none(),
                "{text}"
            );
            assert!(
                crate::desktop_actions::tool_candidate(text).is_none(),
                "{text}"
            );
            assert_eq!(clarification(text), Some(notice), "{text}");
        }
    }

    #[test]
    fn short_media_ambiguity_does_not_replace_queries_statements_or_quoted_requests() {
        for text in [
            "Alice, ¿qué es Spotify?",
            "Alice, ¿qué reproduces en Spotify?",
            "Alice, cuál es la historia de Spotify",
            "Alice, historia Spotify.",
            "Alice, uso Spotify.",
            "Alice, funcionamiento Spotify.",
            "Alice, funciona Spotify.",
            "Alice, explica Spotify.",
            "Alice, define Spotify.",
            "Alice, describe Spotify.",
            "Alice, resume Spotify.",
            "Alice, recomienda Spotify.",
            "Alice, recomiendas Spotify.",
            "Alice, recomendacion Spotify.",
            "Alice, privacidad Spotify.",
            "Alice, musica Spotify.",
            "Alice, reproduccion Spotify.",
            "Alice, recuerdo Spotify.",
            "Alice, conozco Spotify.",
            "Alice, Spotify no funciona.",
            "Alice, no reclosa Spotify.",
            "Alice, nunca Spotify.",
            "Alice, sin Spotify.",
            "Alice, si reclosa Spotify.",
            "Alice, cuando reclosa Spotify.",
            "Marta, reclosa Spotify.",
            "Alice, Marta dice Spotify.",
            "Alice, «reclosa Spotify».",
            "«Alice, reclosa Spotify.»",
            "Alice, ¿reclosa Spotify?",
            "Alice, reclosa Spotify y YouTube.",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
            assert!(clarification(text).is_none(), "{text}");
        }
        for text in [
            "Alice, abre Spotify.",
            "Alice, reproduce Spotify.",
            "Alice reproduce Spotify",
            "Alice, pausa Spotify.",
            "Alice, reanuda Spotify.",
        ] {
            assert!(
                parse_request(text).is_some()
                    || crate::desktop_actions::direct_target(text).is_some(),
                "{text}"
            );
        }
    }
    #[test]
    fn informative_third_party_and_quoted_service_mentions_stay_out_of_media_routing() {
        for text in [
            "Alice, ¿qué es Spotify?",
            "Alice, ¿Spotify permite listas?",
            "Alice, dime qué es YouTube",
            "Marta dice Spotify",
            "Marta, Spotify.",
            "Alice, Marta dice Spotify",
            "Alice, Spotify no funciona",
            "Alice, no Spotify.",
            "Alice, «Spotify»",
            "«Alice, Spotify.»",
            "Alista, Spotify.",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
            assert!(clarification(text).is_none(), "{text}");
        }
    }
    #[test]
    fn media_audit_is_narrow_and_generic_context_is_not_invented() {
        assert!(crate::audit::AuditEvent::producer(
            new_operation_id(),
            AuditSource::Capability,
            "desktop.approved.media".into(),
            "desktop.media".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            None,
            None,
            "OWNER_MEDIA_RESULT"
        )
        .is_ok());
        assert!(crate::audit::AuditEvent::producer(
            new_operation_id(),
            AuditSource::Capability,
            "desktop.approved.media".into(),
            "desktop.open".into(),
            AuditStage::Execution,
            AuditOutcome::Success,
            None,
            None,
            "OWNER_MEDIA_RESULT"
        )
        .is_err());
        let state = MediaPlaybackStore::default();
        assert!(state.0.lock().unwrap().service.is_none());
        state.opened_spotify();
        assert_eq!(state.0.lock().unwrap().service, Some(MediaService::Spotify));
        assert!(parse_request("Alice, «reproduce Spotify»").is_none());
        assert!(parse_request("reproduce tu respuesta").is_none());
    }
    #[test]
    #[ignore = "Gemma real: selección de controles multimedia sin abrir Spotify/Chrome ni reproducir música"]
    fn live_gemma_selects_media_without_executing_it() {
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
            crate::local_inference::runtime().start().unwrap();
        }
        let _cleanup = Cleanup(owned);
        for message in [
            "¿Puedes reproducir mis me gusta en Spotify?",
            "¿Puedes abrir Spotify y reproducir mi playlist?",
            "¿Puedes reproducir canción ficticia de prueba en YouTube?",
        ] {
            let request = parse_request(message).unwrap();
            let result = tauri::async_runtime::block_on(async {
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
                "MEDIA_TOOL_PROBE calls={}",
                result["choices"][0]["message"]["tool_calls"]
            );
            validate_tool_call(&result, &request).unwrap();
        }
    }
    #[test]
    fn direct_music_requests_preserve_titles_and_ignore_quoted_or_historical_commands() {
        let request =
            parse_request("Alice, reproduce Nothing Else Matters de Metallica en YouTube").unwrap();
        assert_eq!(request.service, Some(MediaService::Youtube));
        assert_eq!(
            request.query.as_deref(),
            Some("Nothing Else Matters de Metallica")
        );
        assert_eq!(
            parse_request("reproduce mis me gusta").unwrap().service,
            Some(MediaService::Spotify)
        );
        assert_eq!(
            parse_request("pausa Spotify").unwrap().operation,
            MediaOperation::Pause
        );
        assert_eq!(
            parse_request("abre YouTube en Google Chrome")
                .unwrap()
                .operation,
            MediaOperation::Open
        );
        assert_eq!(
            parse_request("Reproduce en YouTube No Me Ames de Marc Anthony")
                .unwrap()
                .query
                .as_deref(),
            Some("No Me Ames de Marc Anthony")
        );
        assert_eq!(
            parse_request("abre YouTube y reproduce la canción Imagine")
                .unwrap()
                .query
                .as_deref(),
            Some("Imagine")
        );
        for text in [
            "No reproduzcas Spotify",
            "Mi amigo dijo reproduce Spotify",
            "Si digo reproduce YouTube",
            "\"reproduce Spotify\"",
            "Detén la conversación Alice",
            "abre Chrome y elimina datos",
        ] {
            assert!(parse_request(text).is_none(), "{text}");
        }
    }
    #[test]
    fn search_never_treats_song_text_as_a_url_or_command() {
        assert_eq!(
            parse_request("Reproduce \"Help!\" en YouTube")
                .unwrap()
                .query
                .as_deref(),
            Some("Help!")
        );
        assert_eq!(
            parse_request("Reproduce Don't Turn On The Light (Kinger's Song) en YouTube")
                .unwrap()
                .query
                .as_deref(),
            Some("Don't Turn On The Light (Kinger's Song)")
        );
        let url = youtube_search_url("AC/DC & Queen; ¿Qué? #1").unwrap();
        assert_eq!(url.host_str(), Some("www.youtube.com"));
        assert_eq!(
            url.query_pairs()
                .find(|(k, _)| k == "search_query")
                .unwrap()
                .1,
            "AC/DC & Queen; ¿Qué? #1"
        );
        assert!(youtube_watch_url("../escape").is_err());
        assert!(youtube_watch_url("abc123_-XYZ").is_ok());
    }
    #[test]
    fn search_links_must_match_the_song_and_youtube_host() {
        let chosen = select_youtube_link(
            vec![
                (
                    "https://evil.test/watch?v=abc123_-XYZ".into(),
                    "Imagine John Lennon".into(),
                ),
                (
                    "https://www.youtube.com/watch?v=abc123_-XYZ".into(),
                    "Imagine John Lennon".into(),
                ),
            ],
            "Imagine de John Lennon",
        )
        .unwrap();
        assert_eq!(chosen.id, "abc123_-XYZ");
        assert_eq!(chosen.title, "Imagine John Lennon");
        assert!(select_youtube_link(vec![], "Imagine").is_err());
    }
    #[test]
    fn tool_cannot_change_service_song_or_add_commands() {
        let request = parse_request("reproduce Imagine en YouTube").unwrap();
        let response = |args| serde_json::json!({"choices":[{"message":{"tool_calls":[{"type":"function","function":{"name":"control_media","arguments":args}}]}}]});
        assert!(validate_tool_call(&response(tool_arguments(&request)), &request).is_ok());
        assert!(validate_tool_call(
            &response(
                serde_json::json!({"service":"spotify","operation":"play","query":"Imagine"})
            ),
            &request
        )
        .is_err());
        assert!(validate_tool_call(&response(serde_json::json!({"service":"youtube","operation":"play","query":"Imagine","command":"anything"})),&request).is_err());
    }
}
