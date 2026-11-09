//! Tauri's development watcher terminates the old process before rebuilding.
//! Handle normal Unix termination outside the signal handler so owned Gemma is
//! stopped and reaped before exiting. SIGKILL/power loss remain uncatchable.
use signal_hook::{
    consts::{SIGHUP, SIGINT, SIGTERM},
    iterator::Signals,
};

pub(crate) fn install(app: tauri::AppHandle) -> std::io::Result<()> {
    install_with(move || {
        if let Err(error) = crate::local_inference::runtime().stop() {
            eprintln!("No se pudo cerrar el motor propio al salir: {error}");
        }
        app.exit(0);
    })
}

pub(crate) fn install_with(shutdown: impl FnOnce() + Send + 'static) -> std::io::Result<()> {
    let mut signals = Signals::new([SIGINT, SIGTERM, SIGHUP])?;
    std::thread::Builder::new()
        .name("alice-shutdown".into())
        .spawn(move || {
            if signals.forever().next().is_some() {
                shutdown();
            }
        })?;
    Ok(())
}
