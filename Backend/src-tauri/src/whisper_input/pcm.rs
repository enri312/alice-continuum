//! The local decoder emits mono PCM16 at 16 kHz, with a streaming RIFF header.
use std::ops::Range;

const SAMPLE_RATE: usize = 16_000;
const FRAME_BYTES: usize = SAMPLE_RATE * 2 / 50;
const EDGE_MARGIN_BYTES: usize = SAMPLE_RATE * 2 * 3 / 10;
const MIN_TRIM_BYTES: usize = SAMPLE_RATE;
const STRONG_FRAMES_REQUIRED: usize = 7;
const STRONG_RMS: u64 = 327; // About -40 dBFS.
const KEEP_RMS: u64 = 104; // About -50 dBFS, to retain quieter syllables.

fn pcm_range(wav: &[u8]) -> Option<Range<usize>> {
    if wav.get(..4) != Some(b"RIFF") || wav.get(8..12) != Some(b"WAVE") {
        return None;
    }
    let mut offset = 12usize;
    while let Some(header) = wav.get(offset..offset.saturating_add(8)) {
        let length = u32::from_le_bytes(header[4..8].try_into().unwrap()) as usize;
        let start = offset + 8;
        if &header[..4] == b"data" {
            // FFmpeg writes 0xffffffff for the length when stdout is a pipe.
            return Some(start..start.saturating_add(length).min(wav.len()));
        }
        offset = start.saturating_add(length).saturating_add(length % 2);
    }
    None
}

pub(super) fn is_silent(wav: &[u8]) -> bool {
    pcm_range(wav).is_some_and(|range| {
        wav[range]
            .as_chunks::<2>()
            .0
            .iter()
            .all(|sample| i16::from_le_bytes(*sample).unsigned_abs() <= 3)
    })
}

pub(super) fn trim_quiet_edges(wav: &mut Vec<u8>) {
    let Some(data) = pcm_range(wav) else { return };
    if data.end != wav.len() || !data.len().is_multiple_of(2) {
        return;
    }

    let mut first = None;
    let mut last = 0;
    let mut strong_frames = 0;
    let mut sustained = false;
    for (index, frame) in wav[data.clone()].chunks(FRAME_BYTES).enumerate() {
        let samples = frame.as_chunks::<2>().0;
        let energy: u64 = samples
            .iter()
            .map(|sample| u64::from(i16::from_le_bytes(*sample).unsigned_abs()).pow(2))
            .sum();
        let mean_square = energy / samples.len() as u64;
        if mean_square >= KEEP_RMS.pow(2) {
            let start = index * FRAME_BYTES;
            first.get_or_insert(start);
            last = start + frame.len();
        }
        strong_frames = if mean_square >= STRONG_RMS.pow(2) {
            strong_frames + 1
        } else {
            0
        };
        sustained |= strong_frames >= STRONG_FRAMES_REQUIRED;
    }
    let Some(first) = first.filter(|_| sustained) else {
        return;
    };
    let keep_start = first.saturating_sub(EDGE_MARGIN_BYTES);
    let keep_end = (last + EDGE_MARGIN_BYTES).min(data.len());
    let keep_size = keep_end - keep_start;
    if data.len() - keep_size < MIN_TRIM_BYTES {
        return;
    }

    // Keep interior pauses verbatim and update lengths for ordinary WAV readers.
    wav.copy_within(data.start + keep_start..data.start + keep_end, data.start);
    wav.truncate(data.start + keep_size);
    let riff_size = (wav.len() - 8) as u32;
    wav[4..8].copy_from_slice(&riff_size.to_le_bytes());
    wav[data.start - 4..data.start].copy_from_slice(&(keep_size as u32).to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav_with_frames(sections: &[(usize, i16)]) -> Vec<u8> {
        let mut wav = b"RIFF\xff\xff\xff\xffWAVEfmt \x10\0\0\0\x01\0\x01\0\x80\x3e\0\0\0\x7d\0\0\x02\0\x10\0LIST\x01\0\0\0\0\0data\xff\xff\xff\xff".to_vec();
        for &(frames, sample) in sections {
            for _ in 0..frames * FRAME_BYTES / 2 {
                wav.extend_from_slice(&sample.to_le_bytes());
            }
        }
        wav
    }

    #[test]
    fn trims_long_edges_without_losing_soft_syllables_or_internal_pauses() {
        let mut wav = wav_with_frames(&[
            (200, 0),
            (10, 130),
            (30, 900),
            (75, 0),
            (30, 900),
            (15, 140),
            (210, 0),
        ]);
        let original = wav.clone();
        let original_range = pcm_range(&original).unwrap();
        trim_quiet_edges(&mut wav);

        let data = pcm_range(&wav).unwrap();
        let start = original_range.start + 200 * FRAME_BYTES - EDGE_MARGIN_BYTES;
        let end = original_range.end - 210 * FRAME_BYTES + EDGE_MARGIN_BYTES;
        assert_eq!(wav[data.clone()], original[start..end]);
        assert_eq!(wav.len(), data.end);
        assert_eq!(
            u32::from_le_bytes(wav[4..8].try_into().unwrap()) as usize,
            wav.len() - 8
        );
        assert_eq!(
            u32::from_le_bytes(wav[data.start - 4..data.start].try_into().unwrap()) as usize,
            data.len()
        );
    }

    #[test]
    fn keeps_quiet_short_and_already_tight_takes_unchanged() {
        for sections in [
            &[(200, 0), (30, 130), (210, 0)][..],
            &[(200, 0), (1, 6000), (210, 0)][..],
            &[(5, 0), (25, 900), (5, 0)][..],
            &[(200, 2)][..],
        ] {
            let mut wav = wav_with_frames(sections);
            let original = wav.clone();
            trim_quiet_edges(&mut wav);
            assert_eq!(wav, original);
        }
        assert!(is_silent(&wav_with_frames(&[(200, 2)])));
        assert!(!is_silent(&wav_with_frames(&[(30, 130)])));
    }
}
