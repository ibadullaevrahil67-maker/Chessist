@echo off
setlocal EnableDelayedExpansion
title Chessist - Build ^& Install

:: ---- Self-elevate to Administrator ----
:: electron-builder extracts winCodeSign, which creates symlinks. A normal user
:: lacks SeCreateSymbolicLinkPrivilege, so the installer build fails ("a required
:: privilege is not held"). Admins have it, so we relaunch elevated (one UAC prompt).
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo  Requesting administrator rights ^(needed to build the installer^)...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo  ============================================
echo    Chessist - build ^& install
echo  ============================================
echo.

:: ---- Node.js (required) ----
where node >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js was not found.
    echo  Install Node 20+ from https://nodejs.org/ then run this again.
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  Node %%v found.

:: ---- .NET SDK (required to build the overlay helper) ----
where dotnet >nul 2>&1
if errorlevel 1 (
    echo  ERROR: .NET SDK was not found.
    echo  Install it from https://dotnet.microsoft.com/download then run this again.
    echo  ^(Needed to build the transparent overlay helper.^)
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('dotnet --version') do echo  .NET SDK %%v found.

echo.
echo  [1/4] Installing dependencies (npm install)...
call npm install
if errorlevel 1 ( echo  ERROR: npm install failed. & pause & exit /b 1 )

echo.
echo  [2/4] Building the overlay helper...
call npm run build:overlay
if errorlevel 1 ( echo  ERROR: overlay build failed. & pause & exit /b 1 )

echo.
echo  [3/4] Building the installer (npm run dist)...
call npm run dist
if errorlevel 1 (
    echo.
    echo  Installer build failed - falling back to a portable shortcut.
    goto :fallback
)

echo.
echo  [4/4] Launching the installer...
set "SETUP="
for /f "delims=" %%f in ('dir /b /o-d "%ROOT%\release\Chessist Setup *.exe" 2^>nul') do (
    if not defined SETUP set "SETUP=%ROOT%\release\%%f"
)
if not defined SETUP (
    echo  Could not find the built installer in the release\ folder.
    echo  Falling back to a portable shortcut.
    goto :fallback
)
echo  Running: !SETUP!
start "" "!SETUP!"

echo.
echo  ============================================
echo    Done - the installer is running.
echo  ============================================
echo.
echo  1. Finish the installer; Chessist installs and launches automatically.
echo  2. In the app, open the Setup tab and follow the
echo     "Browser extension" card to load the extension.
echo  3. Open a game on chess.com or lichess.org.
echo.
endlocal
pause
exit /b 0

:: ---- Fallback: no installer, run from this folder via a shortcut ----
:fallback
echo.
echo  Building the app (renderer)...
call npm run build
if errorlevel 1 ( echo  ERROR: app build failed. & pause & exit /b 1 )

echo  Creating the Chessist shortcut...
set "ELECTRON=%ROOT%\node_modules\electron\dist\electron.exe"
if not exist "%ELECTRON%" (
    echo  Electron runtime not found at:
    echo    %ELECTRON%
    echo  Skipping shortcut. You can still run:  npm run dev
    goto :fallbackdone
)
powershell -NoProfile -Command ^
    "$root='%ROOT%';" ^
    "$el=Join-Path $root 'node_modules\electron\dist\electron.exe';" ^
    "$ico=Join-Path $root 'build\icon.ico';" ^
    "$w=New-Object -ComObject WScript.Shell;" ^
    "$s=$w.CreateShortcut((Join-Path $root 'Chessist.lnk'));" ^
    "$q=[char]34;" ^
    "$s.TargetPath=$el;" ^
    "$s.Arguments=$q+$root+$q+' --prod';" ^
    "$s.WorkingDirectory=$root;" ^
    "$s.IconLocation= if (Test-Path $ico) { $ico } else { $el };" ^
    "$s.Save()"
if errorlevel 1 ( echo  Could not create the shortcut. ) else ( echo  "Chessist" shortcut created in this folder. )

:fallbackdone
echo.
echo  ============================================
echo    Done (portable).
echo  ============================================
echo.
echo  1. Launch Chessist from the "Chessist" shortcut in this folder.
echo     (Keep this folder where it is - the app runs from here.)
echo  2. In the app, open the Setup tab and follow the
echo     "Browser extension" card to load the extension.
echo  3. Open a game on chess.com or lichess.org.
echo.
endlocal
pause
exit /b 0
