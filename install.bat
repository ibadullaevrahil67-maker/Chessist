@echo off
setlocal EnableDelayedExpansion
title Chessist - Build ^& Install

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
echo  [3/4] Building the app (renderer)...
call npm run build
if errorlevel 1 ( echo  ERROR: app build failed. & pause & exit /b 1 )

echo.
echo  [4/4] Creating a Desktop shortcut...
set "ELECTRON=%ROOT%\node_modules\electron\dist\electron.exe"
if not exist "%ELECTRON%" (
    echo  Electron runtime not found at:
    echo    %ELECTRON%
    echo  Skipping shortcut. You can still run:  npm run dev
    goto :done
)
powershell -NoProfile -Command ^
    "$root='%ROOT%';" ^
    "$el=Join-Path $root 'node_modules\electron\dist\electron.exe';" ^
    "$d=[Environment]::GetFolderPath('Desktop');" ^
    "$w=New-Object -ComObject WScript.Shell;" ^
    "$s=$w.CreateShortcut((Join-Path $d 'Chessist.lnk'));" ^
    "$q=[char]34;" ^
    "$s.TargetPath=$el;" ^
    "$s.Arguments=$q+$root+$q+' --prod';" ^
    "$s.WorkingDirectory=$root;" ^
    "$s.IconLocation=$el;" ^
    "$s.Save()"
if errorlevel 1 ( echo  Could not create the shortcut. ) else ( echo  Shortcut "Chessist" added to your Desktop. )

:done
echo.
echo  ============================================
echo    Done.
echo  ============================================
echo.
echo  1. Launch Chessist from the Desktop shortcut.
echo     (Keep this folder where it is - the app runs from here.)
echo  2. In the app, open the Setup tab and follow the
echo     "Browser extension" card to load the extension.
echo  3. Open a game on chess.com or lichess.org.
echo.
endlocal
pause
