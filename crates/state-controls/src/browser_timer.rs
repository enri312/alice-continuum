use futures_channel::oneshot;
use wasm_bindgen::{closure::Closure, JsCast, JsValue};

struct Timeout {
    window: web_sys::Window,
    id: i32,
    _callback: Closure<dyn FnMut()>,
}
impl Drop for Timeout {
    fn drop(&mut self) {
        self.window.clear_timeout_with_handle(self.id);
    }
}

// The callback and browser timer are released when the owning Dioxus task is dropped.
pub async fn delay(milliseconds: i32) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| JsValue::from_str("Ventana no disponible"))?;
    let (tx, rx) = oneshot::channel();
    let mut tx = Some(tx);
    let callback = Closure::<dyn FnMut()>::new(move || {
        if let Some(tx) = tx.take() {
            let _ = tx.send(());
        }
    });
    let id = window.set_timeout_with_callback_and_timeout_and_arguments_0(
        callback.as_ref().unchecked_ref(),
        milliseconds,
    )?;
    let _timeout = Timeout {
        window,
        id,
        _callback: callback,
    };
    rx.await
        .map_err(|_| JsValue::from_str("Temporizador cancelado"))
}
