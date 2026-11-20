mod platform;
mod sampler;

use sampler::SystemOverview;

#[tauri::command]
pub(crate) async fn system_overview(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<SystemOverview, String> {
    if window.label() != "main" {
        return Err("El estado del equipo se consulta desde la ventana principal.".into());
    }
    let path = crate::util::alice_data_root_path(&app).ok();
    tauri::async_runtime::spawn_blocking(move || sampler::read(path.as_deref()))
        .await
        .map_err(|_| "No se pudo consultar el equipo.".to_string())?
}
