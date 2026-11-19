@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist "data\update-in-progress" (
  echo [ERROR] Unfinished update detected. Startup rejected.
  echo Please run update.cmd to restore or complete update first.
  pause
  exit /b 1
)

set "ENV_FILE_PATH=%~dp0app\.env\.env.production.electron"
set "DEBUG=@lsby:*,@lsby:deepseek-desktop:*"
start /wait "" "app\lsby-deepseek-desktop.exe"
if errorlevel 1 (
  echo.
  echo [ERROR] Application exited with error code: %errorlevel%
  pause
)
