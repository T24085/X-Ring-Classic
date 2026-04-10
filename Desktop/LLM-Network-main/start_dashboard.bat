@echo off
setlocal

cd /d "%~dp0"

set "HOST=localhost"
set "PORT=8000"
set "DASHBOARD_URL=http://%HOST%:%PORT%/dashboard"

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

echo Opening dashboard: %DASHBOARD_URL%
start "" "%DASHBOARD_URL%"
exit /b 0

:help
echo LLM Network dashboard launcher
echo.
echo Usage:
echo   %~nx0
echo.
echo What it does:
echo   1. Opens the local dashboard in your default browser.
echo   2. Assumes the server is already running on %HOST%:%PORT%.
echo.
echo Edit HOST or PORT at the top of this file if your local dashboard URL differs.
exit /b 0

