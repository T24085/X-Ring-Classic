@echo off
setlocal

cd /d "%~dp0"

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

set "SERVER_URL=%OLLAMA_NETWORK_SERVER_URL%"
if not defined SERVER_URL set "SERVER_URL=https://llm-network.websitesolutions.shop"

set "WORKER_ID=%OLLAMA_NETWORK_WORKER_ID%"
if not defined WORKER_ID set "WORKER_ID=worker-%COMPUTERNAME%"

set "OWNER_USER_ID=%OLLAMA_NETWORK_OWNER_USER_ID%"
if not defined OWNER_USER_ID (
  echo Enter the network user id that owns this worker.
  set /p OWNER_USER_ID=Owner user id: 
)

set "WORKER_TOKEN=%OLLAMA_NETWORK_WORKER_TOKEN%"
if not defined WORKER_TOKEN (
  echo.
  echo Paste the long-lived worker token for this PC.
  echo This token is required to register and claim jobs from the coordinator.
  set /p WORKER_TOKEN=Worker token: 
)

if not defined OWNER_USER_ID (
  echo Owner user id is required.
  exit /b 1
)
if not defined WORKER_TOKEN (
  echo Worker token is required.
  exit /b 1
)

echo.
echo Starting worker daemon on this PC.
echo Worker ID: %WORKER_ID%
echo Owner user id: %OWNER_USER_ID%
echo Server URL: %SERVER_URL%
echo The daemon will auto-detect this PC's GPU, RAM, and local Ollama models.
echo.

start "LLM Network Worker" cmd /k "cd /d ""%CD%"" && set PYTHONPATH=src && %PYTHON_CMD% -m ollama_network.worker_daemon --server-url ""%SERVER_URL%"" --worker-id ""%WORKER_ID%"" --owner-user-id ""%OWNER_USER_ID%"" --worker-token ""%WORKER_TOKEN%"""
exit /b 0

:help
echo LLM Network worker launcher
echo.
echo Usage:
echo   %~nx0
echo.
echo What it does:
echo   1. Starts a worker daemon on this machine.
echo   2. Auto-detects local GPU, host RAM, and Ollama models.
echo   3. Registers the worker with the coordinator and starts polling for jobs.
echo.
echo Environment variables:
echo   OLLAMA_NETWORK_SERVER_URL    Coordinator URL. Defaults to https://llm-network.websitesolutions.shop
echo   OLLAMA_NETWORK_WORKER_ID     Worker identifier. Defaults to worker-%%COMPUTERNAME%%
echo   OLLAMA_NETWORK_OWNER_USER_ID Owner network user id.
echo   OLLAMA_NETWORK_WORKER_TOKEN  Long-lived worker token.
echo.
echo If the variables are not set, the script will prompt for the missing values.
exit /b 0
