@echo off
setlocal

cd /d "%~dp0"

set "HOST=0.0.0.0"
set "PORT=8000"
set "SERVER_URL=http://localhost:%PORT%"

if /I "%~1"=="help" goto :help
if /I "%~1"=="--help" goto :help
if /I "%~1"=="/?" goto :help

set "PYTHON_CMD="
if exist ".venv\Scripts\python.exe" set "PYTHON_CMD=""%CD%\.venv\Scripts\python.exe"""
if not defined PYTHON_CMD (
  where py >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=py -3"
)
if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
  echo Could not find Python. Create .venv or install Python 3.8+ first.
  exit /b 1
)

echo Starting Ollama Network server on %HOST%:%PORT%
echo Local dashboard URL: %SERVER_URL%/dashboard
start "LLM Network Server" cmd /k "cd /d ""%CD%"" && set PYTHONPATH=src && %PYTHON_CMD% -m ollama_network.server --host %HOST% --port %PORT%"

echo.
echo Server launch requested.
echo Use start_dashboard.bat on this machine to open the UI.
echo.
exit /b 0

:help
echo LLM Network server launcher
echo.
echo Usage:
echo   %~nx0
echo.
echo What it does:
echo   1. Starts the API server in a new terminal window.
echo   2. Binds the server to 0.0.0.0 so other machines can reach it.
echo   3. Prints the local dashboard URL for this PC.
echo.
echo Edit HOST or PORT at the top of this file if you need different values.
exit /b 0
