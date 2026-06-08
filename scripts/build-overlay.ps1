# Builds the C# overlay helper for local dev.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
dotnet build (Join-Path $root 'overlay/ChessistOverlay.csproj') -c Release
Write-Host "Overlay built: overlay/bin/Release/net48/ChessistOverlay.exe"
