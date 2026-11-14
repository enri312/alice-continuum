pub mod model;
#[cfg(target_arch = "wasm32")]
mod ui;

#[cfg(target_arch = "wasm32")]
mod browser {
    use super::{
        model::Payload,
        ui::{page, PageProps},
    };
    use dioxus::prelude::*;
    use futures_channel::mpsc::{unbounded, UnboundedSender};
    use futures_util::future::{AbortHandle, Abortable};
    use std::{cell::RefCell, collections::HashMap, rc::Rc};
    use wasm_bindgen::prelude::*;
    struct Instance {
        root: String,
        tx: UnboundedSender<Payload>,
        abort: AbortHandle,
    }
    thread_local! {
        static NEXT_ID: RefCell<u32> = const { RefCell::new(1) };
        static INSTANCES: RefCell<HashMap<u32, Instance>> = RefCell::new(HashMap::new());
    }
    #[wasm_bindgen]
    pub fn mount_state_controls(
        root: &str,
        raw: &str,
        on_action: js_sys::Function,
        on_ready: js_sys::Function,
    ) -> Result<u32, JsValue> {
        let initial = Payload::parse(raw).map_err(|error| JsValue::from_str(&error))?;
        if web_sys::window()
            .and_then(|window| window.document())
            .and_then(|document| document.get_element_by_id(root))
            .is_none()
        {
            return Err(JsValue::from_str(
                "No existe el contenedor de Estado y controles",
            ));
        }
        let (tx, rx) = unbounded();
        let id = NEXT_ID.with(|next| {
            let id = *next.borrow();
            *next.borrow_mut() = id.wrapping_add(1).max(1);
            id
        });
        let vdom = VirtualDom::new_with_props(
            page,
            PageProps {
                initial,
                rx: Rc::new(RefCell::new(Some(rx))),
                on_action,
                on_ready,
            },
        );
        let (abort, registration) = AbortHandle::new_pair();
        let config = dioxus_web::Config::new().rootname(root);
        wasm_bindgen_futures::spawn_local(async move {
            let _ = Abortable::new(dioxus_web::run(vdom, config), registration).await;
        });
        INSTANCES.with(|instances| {
            instances.borrow_mut().insert(
                id,
                Instance {
                    root: root.into(),
                    tx,
                    abort,
                },
            );
        });
        Ok(id)
    }
    #[wasm_bindgen]
    pub fn update_state_controls(id: u32, raw: &str) -> Result<(), JsValue> {
        let next = Payload::parse(raw).map_err(|error| JsValue::from_str(&error))?;
        INSTANCES.with(|instances| {
            let instances = instances.borrow();
            let instance = instances
                .get(&id)
                .ok_or_else(|| JsValue::from_str("Vista desmontada"))?;
            instance
                .tx
                .unbounded_send(next)
                .map_err(|_| JsValue::from_str("Vista no disponible"))
        })
    }
    #[wasm_bindgen]
    pub fn unmount_state_controls(id: u32) {
        INSTANCES.with(|instances| {
            if let Some(instance) = instances.borrow_mut().remove(&id) {
                instance.tx.close_channel();
                instance.abort.abort();
                if let Some(root) = web_sys::window()
                    .and_then(|window| window.document())
                    .and_then(|document| document.get_element_by_id(&instance.root))
                {
                    root.set_text_content(None);
                }
            }
        });
    }
}
