@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Alice Continuum - Memoria, cognición y presencia

rem Resolver la raíz incluso al abrir desde un acceso directo u otra carpeta.
cd /d "%~dp0"
if errorlevel 1 (
  echo [ALICE] ERROR: no se pudo abrir la carpeta del proyecto.
  set "ALICE_EXIT_CODE=1"
  goto :fatal
)
set "ALICE_PROJECT_ROOT=%CD%"
set "ALICE_CHECK_ONLY="
if /i "%~1"=="--check" set "ALICE_CHECK_ONLY=1"
if defined ALICE_CHECK_ONLY set "ALICE_NO_PAUSE=1"
if not "%~2"=="" goto :usage
if not "%~1"=="" if /i not "%~1"=="--check" goto :usage

rem Una sola sesión de PowerShell comprueba y supervisa todo el arranque.
powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ALICE_PROJECT_ROOT%\scripts\setup\launch-windows.ps1"
set "ALICE_EXIT_CODE=%ERRORLEVEL%"
if not "%ALICE_EXIT_CODE%"=="0" goto :fatal
exit /b 0

:usage
echo [ALICE] Uso: Iniciar Alice Continuum.cmd [--check]
exit /b 2

:fatal
if not defined ALICE_NO_PAUSE pause
exit /b %ALICE_EXIT_CODE%
