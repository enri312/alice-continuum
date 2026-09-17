$ErrorActionPreference = 'Stop'
# Isolated portable runtime; no PATH, services, driver or application changes.
$evalBase = 'D:\Alice-model-evaluation\runtimes\llama-b10809'
New-Item -ItemType Directory -Path $evalBase -Force | Out-Null
$evalFiles = @(
    @{ Name='llama-b10809-bin-win-cuda-12.4-x64.zip'; Hash='c77bfcd9ed8d91e8721a2d6a290b907fddd4fa5412a47b21c6fa1709116b85f9' },
    @{ Name='cudart-llama-bin-win-cuda-12.4-x64.zip'; Hash='8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6' }
)
foreach ($evalFile in $evalFiles) {
    $evalArchive = Join-Path $evalBase $evalFile.Name
    if (!(Test-Path -LiteralPath $evalArchive)) {
        curl.exe --fail --location --silent --show-error --output $evalArchive ('https://github.com/ggml-org/llama.cpp/releases/download/b10809/' + $evalFile.Name)
        if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
    }
    if ((Get-FileHash -LiteralPath $evalArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $evalFile.Hash) { throw 'SHA256 mismatch; no execution permitted' }
    Expand-Archive -LiteralPath $evalArchive -DestinationPath (Join-Path $evalBase 'bin') -Force
    Write-Output ('Verified and extracted ' + $evalFile.Name)
}
