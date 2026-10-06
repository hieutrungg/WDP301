@echo off
setlocal
cd /d "%~dp0"

where mongosh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] mongosh was not found in PATH.
  echo Install MongoDB Shell or add mongosh.exe to PATH.
  pause
  exit /b 1
)

echo Creating EMPTY cinema_management database...
mongosh --file "%CD%\create_empty_db.js"
if errorlevel 1 (
  echo [ERROR] Failed to create collections/validators.
  pause
  exit /b 1
)

echo Creating indexes...
mongosh --file "%CD%\create_indexes.js"
if errorlevel 1 (
  echo [ERROR] Failed to create indexes.
  pause
  exit /b 1
)

echo.
echo [OK] Empty database is ready. No seed documents were inserted.
pause
