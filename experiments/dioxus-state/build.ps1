param(
  [Parameter(Mandatory=$true)][string]$RustToolchainRoot,
  [Parameter(Mandatory=$true)][string]$CargoHome,
  [Parameter(Mandatory=$true)][string]$WasmBindgen,
  [switch]$Offline
)
$ErrorActionPreference = 'Stop'
function Invoke-PilotTool([string]$Binary, [string[]]$ToolArgs) {
  # Windows PowerShell 5.1 presents ordinary native stderr as ErrorRecord.
  # Cargo uses that stream for progress; retain it as text and judge exit code.
  $previousPreference = $ErrorActionPreference
  $privateEnvironment = @{}
  foreach ($entry in Get-ChildItem Env:) {
    if ($entry.Name -match '(?i)(api[_-]?key|token|secret|pass(word|wd)?|cookie|authorization|credential|proxy|access[_-]?key|private[_-]?key)' -or
        $entry.Name -match '^(ALICE_|FISH_|OPENAI_|ANTHROPIC_|GEMINI_|XAI_|OPENROUTER_|DEEPSEEK_)') {
      # Save only in process memory for restoration; never print names/values.
      $privateEnvironment[$entry.Name] = $entry.Value
      [Environment]::SetEnvironmentVariable($entry.Name,$null,'Process')
    }
  }
  try {
    $ErrorActionPreference = 'Continue'
    & $Binary @ToolArgs 2>&1 | ForEach-Object { Write-Output "$_" }
    $nativeExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
    foreach ($name in $privateEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name,$privateEnvironment[$name],'Process') }
  }
  if ($nativeExit -ne 0) { throw "La herramienta del piloto terminó con código $nativeExit." }
}
$pilotRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$projectRoot = [IO.Path]::GetFullPath((Join-Path $pilotRoot '../..'))
$privateRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'local/experiments/dioxus-state'))
$tempRoot = Join-Path $privateRoot 'temp'
$targetRoot = Join-Path $privateRoot 'target'
$distRoot = Join-Path $privateRoot 'dist'
$driveRoot = [IO.Path]::GetPathRoot($projectRoot)
foreach ($writable in @($privateRoot, $CargoHome)) {
  if ([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($writable)) -ne $driveRoot) {
    throw 'Las rutas de escritura del piloto deben estar en la misma unidad del proyecto.'
  }
}
$cargo = Join-Path $RustToolchainRoot 'bin/cargo.exe'
$rustc = Join-Path $RustToolchainRoot 'bin/rustc.exe'
$rustdoc = Join-Path $RustToolchainRoot 'bin/rustdoc.exe'
foreach ($binary in @($cargo, $rustc, $rustdoc, $WasmBindgen)) {
  if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw 'Falta una herramienta explícita del piloto.' }
}
$bindgenVersion = (Invoke-PilotTool $WasmBindgen @('--version')) -join ''
if ($bindgenVersion -notmatch '^wasm-bindgen 0\.2\.105$') { throw 'Se requiere wasm-bindgen CLI 0.2.105 para este Cargo.lock.' }
New-Item -ItemType Directory -Force -Path $tempRoot,$targetRoot,$distRoot | Out-Null
$saved = @{}
foreach ($name in @('CARGO_HOME','CARGO_TARGET_DIR','RUSTC','RUSTDOC','TEMP','TMP','RUSTUP_HOME','CARGO_BUILD_JOBS')) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  $env:CARGO_HOME = [IO.Path]::GetFullPath($CargoHome)
  $env:CARGO_TARGET_DIR = $targetRoot
  $env:RUSTC = $rustc
  $env:RUSTDOC = $rustdoc
  $env:TEMP = $tempRoot
  $env:TMP = $tempRoot
  $env:RUSTUP_HOME = Join-Path $privateRoot 'rustup-unused'
  $env:CARGO_BUILD_JOBS = '2'
  $buildArgs = @('build','--manifest-path',(Join-Path $pilotRoot 'Cargo.toml'),'--locked','--release','--target','wasm32-unknown-unknown','--target-dir',$targetRoot)
  if ($Offline) { $buildArgs += '--offline' }
  else { Write-Output "Cargo puede descargar las dependencias fijadas en Cargo.lock a $env:CARGO_HOME; no instala toolchains ni modelos." }
  Invoke-PilotTool $cargo $buildArgs
  Invoke-PilotTool $WasmBindgen @((Join-Path $targetRoot 'wasm32-unknown-unknown/release/alice_dioxus_state.wasm'),'--target','web','--out-dir',(Join-Path $distRoot 'pkg'),'--no-typescript')
  foreach ($asset in @('index.html','bootstrap.js','style.css')) { Copy-Item -LiteralPath (Join-Path $pilotRoot "web/$asset") -Destination (Join-Path $distRoot $asset) -Force }
  Write-Output "Piloto generado en $distRoot"
} finally {
  foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
