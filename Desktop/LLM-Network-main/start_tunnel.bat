@echo off
setlocal

cd /d "%~dp0"

set "PORT=8000"
set "TARGET_URL=http://localhost:%PORT%"
set "CLOUDFLARED_BIN="

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

where cloudflared >nul 2>nul
if not errorlevel 1 (
  set "CLOUDFLARED_BIN=cloudflared"
)
if not defined CLOUDFLARED_BIN if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
  set "CLOUDFLARED_BIN=C:\Program Files (x86)\cloudflared\cloudflared.exe"
)
if not defined CLOUDFLARED_BIN (
  echo cloudflared is not installed or not on PATH.
  echo.
  echo Install it with:
  echo   winget install --id Cloudflare.cloudflared -e
  echo.
  echo Then run this script again.
  exit /b 1
)

echo Starting a public tunnel to %TARGET_URL%
echo.
echo If you use the generated hostname for Firebase sign-in, add it to:
echo   Firebase Console ^> Authentication ^> Settings ^> Authorized domains
echo.
echo Note: quick tunnels get a new hostname each run.
echo.
start "LLM Network Tunnel" cmd /k "cd /d ""%CD%"" && ""%CLOUDFLARED_BIN%"" tunnel --url %TARGET_URL%"
exit /b 0

:help
echo LLM Network public tunnel launcher
echo.
echo Usage:
echo   %~nx0
echo.
echo What it does:
echo   1. Opens a Cloudflare quick tunnel to http://localhost:8000.
echo   2. Prints a public trycloudflare.com URL you can open from another PC.
echo   3. Reminds you to add the tunnel hostname to Firebase authorized domains.
echo.
echo Prerequisite:
echo   cloudflared on PATH.
exit /b 0
