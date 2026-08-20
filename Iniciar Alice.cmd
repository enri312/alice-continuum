@echo off
setlocal
title Alice - Inicio de desarrollo
cd /d "%~dp0"

rem Mantiene memoria, auditorias y futuros datos de Alice en el disco del proyecto.
rem Puede cambiarse antes de ejecutar este archivo definiendo ALICE_DATA_DIR.
if not defined ALICE_DATA_DIR set "ALICE_DATA_DIR=%~dp0data"
if not exist "%ALICE_DATA_DIR%" mkdir "%ALICE_DATA_DIR%"
rem Usa un único destino de compilación para evitar abrir ejecutables antiguos con otro icono.
set "CARGO_TARGET_DIR=%~dp0src-tauri\target"
echo [ALICE] Datos locales: %ALICE_DATA_DIR%
echo.

rem Ollama se inicia en loopback para que la inferencia local no quede expuesta en la red.
set "ALICE_OLLAMA_ENABLED="
where ollama >nul 2>nul
if not errorlevel 1 (
  if not defined OLLAMA_MODELS if exist "E:\Ollama\models" set "OLLAMA_MODELS=E:\Ollama\models"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "function Test-AliceOllama { try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null; $listeners=@(Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction Stop); if($listeners.Count -eq 0){ return $false }; foreach($listener in $listeners){ $address=[Net.IPAddress]::Parse($listener.LocalAddress); if(-not [Net.IPAddress]::IsLoopback($address)){ return $false } }; return $true } catch { return $false } }; $ready=Test-AliceOllama; if(-not $ready){ $env:OLLAMA_HOST='127.0.0.1:11434'; Start-Process -FilePath (Get-Command ollama).Source -ArgumentList 'serve' -WindowStyle Hidden; for($i=0;$i -lt 20 -and -not $ready;$i++){ Start-Sleep -Milliseconds 500; $ready=Test-AliceOllama } }; if($ready){ exit 0 } else { exit 1 }"
  if not errorlevel 1 set "ALICE_OLLAMA_ENABLED=1"
)
if defined ALICE_OLLAMA_ENABLED (
  echo [ALICE] Ollama local: LISTO en 127.0.0.1:11434
) else (
  echo [ALICE] Ollama local: NO DISPONIBLE; continuaran habilitados los proveedores configurados.
)
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ALICE] No se encontro npm. Verifique la instalacion de Node.js.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ALICE] Faltan dependencias. Ejecute primero: npm install
  pause
  exit /b 1
)

set "ALICE_ANY_AI="
if defined OPENROUTER_API_KEY set "ALICE_ANY_AI=1"
if defined OPENAI_API_KEY set "ALICE_ANY_AI=1"
if defined ANTHROPIC_API_KEY set "ALICE_ANY_AI=1"
if defined GEMINI_API_KEY set "ALICE_ANY_AI=1"
if defined XAI_API_KEY set "ALICE_ANY_AI=1"
if defined ALICE_COMPATIBLE_API_KEY if defined ALICE_COMPATIBLE_BASE_URL set "ALICE_ANY_AI=1"
if defined ALICE_OLLAMA_ENABLED set "ALICE_ANY_AI=1"
if not defined ALICE_ANY_AI (
  echo [ALICE] Aviso: no hay un proveedor de IA configurado. La app abrira, pero la conversacion de nube permanecera desconectada.
  echo.
)

echo [ALICE] Iniciando aplicacion de escritorio...
npm run tauri dev

if errorlevel 1 (
  echo.
  echo [ALICE] El inicio termino con un error. Revise el mensaje anterior.
  pause
)
