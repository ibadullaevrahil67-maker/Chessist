@echo off
setlocal EnableDelayedExpansion
title Chessist Setup

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "EXE=%ROOT%\engine\bin\Release\net48\ChessistEngine.exe"
set "HOST_DIR=%ROOT%\host"
set "MANIFEST=%HOST_DIR%\com.chessist.engine.json"

echo.
echo  === Chessist Setup ===
echo.

:: ── Write native-messaging manifest ───────────────────────────────────────────
(
echo {
echo   "name": "com.chessist.engine",
echo   "description": "Chessist - Engine Launcher",
echo   "path": "%EXE:\=\\%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://oecfgiflfobnbajnpanbpjnnkgdhiifb/"
echo   ]
echo }
) > "!MANIFEST!"

:: ── Register for Chrome, Brave, Edge ──────────────────────────────────────────
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chessist.engine"             /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.chessist.engine" /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.chessist.engine"             /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1

:: ── Clean up old native host registration (com.chess.live.eval) ───────────────
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chess.live.eval"             /f >nul 2>&1
reg delete "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.chess.live.eval" /f >nul 2>&1

:: ── Optional: add engine to Windows startup ───────────────────────────────────
if /i "%1"=="--startup" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ChessistEngine" /t REG_SZ /d "\"!EXE!\"" /f >nul 2>&1
    echo  Added ChessistEngine to Windows startup.
)

echo  Registered native host for Chrome, Brave, and Edge.
echo.
echo  Done. Reload the extension in chrome://extensions and open a game.
echo.
endlocal
