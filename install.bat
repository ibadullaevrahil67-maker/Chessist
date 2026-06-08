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
    echo  ^(Needed to build the transparent overlay; the app build also requires it.^)
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
echo  [3/4] Building the Chessist app...
call npm run pack
if errorlevel 1 ( echo  ERROR: app build failed. & pause & exit /b 1 )

echo.
echo  [4/4] Creating a Desktop shortcut...
set "APPEXE=%ROOT%\release\win-unpacked\Chessist.exe"
if not exist "%APPEXE%" (
    echo  Built app not found at:
    echo    %APPEXE%
    echo  Check the release\ folder. Skipping shortcut.
    goto :done
)
powershell -NoProfile -Command ^
    "$d=[Environment]::GetFolderPath('Desktop');" ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'Chessist.lnk'));" ^
    "$s.TargetPath='%APPEXE%';" ^
    "$s.WorkingDirectory=[System.IO.Path]::GetDirectoryName('%APPEXE%');" ^
    "$s.IconLocation='%APPEXE%,0';" ^
    "$s.Save()"
if errorlevel 1 ( echo  Could not create the shortcut, but the app is built at %APPEXE%. ) else ( echo  Shortcut "Chessist" added to your Desktop. )

:done
echo.
echo  ============================================
echo    Done.
echo  ============================================
echo.
echo  1. Launch Chessist from the Desktop shortcut
echo     (or run release\win-unpacked\Chessist.exe).
echo  2. In the app, open the Setup tab and follow the
echo     "Browser extension" card to load the extension.
echo  3. Open a game on chess.com or lichess.org.
echo.
endlocal
pause
