pub mod model;

#[cfg(target_arch = "wasm32")]
mod ui;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    dioxus::launch(ui::app);
}
