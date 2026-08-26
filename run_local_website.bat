@echo off
setlocal

cd /d "%~dp0client"

rem Keep the preview local and avoid the empty host allow-list issue in the
rem legacy React development server used by this project.
set "HOST=localhost"
set "BROWSER=none"
set "DANGEROUSLY_DISABLE_HOST_CHECK=true"

if not exist "node_modules\.bin\react-scripts.cmd" (
  echo Frontend dependencies are missing. Installing them now...
  call npm ci
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting The X-Ring Classic frontend...
start "The X-Ring Classic - Development Server" cmd /k "npm start"

echo Waiting for the development server to start...
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000/X-Ring-Classic/"

endlocal
