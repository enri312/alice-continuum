$ErrorActionPreference = 'Stop'
if ((Invoke-RestMethod 'http://127.0.0.1:11434/api/ps').models.Count -gt 0) { throw 'Ollama has an active model; evaluation aborted.' }
if (Get-NetTCPConnection -LocalPort 18089 -State Listen -ErrorAction SilentlyContinue) { throw 'Evaluation port already in use.' }
$evalProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$evalLogRoot = Join-Path $evalProjectRoot 'local\artifacts\gemma-evaluation'
[System.IO.Directory]::CreateDirectory($evalLogRoot) | Out-Null
$evalExe = 'D:\Alice-model-evaluation\runtimes\llama-b10809\bin\llama-server.exe'
$evalArgs = @('-m','D:\Alice-model-evaluation\models\gemma4-e2b\gemma-4-E2B-it-Q4_K_M.gguf',
    '--mmproj','D:\Alice-model-evaluation\models\gemma4-e2b\mmproj-F16.gguf',
    '--host','127.0.0.1','--port','18089','-c','4096','-np','1','-ngl','24',
    '--mmproj-offload','--reasoning','off','--jinja','-t','8',
    '--cors-origins','http://127.0.0.1:18089','--no-cors-credentials','--no-agent',
    '--image-min-tokens','1120','--image-max-tokens','1120')
$evalProcess = Start-Process -FilePath $evalExe -ArgumentList $evalArgs -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $evalLogRoot 'llama-stdout.log') `
    -RedirectStandardError (Join-Path $evalLogRoot 'llama-stderr.log')
Write-Output ('Evaluation process PID: ' + $evalProcess.Id)
