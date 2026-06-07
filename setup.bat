@echo off
setlocal EnableDelayedExpansion
title Chessist Setup

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BIN=%ROOT%\engine\bin\Release\net48"
set "HOST_DIR=%ROOT%\host"
set "MANIFEST=%HOST_DIR%\com.chessist.engine.json"
set "EXE=%BIN%\ChessistEngine.exe"
set "SF=%BIN%\stockfish.exe"

echo.
echo  === Chessist Setup ===
echo.

:: -- Create output directory --
if not exist "%BIN%" mkdir "%BIN%"

:: -- Download ChessistEngine if missing --
if not exist "%EXE%" (
    echo  Downloading ChessistEngine...
    powershell -NoProfile -Command ^
        "$r = Invoke-RestMethod 'https://api.github.com/repos/imluri/Chessist/releases/latest';" ^
        "$a = $r.assets ^| Where-Object { $_.name -eq 'chessist-engine-windows.zip' };" ^
        "if (-not $a) { Write-Error 'Release asset not found'; exit 1 }" ^
        "$t = [System.IO.Path]::GetTempFileName() + '.zip';" ^
        "Invoke-WebRequest $a.browser_download_url -OutFile $t;" ^
        "Expand-Archive $t -DestinationPath '%BIN%' -Force;" ^
        "Remove-Item $t -Force"
    if errorlevel 1 ( echo  ERROR: Failed to download ChessistEngine. & pause & exit /b 1 )
    echo  ChessistEngine downloaded.
) else (
    echo  ChessistEngine already present, skipping download.
)

:: -- Download Stockfish if missing --
if not exist "%SF%" (
    echo  Downloading Stockfish...
    powershell -NoProfile -Command ^
        "$r = Invoke-RestMethod 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest';" ^
        "$a = $r.assets ^| Where-Object { $_.name -like '*windows*x86-64*avx2*' } ^| Select-Object -First 1;" ^
        "if (-not $a) { $a = $r.assets ^| Where-Object { $_.name -like '*windows*' -and $_.name -like '*.zip' } ^| Select-Object -First 1 }" ^
        "if (-not $a) { Write-Error 'Stockfish asset not found'; exit 1 }" ^
        "$t = [System.IO.Path]::GetTempFileName() + '.zip';" ^
        "Invoke-WebRequest $a.browser_download_url -OutFile $t;" ^
        "$tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'sf_' + [System.IO.Path]::GetRandomFileName());" ^
        "Expand-Archive $t -DestinationPath $tmp -Force;" ^
        "$sf = Get-ChildItem $tmp -Filter '*.exe' -Recurse ^| Select-Object -First 1;" ^
        "Copy-Item $sf.FullName '%SF%' -Force;" ^
        "Remove-Item $t,$tmp -Recurse -Force"
    if errorlevel 1 ( echo  ERROR: Failed to download Stockfish. & pause & exit /b 1 )
    echo  Stockfish downloaded.
) else (
    echo  Stockfish already present, skipping download.
)

:: -- Write native-messaging manifest --
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

:: -- Register for Chrome, Brave, Edge --
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chessist.engine"             /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.chessist.engine" /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.chessist.engine"             /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chess.live.eval"             /f >nul 2>&1
reg delete "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.chess.live.eval" /f >nul 2>&1

if /i "%1"=="--startup" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "ChessistEngine" /t REG_SZ /d "\"!EXE!\"" /f >nul 2>&1
    echo  Added to Windows startup.
)

echo.
echo  Registered native host for Chrome, Brave, and Edge.
echo  Done. Reload the extension in chrome://extensions and open a game.
echo.
endlocal
