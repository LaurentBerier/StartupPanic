@echo off
setlocal
set PORT=8741
title AI Startup Panic - Local Server

cd /d "%~dp0"

echo.
echo  AI Startup Panic ^(Tycoon^) - local server
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

call npx -y http-server -p %PORT% -c-1

echo.
echo  ------------------------------------------------------------
echo  Server stopped. If it closed right away, read any error above
echo  ^(most common: Node.js missing, or the port is in use^).
echo  ------------------------------------------------------------
pause
endlocal
