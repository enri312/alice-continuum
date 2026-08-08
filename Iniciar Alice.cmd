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
