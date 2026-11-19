use serde::Deserialize;

#[derive(Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionView {
    pub available: bool,
    pub camera: bool,
    pub desktop: bool,
    pub busy: bool,
    pub error: String,
    pub expanded: bool,
    pub preview: String,
    pub last_frame: String,
    pub devices: Vec<CameraDevice>,
    pub device_id: String,
}

#[derive(Clone, PartialEq, Deserialize)]
pub struct CameraDevice {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentView {
    pub has_file: bool,
    pub busy: bool,
    pub error: String,
    pub preview: Option<DocumentPreview>,
}

#[derive(Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPreview {
    pub status: String,
    pub source_sha256: String,
    pub total_pages: u32,
    pub chunks: Vec<TextChunk>,
}

#[derive(Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextChunk {
    pub page: u32,
    pub start_char: u32,
    pub end_char: u32,
    pub text: String,
}
