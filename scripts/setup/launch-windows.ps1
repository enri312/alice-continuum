$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $root
$env:ALICE_PROJECT_ROOT = $root
$checkOnly = $env:ALICE_CHECK_ONLY -eq '1'
$launchLock = $null
$lockAcquired = $false

function Test-LocalOllama([int] $TimeoutMs = 1000) {
    $response = $null
    try {
        $request = [Net.WebRequest]::Create('http://127.0.0.1:11434/api/version')
        $request.Proxy = $null
        $request.Timeout = $TimeoutMs
        $request.ReadWriteTimeout = $TimeoutMs
        $request.KeepAlive = $false
        $request.AllowAutoRedirect = $false
        $response = $request.GetResponse()
        return [int] $response.StatusCode -eq 200
    } catch {
        return $false
    } finally {
        if ($response) { $response.Close() }
    }
}

function Start-LocalOllama($Command, $Listeners) {
    if (-not $Command) { return $false }
    $ollamaListeners = @($Listeners | Where-Object { $_.Port -eq 11434 })
    foreach ($listener in $ollamaListeners) {
        if (-not [Net.IPAddress]::IsLoopback($listener.Address)) {
            throw 'Ollama está expuesto fuera de loopback.'
        }
    }
    if (-not $env:OLLAMA_MODELS -and (Test-Path -LiteralPath 'E:\Ollama\models' -PathType Container)) {
        $env:OLLAMA_MODELS = 'E:\Ollama\models'
    }
    if (Test-LocalOllama) { return $true }
    if ($ollamaListeners.Count -gt 0) { return $false }

    $env:OLLAMA_HOST = '127.0.0.1:11434'
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        Start-Process -FilePath $Command.Source -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    } catch {
        Write-Host "[ALICE] Ollama no pudo iniciarse: $($_.Exception.Message)"
        return $false
    }
    while ($timer.ElapsedMilliseconds -lt 10000) {
        $remaining = 10000 - [int] $timer.ElapsedMilliseconds
        if ($remaining -le 0) { break }
        if (Test-LocalOllama -TimeoutMs ([Math]::Min(1000, $remaining))) { return $true }
        $remaining = 10000 - [int] $timer.ElapsedMilliseconds
        if ($remaining -gt 0) { Start-Sleep -Milliseconds ([Math]::Min(250, $remaining)) }
    }
    return $false
}

try {
    if (Test-Path -LiteralPath (Join-Path $root '.alice-restore-incomplete')) {
        throw 'Esta carpeta contiene una restauración incompleta. Restaura en un destino nuevo.'
    }

    # El mutex se libera incluso si falla la compilación o se cierra el lanzador.
    # Permanece adquirido durante el respaldo y mientras Tauri está ejecutándose.
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $rootHash = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToUpperInvariant()))).Replace('-', '')
    } finally { $hasher.Dispose() }
    $launchLock = [Threading.Mutex]::new($false, "Local\AliceLauncher-$rootHash")
    try { $lockAcquired = $launchLock.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $lockAcquired = $true }
    if (-not $lockAcquired) {
        Write-Host '[ALICE] Alice ya se está iniciando o ejecutando desde esta carpeta.'
        if ($checkOnly) { exit 10 }
        exit 0
    }

    if (-not $env:ALICE_DATA_DIR) { $env:ALICE_DATA_DIR = Join-Path $root 'data' }
    # GetFullPath usa el directorio de .NET, que puede diferir de Set-Location.
    $dataPath = $env:ALICE_DATA_DIR
    if (-not [IO.Path]::IsPathRooted($dataPath)) { $dataPath = Join-Path $root $dataPath }
    $env:ALICE_DATA_DIR = [IO.Path]::GetFullPath($dataPath)
    if ((Test-Path -LiteralPath $env:ALICE_DATA_DIR) -and -not (Test-Path -LiteralPath $env:ALICE_DATA_DIR -PathType Container)) {
        throw 'La ruta de datos es un archivo, no una carpeta.'
    }
    $env:CARGO_TARGET_DIR = Join-Path $root '.cargo-target'
    Write-Host "[ALICE] Proyecto : $root"
    Write-Host "[ALICE] Datos    : $env:ALICE_DATA_DIR"
    Write-Host "[ALICE] Caché    : $env:CARGO_TARGET_DIR"
    Write-Host ''

    $nodeVersionFile = Join-Path $root '.node-version'
    if (Test-Path -LiteralPath $nodeVersionFile -PathType Leaf) {
        $requiredNode = (Get-Content -LiteralPath $nodeVersionFile -Raw).Trim()
        $portableNode = Join-Path $env:LOCALAPPDATA "Programs\AliceNode\node-v$requiredNode-win-x64"
        if (Test-Path -LiteralPath (Join-Path $portableNode 'node.exe') -PathType Leaf) {
            $env:PATH = "$portableNode;$env:PATH"
        }
    }
    $node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $npm = Get-Command npm -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $cargo = Get-Command cargo -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $node) { throw 'No se encontró Node.js en PATH.' }
    if (-not $npm) { throw 'No se encontró npm en PATH.' }
    if (-not $cargo) { throw 'No se encontró Rust/Cargo en PATH.' }
    & $node.Source -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major !== 26 || minor < 13) process.exit(1); console.log('[ALICE] Node     : ' + process.version);"
    if ($LASTEXITCODE -ne 0) { throw 'Alice requiere Node 26.13 o superior de la rama 26 LTS.' }
    $cargoVersion = & $cargo.Source --version
    if ($LASTEXITCODE -ne 0) { throw 'Rust/Cargo no pudo comprobar su versión.' }
    Write-Host "[ALICE] Cargo    : $cargoVersion"
    Write-Host ''

    foreach ($requiredFile in @('package.json', 'node_modules\.bin\vite.cmd', 'node_modules\.bin\tauri.cmd', 'node_modules\@tauri-apps\cli\tauri.js', 'scripts\backups\cli.mjs')) {
        if (-not (Test-Path -LiteralPath (Join-Path $root $requiredFile) -PathType Leaf)) {
            throw "Falta $requiredFile. Comprueba la carpeta del proyecto y ejecuta npm ci para instalar dependencias."
        }
    }

    $rootPrefix = $root.TrimEnd('\') + '\'
    foreach ($process in @(Get-Process -Name 'alice-continuum','alice-cognitive-core' -ErrorAction SilentlyContinue)) {
        $processPath = $null
        try { $processPath = $process.Path } catch { continue }
        if ($processPath -and [IO.Path]::GetFullPath($processPath).StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            Write-Host "[ALICE] Alice ya está abierta desde esta carpeta (PID $($process.Id))."
            if ($checkOnly) { exit 10 }
            exit 0
        }
    }
    # Una consulta .NET sirve para Vite y Ollama, sin cargar los proveedores CIM.
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners.Port -contains 5173) { throw 'El puerto 5173 ya está ocupado por otro proceso.' }
    if ($checkOnly) {
        Write-Host '[ALICE] Verificación completada: el entorno está listo para iniciar.'
        exit 0
    }

    [IO.Directory]::CreateDirectory($env:ALICE_DATA_DIR) | Out-Null
    $ollama = Get-Command ollama -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (Start-LocalOllama -Command $ollama -Listeners $listeners) {
        Write-Host '[ALICE] Ollama   : LISTO en 127.0.0.1:11434'
    } else {
        Write-Host '[ALICE] Ollama   : NO DISPONIBLE; Gemma local y los demás proveedores se comprueban dentro de Alice.'
    }
    Write-Host ''
    Write-Host '[ALICE] Iniciando aplicación de escritorio...'
    Write-Host '[ALICE] Para detenerla, cierra la ventana de Alice o presiona Ctrl+C aquí.'
    Write-Host ''
    & $node.Source (Join-Path $root 'scripts\backups\cli.mjs') run
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) { Write-Host "[ALICE] El inicio terminó con el código $exitCode. Revisa el último mensaje mostrado arriba." }
    exit $exitCode
} catch {
    Write-Host "[ALICE] ERROR: $($_.Exception.Message)"
    exit 1
} finally {
    if ($lockAcquired) { $launchLock.ReleaseMutex() }
    if ($launchLock) { $launchLock.Dispose() }
}
