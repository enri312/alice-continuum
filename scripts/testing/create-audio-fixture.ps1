$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$evalAudioDir = Join-Path $PSScriptRoot '../../local/artifacts/gemma-evaluation'
New-Item -ItemType Directory -Path $evalAudioDir -Force | Out-Null
$evalSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $evalSpeaker.SelectVoice('Microsoft Zira Desktop')
    $evalSpeaker.SetOutputToWaveFile((Join-Path (Resolve-Path $evalAudioDir).Path 'speech.wav'))
    $evalSpeaker.Speak('The blue bicycle is next to the library. The secret number is forty seven.')
} finally {
    $evalSpeaker.Dispose()
}
