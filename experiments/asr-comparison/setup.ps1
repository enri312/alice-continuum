param(
    [Parameter(Mandatory=$true)][string]$Python,
    [string]$StateDirectory = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'local\experiments\asr-comparison')
)
$ErrorActionPreference = 'Stop'
$pilotRoot = [IO.Path]::GetFullPath($StateDirectory)
if (-not $pilotRoot.StartsWith('D:\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Use a private experiment directory on D:.' }
$pilotEnvironment = @{}
foreach ($pilotName in @('SystemRoot','WINDIR','PATH','COMSPEC','PATHEXT','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','SystemDrive')) {
    $pilotValue = [Environment]::GetEnvironmentVariable($pilotName)
    if ($null -ne $pilotValue) { $pilotEnvironment[$pilotName] = $pilotValue }
}
$pilotLocations = @{
    TEMP='temp'; TMP='temp'; TMPDIR='temp'; PIP_CACHE_DIR='cache\pip';
    HF_HOME='cache\huggingface'; HF_HUB_CACHE='cache\huggingface\hub';
    HUGGINGFACE_HUB_CACHE='cache\huggingface\hub'; HF_XET_CACHE='cache\xet';
    PYTHONUSERBASE='cache\user'; PYTHONPYCACHEPREFIX='cache\pycache';
    HOME='home'; USERPROFILE='home'; APPDATA='home\AppData\Roaming'; LOCALAPPDATA='home\AppData\Local'
}
foreach ($pilotName in $pilotLocations.Keys) {
    $pilotPath = Join-Path $pilotRoot $pilotLocations[$pilotName]
    New-Item -ItemType Directory -Path $pilotPath -Force | Out-Null
    $pilotEnvironment[$pilotName] = $pilotPath
}
foreach ($pilotDirectory in @('venv','models','downloads','corpus','evidence')) { New-Item -ItemType Directory -Path (Join-Path $pilotRoot $pilotDirectory) -Force | Out-Null }
foreach ($pilotName in @('PYTHONDONTWRITEBYTECODE','PYTHONNOUSERSITE','PIP_DISABLE_PIP_VERSION_CHECK','PIP_NO_INPUT','HF_HUB_DISABLE_IMPLICIT_TOKEN','HF_HUB_DISABLE_TELEMETRY','HF_HUB_DISABLE_XET')) { $pilotEnvironment[$pilotName] = '1' }
$pilotEnvironment['PIP_CONFIG_FILE'] = 'NUL'

function Quote-PilotArgument([string]$Value) {
    $quoted = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $quoted = [regex]::Replace($quoted, '(\\+)$', '$1$1')
    return '"' + $quoted + '"'
}
function Invoke-PilotProcess([string]$Executable, [string[]]$PilotArguments) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Executable
    $start.Arguments = (($PilotArguments | ForEach-Object { Quote-PilotArgument $_ }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    foreach ($pilotName in $pilotEnvironment.Keys) { $start.EnvironmentVariables[$pilotName] = $pilotEnvironment[$pilotName] }
    $ownedProcess = New-Object Diagnostics.Process
    $pilotStarted = $false
    try {
        $ownedProcess.StartInfo = $start
        if (-not $ownedProcess.Start()) { throw 'Could not start the isolated setup child.' }
        $pilotStarted = $true
        $outputTask = $ownedProcess.StandardOutput.ReadToEndAsync()
        $errorTask = $ownedProcess.StandardError.ReadToEndAsync()
        if (-not $ownedProcess.WaitForExit(300000)) { $ownedProcess.Kill(); $ownedProcess.WaitForExit(); throw 'Isolated setup timed out.' }
        $output = $outputTask.GetAwaiter().GetResult()
        $diagnostic = $errorTask.GetAwaiter().GetResult()
        if ($diagnostic) { [Console]::Error.Write($diagnostic) }
        if ($ownedProcess.ExitCode -ne 0) { throw ('Isolated setup failed with exit ' + $ownedProcess.ExitCode) }
        return $output
    } finally {
        try {
            if ($pilotStarted -and -not $ownedProcess.HasExited) {
                try { $ownedProcess.Kill() }
                catch { if (-not $ownedProcess.HasExited) { throw } }
                $ownedProcess.WaitForExit()
            }
        } finally { $ownedProcess.Dispose() }
    }
}
$pilotPython = Join-Path $pilotRoot 'venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pilotPython)) { Write-Output (Invoke-PilotProcess $Python @('-B','-m','venv',(Join-Path $pilotRoot 'venv'))) }
Write-Output (Invoke-PilotProcess $pilotPython @('-B','-m','pip','install','--only-binary=:all:','--index-url','https://pypi.org/simple','-r',(Join-Path $PSScriptRoot 'requirements.lock.txt')))
$installed = Invoke-PilotProcess $pilotPython @('-B','-m','pip','freeze')
Set-Content -LiteralPath (Join-Path $pilotRoot 'evidence\installed-requirements.txt') -Value $installed -Encoding utf8
Write-Output ('Isolated interpreter: ' + $pilotPython)
Write-Output 'No caller/global environment variable was changed; every child received only the isolated allowlist.'
