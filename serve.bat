@echo off
setlocal
set PORT=8741
set "EDITOR_DIR=D:\_Proj_src\Sandscape\Games\three.js_Editor"
title Startup Panic - Local Server

cd /d "%~dp0"

REM --- Find a working Python command (prefer the py launcher, else plain python) ---
set "PYCMD=py -3"
py -3 --version >nul 2>nul
if errorlevel 1 set "PYCMD=python"

echo.
echo  Startup Panic ^(Tycoon^) - local server
echo  =========================================
echo  ^(using "%PYCMD%"^)
echo.

REM --- Free the game port if a previous server is still running on it ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo  Port %PORT% was busy - stopping old server ^(PID %%a^)...
  taskkill /f /pid %%a >nul 2>nul
)

if not exist "%EDITOR_DIR%" (
  echo  ^(Editor folder not found at "%EDITOR_DIR%" - the /editor/ link will 404^)
  echo.
)

echo  Game            : http://localhost:%PORT%/
echo  Three.js Editor : http://localhost:%PORT%/editor/
echo.
echo  ---------------------------------------------------------------
echo   DYNAMIC LEVEL LINK  ^(edit the office layout live, ONE port^)
echo   The game AND the editor share this port, so the editor can
echo   save/import the level directly ^(same origin, no CORS^).
echo   1^) Open the editor : http://localhost:%PORT%/editor/
echo   2^) Arrange the office / drop in GLB assets.
echo   3^) File ^> Save Level  ^(writes level.json here:^)
echo        %~dp0level.json
echo   4^) The running game reloads the new layout within ~3 seconds.
echo      File ^> Import Level reloads it back into the editor.
echo  ---------------------------------------------------------------
echo.
echo  Keep this window open while playing. Press Ctrl+C to stop.
echo.

set PORT=%PORT%
set "EDITOR_DIR=%EDITOR_DIR%"
%PYCMD% serve.py

echo.
echo  ------------------------------------------------------------
echo  Server stopped.
echo  ------------------------------------------------------------
pause
endlocal
