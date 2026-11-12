//! Owner-selected playlist configuration stays in the private data directory.
use serde::Deserialize;
use std::{fs, path::Path};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum SpotifyTarget {
    LikedSongs,
    Playlist { id: String, name: String },
}
fn normalized(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
fn spoken_name(query: &str) -> String {
    let query = normalized(query);
    query
        .strip_prefix("playlist ")
        .unwrap_or(&query)
        .trim_end_matches(['.', ',', '!', '?', '…'])
        .trim()
        .trim_matches(['"', '\'', '«', '»', '“', '”'])
        .trim()
        .to_string()
}
pub(crate) fn refers_to_favorites(query: &str) -> bool {
    spoken_name(query) == "mis favoritos"
}
fn playlist_id(value: &str, host: &str) -> Option<String> {
    let url = reqwest::Url::parse(value).ok()?;
    if url.scheme() != "https"
        || url.host_str() != Some(host)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.fragment().is_some()
    {
        return None;
    }
    let id = url.path().strip_prefix("/playlist/")?;
    (id.len() == 22 && id.bytes().all(|c| c.is_ascii_alphanumeric())).then(|| id.into())
}
impl SpotifyTarget {
    #[cfg(any(windows, test))]
    pub(crate) fn uri(&self) -> String {
        match self {
            Self::LikedSongs => "spotify:collection:tracks".into(),
            Self::Playlist { id, .. } => format!("spotify:playlist:{id}"),
        }
    }
    #[cfg(any(windows, test))]
    pub(crate) fn label(&self) -> &str {
        match self {
            Self::LikedSongs => "Tus me gusta",
            Self::Playlist { name, .. } => name,
        }
    }
    #[cfg(any(windows, test))]
    pub(crate) fn title_matches(&self, value: &str) -> bool {
        let value = normalized(value);
        match self {
            Self::LikedSongs => matches!(
                value.as_str(),
                "tus me gusta" | "liked songs" | "canciones que te gustan"
            ),
            Self::Playlist { name, .. } => value == normalized(name),
        }
    }
    #[cfg(any(windows, test))]
    pub(crate) fn header_control(&self, value: &str, playing: bool) -> bool {
        let value = normalized(value);
        let prefixes: &[&str] = if playing {
            &["pausar ", "pausa ", "pause "]
        } else {
            &["reproducir ", "play "]
        };
        prefixes.iter().any(|prefix| {
            value
                .strip_prefix(prefix)
                .is_some_and(|title| self.title_matches(title))
        })
    }
    #[cfg(any(windows, test))]
    pub(crate) fn context_matches(&self, value: &str) -> bool {
        match self {
            Self::Playlist { id, .. } => {
                playlist_id(value, "xpui.app.spotify.com").as_deref() == Some(id.as_str())
            }
            Self::LikedSongs => reqwest::Url::parse(value).ok().is_some_and(|url| {
                url.scheme() == "https"
                    && url.host_str() == Some("xpui.app.spotify.com")
                    && url.path() == "/collection/tracks"
                    && url.username().is_empty()
                    && url.password().is_none()
            }),
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Configuration {
    schema_version: u8,
    spotify: Playlist,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Playlist {
    name: String,
    url: String,
}

pub(crate) fn resolve_at(root: &Path, query: Option<&str>) -> Result<SpotifyTarget, String> {
    let Some(query) = query else {
        return Ok(SpotifyTarget::LikedSongs);
    };
    let invalid = "No hay una playlist de Spotify configurada con ese nombre. Revisa media-playlists.json en la carpeta privada de datos.";
    let path = root.join("media-playlists.json");
    let metadata = fs::symlink_metadata(&path).map_err(|_| invalid)?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 4096 {
        return Err(invalid.into());
    }
    let bytes = fs::read(path).map_err(|_| invalid)?;
    if bytes.len() > 4096 {
        return Err(invalid.into());
    }
    let config: Configuration = serde_json::from_slice(&bytes).map_err(|_| invalid)?;
    let name = config.spotify.name.trim();
    if config.schema_version != 1
        || name.is_empty()
        || name.chars().count() > 120
        || name.chars().any(char::is_control)
    {
        return Err(invalid.into());
    }
    let id = playlist_id(&config.spotify.url, "open.spotify.com").ok_or(invalid)?;
    let raw = query.trim();
    let query = normalized(raw);
    let query = query.strip_prefix("playlist ").unwrap_or(&query);
    if query != normalized(name)
        && spoken_name(raw) != normalized(name)
        && playlist_id(raw, "open.spotify.com").as_deref() != Some(id.as_str())
    {
        return Err(invalid.into());
    }
    Ok(SpotifyTarget::Playlist {
        id,
        name: name.into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    const ID: &str = "0123456789ABCDEFGHIJKL";
    fn target() -> SpotifyTarget {
        SpotifyTarget::Playlist {
            id: ID.into(),
            name: "Lista de prueba".into(),
        }
    }
    #[test]
    fn urls_and_receipts_require_the_exact_playlist_and_service() {
        let target = target();
        assert_eq!(target.uri(), format!("spotify:playlist:{ID}"));
        assert_eq!(target.label(), "Lista de prueba");
        assert!(target.context_matches(&format!(
            "https://xpui.app.spotify.com/playlist/{ID}?uri=spotify%3Atrack%3Ax"
        )));
        for value in [
            format!("https://xpui.app.spotify.com.evil.test/playlist/{ID}"),
            format!("https://user@xpui.app.spotify.com/playlist/{ID}"),
            format!("https://xpui.app.spotify.com/playlist/{ID}/extra"),
            format!("https://xpui.app.spotify.com/playlist/{ID}#other"),
            "https://xpui.app.spotify.com/playlist/ZZZZZZZZZZZZZZZZZZZZZZ".into(),
            "https://xpui.app.spotify.com/index.html".into(),
        ] {
            assert!(!target.context_matches(&value), "{value}");
        }
        assert!(target.header_control("Pausar Lista de prueba", true));
        assert!(!target.header_control("Pausar otra lista", true));
        assert!(!target.header_control("Pausar", true));
        assert!(!target.header_control("Reproducir Lista de prueba", true));
    }
    #[test]
    fn private_configuration_cannot_redirect_unknown_names() {
        let root =
            std::env::temp_dir().join(format!("alice-spotify-config-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("media-playlists.json");
        fs::write(&path, serde_json::json!({"schemaVersion":1,"spotify":{"name":"Lista de prueba","url":format!("https://open.spotify.com/playlist/{ID}?si=tracking")}}).to_string()).unwrap();
        assert_eq!(
            resolve_at(&root, Some("playlist Lista de prueba")).unwrap(),
            target()
        );
        assert_eq!(
            resolve_at(&root, Some("playlist «Lista de prueba».")).unwrap(),
            target()
        );
        assert!(resolve_at(&root, Some("playlist Lista de prueba y otra cosa.")).is_err());
        assert_eq!(
            resolve_at(
                &root,
                Some(&format!("https://open.spotify.com/playlist/{ID}"))
            )
            .unwrap(),
            target()
        );
        assert!(resolve_at(&root, Some("Otra lista")).is_err());
        assert!(resolve_at(
            &root,
            Some("https://open.spotify.com/playlist/ZZZZZZZZZZZZZZZZZZZZZZ")
        )
        .is_err());
        assert_eq!(resolve_at(&root, None).unwrap(), SpotifyTarget::LikedSongs);
        fs::write(&path, "{}").unwrap();
        assert!(resolve_at(&root, Some("Lista de prueba")).is_err());
        fs::remove_file(path).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
