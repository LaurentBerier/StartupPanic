@echo off
setlocal
set PORT=8741
title Startup Panic - Local Server

cd /d "%~dp0"

echo.
echo  Startup Panic ^(Tycoon^) - local server
echo  =========================================
echo.

REM --- Free the port if a previous server is still running on it ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo  Port %PORT% was busy - stopping old server ^(PID %%a^)...
  taskkill /f /pid %%a >nul 2>nul
)

echo.
echo  Open this link in your browser ^(Ctrl+Click^):
echo.
echo      http://localhost:%PORT%/
echo.
echo  Keep this window open while playing. Press Ctrl+C to stop.
echo.

set PORT=%PORT%
py -3 serve.py
if errorlevel 1 (
  echo.
  echo  Python launcher failed, trying python directly...
  python serve.py
)

echo.
echo  ------------------------------------------------------------
echo  Server stopped. If it closed right away, read any error above
echo  ^(most common: Node.js missing, or the port is in use^).
echo  ------------------------------------------------------------
pause
endlocal
