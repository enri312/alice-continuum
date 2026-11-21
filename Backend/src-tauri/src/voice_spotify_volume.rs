use std::{
    ffi::OsStr,
    sync::mpsc::{self, Sender},
    thread::{self, JoinHandle},
};
use sysinfo::{ProcessesToUpdate, System};
use windows::{
    core::Interface,
    Win32::{
        Media::Audio::{
            eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDeviceEnumerator,
            ISimpleAudioVolume, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
        },
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
        },
    },
};

use crate::voice_session::VOICE_SESSION_LIMIT;

struct Apartment;

impl Apartment {
    fn enter() -> windows::core::Result<Self> {
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()? };
        Ok(Self)
    }
}

impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}

struct LoweredVolume {
    volume: ISimpleAudioVolume,
    previous: f32,
    lowered: f32,
}

impl Drop for LoweredVolume {
    fn drop(&mut self) {
        unsafe {
            if self
                .volume
                .GetMasterVolume()
                .is_ok_and(|current| (current - self.lowered).abs() < 0.001)
            {
                let _ = self.volume.SetMasterVolume(self.previous, std::ptr::null());
            }
        }
    }
}

fn lower_spotify() -> windows::core::Result<Vec<LoweredVolume>> {
    let mut system = System::new();
    system.refresh_processes(ProcessesToUpdate::All, true);
    let spotify_pids: Vec<u32> = system
        .processes()
        .values()
        .filter(|process| {
            process
                .name()
                .eq_ignore_ascii_case(OsStr::new("Spotify.exe"))
        })
        .map(|process| process.pid().as_u32())
        .collect();
    if spotify_pids.is_empty() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    unsafe {
        let devices: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let outputs = devices.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        for index in 0..outputs.GetCount()? {
            let Ok(device) = outputs.Item(index) else {
                continue;
            };
            let Ok(manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                continue;
            };
            let Ok(sessions) = manager.GetSessionEnumerator() else {
                continue;
            };
            for index in 0..sessions.GetCount().unwrap_or_default() {
                let Ok(session) = sessions.GetSession(index) else {
                    continue;
                };
                let Ok(identity) = session.cast::<IAudioSessionControl2>() else {
                    continue;
                };
                if !identity
                    .GetProcessId()
                    .is_ok_and(|pid| spotify_pids.contains(&pid))
                {
                    continue;
                }
                let Ok(volume) = session.cast::<ISimpleAudioVolume>() else {
                    continue;
                };
                let Ok(previous) = volume.GetMasterVolume() else {
                    continue;
                };
                let lowered = previous * 0.1;
                if previous > 0.0 && volume.SetMasterVolume(lowered, std::ptr::null()).is_ok() {
                    result.push(LoweredVolume {
                        volume,
                        previous,
                        lowered,
                    });
                }
            }
        }
    }
    Ok(result)
}

pub(crate) struct SpotifyVolumeGuard {
    stop: Sender<()>,
    worker: Option<JoinHandle<()>>,
}

impl SpotifyVolumeGuard {
    pub(crate) fn begin() -> Result<Self, String> {
        let (stop, stopped) = mpsc::channel();
        let (ready, started) = mpsc::sync_channel(1);
        let worker = thread::Builder::new()
            .name("alice-spotify-volume".into())
            .spawn(move || {
                let Ok(_apartment) = Apartment::enter() else {
                    let _ = ready.send(false);
                    return;
                };
                let Ok(volumes) = lower_spotify() else {
                    let _ = ready.send(false);
                    return;
                };
                if ready.send(true).is_ok() && !volumes.is_empty() {
                    let _ = stopped.recv_timeout(VOICE_SESSION_LIMIT);
                }
            })
            .map_err(|error| error.to_string())?;
        let guard = Self {
            stop,
            worker: Some(worker),
        };
        if started.recv().unwrap_or(false) {
            Ok(guard)
        } else {
            Err("Windows no pudo ajustar el volumen de Spotify.".into())
        }
    }
}

impl Drop for SpotifyVolumeGuard {
    fn drop(&mut self) {
        let _ = self.stop.send(());
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}
