param(
    [ValidateSet('base', 'small')]
    [string] $Model = 'small'
)

$ErrorActionPreference = 'Stop'
# Portable ASR used by src-tauri/src/whisper_input.rs. No PATH, service or GPU changes.
# Downloads occur only when this script is run explicitly, never at app startup.
$inferenceRoot = if ($env:ALICE_INFERENCE_HOME) { $env:ALICE_INFERENCE_HOME } else { 'D:\Alice-model-evaluation' }
if (-not [IO.Path]::IsPathRooted($inferenceRoot)) { throw 'ALICE_INFERENCE_HOME debe contener una ruta absoluta.' }
$whisperRoot = Join-Path $inferenceRoot 'runtimes\whisper-v1.9.2'
$whisperArchive = Join-Path $whisperRoot 'official-cpu-x64.zip'
$whisperModel = Join-Path $inferenceRoot "models\whisper\ggml-$Model.bin"
$modelSha256 = @{
    base = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
    small = '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b'
}[$Model]

function Receive-VerifiedFile([string]$Destination, [string]$Url, [string]$Sha256) {
    if (Test-Path -LiteralPath $Destination) {
        if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
            throw "Hash incorrecto: $Destination. No se ejecutará ni sobrescribirá."
        }
        return
    }
    $partialDownload = $Destination + '.part'
    if (Test-Path -LiteralPath $partialDownload) { throw "Descarga parcial existente: $partialDownload. Revísala antes de repetir." }
    # Use the project's Node TLS client with certificate validation enabled.
    # Schannel curl can fail when its revocation endpoint is temporarily offline.
    $downloadScript = @'
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const [destination, url] = process.argv.slice(2);
const response = await fetch(url, { signal: AbortSignal.timeout(1800000) });
if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: 'wx' }));
'@
    $downloadScript | & node --dns-result-order=ipv4first --input-type=module - $partialDownload $Url
    if ($LASTEXITCODE -ne 0) { throw "Falló la descarga: $Url. El archivo parcial se conserva para revisión." }
    if ((Get-FileHash -LiteralPath $partialDownload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
        throw "Hash incorrecto en la descarga: $partialDownload. No se instalará."
    }
    Move-Item -LiteralPath $partialDownload -Destination $Destination
}

New-Item -ItemType Directory -Path $whisperRoot, (Split-Path -Parent $whisperModel) -Force | Out-Null
Receive-VerifiedFile $whisperArchive 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip' '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
Receive-VerifiedFile $whisperModel "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$Model.bin" $modelSha256
$whisperCli = Join-Path $whisperRoot 'bin\Release\whisper-cli.exe'
if (!(Test-Path -LiteralPath $whisperCli)) {
    Expand-Archive -LiteralPath $whisperArchive -DestinationPath (Join-Path $whisperRoot 'bin')
}
if ((Get-FileHash -LiteralPath $whisperCli -Algorithm SHA256).Hash.ToLowerInvariant() -ne '95e3c0b0e778ad9499eb0125f97c1dcf437dd9eb4ea77050b043574f93c2631d') {
    throw 'El ejecutable no coincide con el paquete oficial verificado.'
}
Write-Output "Whisper $Model multilingüe verificado: CPU, español, cuatro hilos. Gemma sigue encargado del diálogo."
Write-Output 'Alice prefiere small si está instalado; conserva base y respeta ALICE_WHISPER_MODEL si se configura.'
Write-Output ('Motor: ' + $whisperCli)
Write-Output ('Modelo: ' + $whisperModel)
