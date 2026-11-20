use super::sampler::{Capacity, Power};
use std::path::Path;

#[cfg(windows)]
pub(super) fn disk_capacity(path: &Path) -> Option<Capacity> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{core::PCWSTR, Win32::Storage::FileSystem::GetDiskFreeSpaceExW};
    let folder = path.ancestors().find(|path| path.is_dir())?;
    let wide: Vec<u16> = folder.as_os_str().encode_wide().chain([0]).collect();
    let (mut available, mut total) = (0, 0);
    // The path and both output buffers live until the synchronous call returns.
    unsafe {
        GetDiskFreeSpaceExW(
            PCWSTR(wide.as_ptr()),
            Some(&mut available),
            Some(&mut total),
            None,
        )
    }
    .ok()?;
    Capacity::from_available(total, available)
}

#[cfg(not(windows))]
pub(super) fn disk_capacity(path: &Path) -> Option<Capacity> {
    let folder = path.ancestors().find_map(|path| path.canonicalize().ok())?;
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk = disks
        .iter()
        .filter(|disk| folder.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().components().count())?;
    Capacity::from_available(disk.total_space(), disk.available_space())
}

#[cfg(windows)]
pub(super) fn power() -> Option<Power> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut status = SYSTEM_POWER_STATUS::default();
    // Writes to the live stack buffer and returns synchronously.
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;
    Some(Power {
        plugged_in: match status.ACLineStatus {
            0 => Some(false),
            1 => Some(true),
            _ => None,
        },
        battery_percent: (status.BatteryLifePercent <= 100 && status.BatteryFlag & 128 == 0)
            .then_some(status.BatteryLifePercent),
    })
}

#[cfg(not(windows))]
pub(super) fn power() -> Option<Power> {
    None
}
