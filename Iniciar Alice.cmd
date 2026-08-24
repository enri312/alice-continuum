@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Alice - Núcleo cognitivo local

rem Iniciar siempre desde la raíz real del proyecto, incluso al usar un acceso directo.
cd /d "%~dp0"
if errorlevel 1 (
  echo [ALICE] ERROR: no se pudo abrir la carpeta del proyecto.
  goto :fatal
)
set "ALICE_PROJECT_ROOT=%CD%"

set "ALICE_CHECK_ONLY="
if /i "%~1"=="--check" set "ALICE_CHECK_ONLY=1"

rem Mantiene memoria, auditorías y datos de Alice dentro del disco del proyecto.
rem ALICE_DATA_DIR puede definirse externamente para usar otra ubicación.
if not defined ALICE_DATA_DIR set "ALICE_DATA_DIR=%ALICE_PROJECT_ROOT%\data"
for %%I in ("%ALICE_DATA_DIR%") do set "ALICE_DATA_DIR=%%~fI"
if not exist "%ALICE_DATA_DIR%" mkdir "%ALICE_DATA_DIR%" 2>nul
if not exist "%ALICE_DATA_DIR%" (
  echo [ALICE] ERROR: no se pudo crear o acceder a "%ALICE_DATA_DIR%".
  goto :fatal
)

rem Un único caché Rust, alineado con src-tauri\.cargo\config.toml.
rem Evita recompilar todo en src-tauri\target y .cargo-target simultáneamente.
set "CARGO_TARGET_DIR=%ALICE_PROJECT_ROOT%\.cargo-target"

echo [ALICE] Proyecto : %ALICE_PROJECT_ROOT%
echo [ALICE] Datos    : %ALICE_DATA_DIR%
echo [ALICE] Caché    : %CARGO_TARGET_DIR%
echo.

call :require_command node "Node.js"
if errorlevel 1 goto :fatal
call :require_command npm "npm"
if errorlevel 1 goto :fatal
call :require_command cargo "Rust/Cargo"
if errorlevel 1 goto :fatal

rem Vite 8 requiere Node 20.19+ o 22.12+.
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a===20&&b>=19||a>=22?0:1)" >nul 2>nul
if errorlevel 1 (
  echo [ALICE] ERROR: la versión instalada de Node no es compatible con Vite 8.
  echo [ALICE] Instale Node 20.19 o una versión 22.12 o superior.
  goto :fatal
)

if not exist "%ALICE_PROJECT_ROOT%\package.json" (
  echo [ALICE] ERROR: falta package.json; el lanzador no está en la raíz correcta.
  goto :fatal
)
if not exist "%ALICE_PROJECT_ROOT%\node_modules\.bin\vite.cmd" (
  echo [ALICE] ERROR: faltan las dependencias de la interfaz.
  echo [ALICE] Ejecute: npm install
  goto :fatal
)
if not exist "%ALICE_PROJECT_ROOT%\node_modules\.bin\tauri.cmd" (
  echo [ALICE] ERROR: falta la herramienta local de Tauri.
  echo [ALICE] Ejecute: npm install
  goto :fatal
)

for /f "delims=" %%V in ('node --version') do set "ALICE_NODE_VERSION=%%V"
for /f "delims=" %%V in ('cargo --version') do set "ALICE_CARGO_VERSION=%%V"
echo [ALICE] Node     : %ALICE_NODE_VERSION%
echo [ALICE] Cargo    : %ALICE_CARGO_VERSION%
echo.

rem Impide abrir una segunda copia del ejecutable perteneciente a este proyecto.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=[IO.Path]::GetFullPath($env:ALICE_PROJECT_ROOT); $found=Get-Process -Name 'alice-cognitive-core' -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -and [IO.Path]::GetFullPath($_.Path).StartsWith($root,[StringComparison]::OrdinalIgnoreCase) } catch { $false } } | Select-Object -First 1; if($found){ Write-Host ('[ALICE] Alice ya está abierta (PID {0}).' -f $found.Id); exit 10 }; exit 0"
if "%ERRORLEVEL%"=="10" goto :already_running
if errorlevel 1 (
  echo [ALICE] ERROR: no se pudo comprobar si Alice ya está abierta.
  goto :fatal
)

rem El servidor Vite usa un puerto fijo para no iniciar silenciosamente en 5174.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener=Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($listener){ exit 11 }; exit 0" >nul 2>nul
if "%ERRORLEVEL%"=="11" (
  echo [ALICE] ERROR: el puerto 5173 ya está ocupado por otro proceso.
  echo [ALICE] Cierre ese proceso antes de iniciar Alice.
  goto :fatal
)
if errorlevel 1 (
  echo [ALICE] ERROR: no se pudo verificar el puerto 5173.
  goto :fatal
)

if defined ALICE_CHECK_ONLY (
  echo [ALICE] Verificación completada: el entorno está listo para iniciar.
  exit /b 0
)

rem Ollama solo se acepta si responde y escucha exclusivamente en loopback.
set "ALICE_OLLAMA_ENABLED="
where ollama >nul 2>nul
if not errorlevel 1 (
  if not defined OLLAMA_MODELS if exist "E:\Ollama\models" set "OLLAMA_MODELS=E:\Ollama\models"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners=@(Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue); foreach($item in $listeners){ try { $address=[Net.IPAddress]::Parse($item.LocalAddress); if(-not [Net.IPAddress]::IsLoopback($address)){ Write-Host '[ALICE] ERROR: Ollama está expuesto fuera de loopback.'; exit 2 } } catch { exit 2 } }; function Test-LocalOllama { try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null; return $true } catch { return $false } }; if(Test-LocalOllama){ exit 0 }; if($listeners.Count -gt 0){ exit 1 }; $env:OLLAMA_HOST='127.0.0.1:11434'; Start-Process -FilePath (Get-Command ollama).Source -ArgumentList 'serve' -WindowStyle Hidden; for($i=0;$i -lt 20;$i++){ Start-Sleep -Milliseconds 500; if(Test-LocalOllama){ exit 0 } }; exit 1"
  if errorlevel 2 goto :fatal
  if not errorlevel 1 set "ALICE_OLLAMA_ENABLED=1"
)
if defined ALICE_OLLAMA_ENABLED (
  echo [ALICE] Ollama   : LISTO en 127.0.0.1:11434
) else (
  echo [ALICE] Ollama   : NO DISPONIBLE; Alice abrirá con las funciones locales restantes.
)
echo.

set "ALICE_ANY_AI="
rem OpenRouter permanece pausado: conservar su clave no lo habilita en Alice.
if defined OPENAI_API_KEY set "ALICE_ANY_AI=1"
if defined ANTHROPIC_API_KEY set "ALICE_ANY_AI=1"
if defined GEMINI_API_KEY set "ALICE_ANY_AI=1"
if defined XAI_API_KEY set "ALICE_ANY_AI=1"
if defined ALICE_COMPATIBLE_API_KEY if defined ALICE_COMPATIBLE_BASE_URL set "ALICE_ANY_AI=1"
if defined ALICE_OLLAMA_ENABLED set "ALICE_ANY_AI=1"
if not defined ALICE_ANY_AI (
  echo [ALICE] Aviso: no hay un proveedor de IA disponible.
  echo [ALICE] La aplicación abrirá, pero la conversación permanecerá desconectada.
  echo.
)

echo [ALICE] Iniciando aplicación de escritorio...
echo [ALICE] Para detenerla, cierre la ventana de Alice o presione Ctrl+C aquí.
echo.
call npm run tauri -- dev
set "ALICE_EXIT_CODE=%ERRORLEVEL%"
if not "%ALICE_EXIT_CODE%"=="0" (
  echo.
  echo [ALICE] El inicio terminó con el código %ALICE_EXIT_CODE%.
  echo [ALICE] Revise el último mensaje mostrado arriba.
  goto :fatal_with_code
)
exit /b 0

:require_command
where %~1 >nul 2>nul
if errorlevel 1 (
  echo [ALICE] ERROR: no se encontró %~2 en PATH.
  exit /b 1
)
exit /b 0

:already_running
echo [ALICE] No se iniciará una segunda instancia.
exit /b 0

:fatal_with_code
if not defined ALICE_NO_PAUSE pause
exit /b %ALICE_EXIT_CODE%

:fatal
if not defined ALICE_NO_PAUSE pause
exit /b 1
