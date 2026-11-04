$ErrorActionPreference = 'Stop'
# Portable ASR used by src-tauri/src/whisper_input.rs. No PATH, service or GPU changes.
# Downloads occur only when this script is run explicitly, never at app startup.
$whisperRoot = 'D:\Alice-model-evaluation\runtimes\whisper-v1.9.2'
$whisperArchive = Join-Path $whisperRoot 'official-cpu-x64.zip'
$whisperModel = 'D:\Alice-model-evaluation\models\whisper\ggml-base.bin'

function Receive-VerifiedFile([string]$Destination, [string]$Url, [string]$Sha256) {
    if (Test-Path -LiteralPath $Destination) {
        if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
            throw "Hash incorrecto: $Destination. No se ejecutará ni sobrescribirá."
        }
        return
    }
    $partialDownload = $Destination + '.part'
    if (Test-Path -LiteralPath $partialDownload) { throw "Descarga parcial existente: $partialDownload. Revísala antes de repetir." }
    curl.exe --fail --location --silent --show-error --output $partialDownload $Url
    if ($LASTEXITCODE -ne 0) { throw "Falló la descarga: $Url. El archivo parcial se conserva para revisión." }
    if ((Get-FileHash -LiteralPath $partialDownload -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) {
        throw "Hash incorrecto en la descarga: $partialDownload. No se instalará."
    }
    Move-Item -LiteralPath $partialDownload -Destination $Destination
}

New-Item -ItemType Directory -Path $whisperRoot, (Split-Path -Parent $whisperModel) -Force | Out-Null
Receive-VerifiedFile $whisperArchive 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip' '49dcc16de826f20bd53d44f947a1ae49dfa81f86cad67a64d80820cb192d674a'
Receive-VerifiedFile $whisperModel 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin' '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
$whisperCli = Join-Path $whisperRoot 'bin\Release\whisper-cli.exe'
if (!(Test-Path -LiteralPath $whisperCli)) {
    Expand-Archive -LiteralPath $whisperArchive -DestinationPath (Join-Path $whisperRoot 'bin')
}
if ((Get-FileHash -LiteralPath $whisperCli -Algorithm SHA256).Hash.ToLowerInvariant() -ne '95e3c0b0e778ad9499eb0125f97c1dcf437dd9eb4ea77050b043574f93c2631d') {
    throw 'El ejecutable no coincide con el paquete oficial verificado.'
}
Write-Output 'Whisper base multilingüe verificado: CPU, español, cuatro hilos. Gemma sigue encargado del diálogo.'
Write-Output ('Motor: ' + $whisperCli)
Write-Output ('Modelo: ' + $whisperModel)
