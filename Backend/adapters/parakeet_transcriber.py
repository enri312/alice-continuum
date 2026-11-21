"""Transcribe one local 16 kHz PCM WAV supplied by Alice through stdin."""

from array import array
from io import BytesIO
from pathlib import Path
import sys
import wave

MAX_WAV_BYTES = 60 * 32_000 + 4096


def main():
    model = Path(sys.argv[1])
    data = sys.stdin.buffer.read(MAX_WAV_BYTES + 1)
    if len(data) > MAX_WAV_BYTES:
        raise ValueError("La toma supera el límite de audio")
    with wave.open(BytesIO(data), "rb") as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) != (1, 2, 16000):
            raise ValueError("Se requiere PCM mono de 16 kHz")
        samples = array("h", audio.readframes(60 * 16000 + 1))
    if len(samples) > 60 * 16000:
        raise ValueError("La toma supera los 60 segundos")

    import sherpa_onnx

    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(model / "encoder.int8.onnx"),
        decoder=str(model / "decoder.int8.onnx"),
        joiner=str(model / "joiner.int8.onnx"),
        tokens=str(model / "tokens.txt"),
        model_type="nemo_transducer", provider="cpu", num_threads=4, sample_rate=16000,
    )
    stream = recognizer.create_stream()
    stream.accept_waveform(16000, [sample / 32768 for sample in samples])
    recognizer.decode_stream(stream)
    sys.stdout.buffer.write(stream.result.text.strip().encode("utf-8"))


if __name__ == "__main__":
    main()
