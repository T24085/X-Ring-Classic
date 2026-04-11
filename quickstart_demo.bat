@echo off
setlocal

cd /d "%~dp0"
call "%~dp0start_network_server.bat" %*

