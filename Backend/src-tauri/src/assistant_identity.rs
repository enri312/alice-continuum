pub(crate) const WAKE_NAMES: &[&str] = &["nyxia", "nixia", "niksia", "alice"];
const SPOKEN_VARIANTS: &[&str] = &["nik sia", "nik-sia"];

pub(crate) fn strip_wake_prefix(text: &str) -> Option<&str> {
    WAKE_NAMES.iter().chain(SPOKEN_VARIANTS).find_map(|&name| {
        text.strip_prefix(name)
            .and_then(|rest| rest.strip_prefix(' '))
    })
}

pub(crate) fn strip_wake_suffix(text: &str) -> Option<&str> {
    WAKE_NAMES.iter().chain(SPOKEN_VARIANTS).find_map(|&name| {
        text.strip_suffix(name)
            .and_then(|rest| rest.strip_suffix(' '))
    })
}
