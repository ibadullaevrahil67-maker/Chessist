@echo off
title Chessist - Rebuild
set "ROOT=%~dp0..\"
set "CS_EXE=%ROOT%engine\bin\Release\net48\ChessistEngine.exe"

echo Building engine...
dotnet build "%ROOT%engine\ChessistEngine.csproj" -c Release
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo Build succeeded.

tasklist /fi "imagename eq ChessistEngine.exe" 2>nul | find /i "ChessistEngine.exe" >nul
if not errorlevel 1 (
    echo Restarting engine...
    taskkill /f /im ChessistEngine.exe >nul 2>&1
    timeout /t 1 /nobreak >nul
    start "" "%CS_EXE%"
    echo Engine restarted.
) else (
    echo Engine is not running. Use start.bat to launch.
)

pause
