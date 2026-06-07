# Lean Repo + BootstrapGate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove binaries from git, download from GitHub Releases at install time, add self-healing Stockfish download to ChessistEngine.exe, add BootstrapGate React UI with Eldritch theme + Chessist purple.

**Architecture:** setup.bat fetches ChessistEngine.exe + UI from a tagged GitHub Release; ChessistEngine.exe auto-downloads stockfish.exe if missing; React panel shows a BootstrapGate checklist then live eval; theme matches Eldritch's flat pitch-black style with `#792A9E` purple accent.

**Tech Stack:** PowerShell (setup), GitHub Actions (CI), C# .NET 4.8 + HttpClient + ZipFile (auto-download), React 18 + TypeScript + Vite (UI), CSS variables.

**Extension ID:** `oecfgiflfobnbajnpanbpjnnkgdhiifb`  
**Chessist purple:** `#792A9E`

---

## Task 1: Remove binaries from git + update .gitignore

**Files:**
- Modify: `.gitignore`
- Delete from tracking: `engine/bin/Release/net48/ChessistEngine.exe`, `engine/bin/Release/net48/ChessistEngine.exe.config`, `engine/bin/Release/net48/stockfish.exe`, `engine/bin/Release/net48/ui/`

- [ ] **Step 1: Update .gitignore**

Replace `.gitignore` content with:
```
engine/bin/
engine/obj/
ui/node_modules/
native-host/__pycache__/
*.log
*.pdb
*.ini
```

- [ ] **Step 2: Untrack compiled output**

```powershell
cd "c:\Users\luri\Documents\Programming\Chessist"
git rm --cached "engine/bin/Release/net48/ChessistEngine.exe"
git rm --cached "engine/bin/Release/net48/ChessistEngine.exe.config"
git rm --cached "engine/bin/Release/net48/stockfish.exe"
git rm -r --cached "engine/bin/Release/net48/ui"
```

Note: the files remain on disk — only git stops tracking them.

- [ ] **Step 3: Verify files are still on disk**

```powershell
Test-Path "engine/bin/Release/net48/ChessistEngine.exe"
Test-Path "engine/bin/Release/net48/stockfish.exe"
Test-Path "engine/bin/Release/net48/ui/index.html"
```

All should return `True`.

- [ ] **Step 4: Commit**

```powershell
git add .gitignore
git commit -m "chore: remove compiled binaries from git tracking"
```

---

## Task 2: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create .github/workflows/release.yml**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.x'

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build ChessistEngine
        run: dotnet build engine/ChessistEngine.csproj -c Release

      - name: Build React UI
        working-directory: ui
        run: |
          npm ci
          npm run build

      - name: Package release zip
        shell: pwsh
        run: |
          $src = "engine/bin/Release/net48"
          $zip = "chessist-engine-windows.zip"
          $items = @(
            "$src/ChessistEngine.exe",
            "$src/ChessistEngine.exe.config",
            "$src/ui"
          )
          Compress-Archive -Path $items -DestinationPath $zip -Force
          Write-Host "Created $zip"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: chessist-engine-windows.zip
          generate_release_notes: true
```

- [ ] **Step 2: Commit**

```powershell
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow"
```

---

## Task 3: Rewrite setup.bat — download from GitHub releases

**Files:**
- Modify: `setup.bat`

- [ ] **Step 1: Replace setup.bat entirely**

```bat
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

:: ── Create output directory ────────────────────────────────────────────────────
if not exist "%BIN%" mkdir "%BIN%"

:: ── Download ChessistEngine if missing ────────────────────────────────────────
if not exist "%EXE%" (
    echo  Downloading ChessistEngine...
    powershell -NoProfile -Command ^
        "$r = Invoke-RestMethod 'https://api.github.com/repos/imluri/Chessist/releases/latest';" ^
        "$a = $r.assets | Where-Object { $_.name -eq 'chessist-engine-windows.zip' };" ^
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

:: ── Download Stockfish if missing ─────────────────────────────────────────────
if not exist "%SF%" (
    echo  Downloading Stockfish...
    powershell -NoProfile -Command ^
        "$r = Invoke-RestMethod 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest';" ^
        "$a = $r.assets | Where-Object { $_.name -like '*windows*x86-64*avx2*' } | Select-Object -First 1;" ^
        "if (-not $a) { $a = $r.assets | Where-Object { $_.name -like '*windows*' -and $_.name -like '*.zip' } | Select-Object -First 1 }" ^
        "if (-not $a) { Write-Error 'Stockfish asset not found'; exit 1 }" ^
        "$t = [System.IO.Path]::GetTempFileName() + '.zip';" ^
        "Invoke-WebRequest $a.browser_download_url -OutFile $t;" ^
        "$tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'sf_' + [System.IO.Path]::GetRandomFileName());" ^
        "Expand-Archive $t -DestinationPath $tmp -Force;" ^
        "$sf = Get-ChildItem $tmp -Filter '*.exe' -Recurse | Select-Object -First 1;" ^
        "Copy-Item $sf.FullName '%SF%' -Force;" ^
        "Remove-Item $t,$tmp -Recurse -Force"
    if errorlevel 1 ( echo  ERROR: Failed to download Stockfish. & pause & exit /b 1 )
    echo  Stockfish downloaded.
) else (
    echo  Stockfish already present, skipping download.
)

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
```

- [ ] **Step 2: Commit**

```powershell
git add setup.bat
git commit -m "feat: setup.bat downloads ChessistEngine and Stockfish from GitHub releases"
```

---

## Task 4: C# — StockfishManager auto-download + extension detection + bootstrap_status

**Files:**
- Modify: `engine/Program.cs`

This task has three parts: auto-download Stockfish, track extension clients, broadcast bootstrap_status.

### Part A: Add Stockfish auto-download to StockfishManager

- [ ] **Step 1: Add `DownloadStockfishAsync` method to StockfishManager**

After the `FindStockfish()` method, insert:

```csharp
        async Task<string?> DownloadStockfishAsync()
        {
            try
            {
                SendStatus("downloading", "Stockfish: connecting...");
                var exeDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location)!;
                var destPath = Path.Combine(exeDir, "stockfish.exe");

                using var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("User-Agent", "ChessistEngine/1.0");

                // Fetch latest Stockfish release metadata
                var json = await http.GetStringAsync(
                    "https://api.github.com/repos/official-stockfish/Stockfish/releases/latest");

                // Extract download URL — prefer avx2 Windows build, fall back to any Windows zip
                var urlMatch = System.Text.RegularExpressions.Regex.Matches(json,
                    @"""browser_download_url""\s*:\s*""([^""]+\.zip)""")
                    .Cast<System.Text.RegularExpressions.Match>()
                    .Select(m => m.Groups[1].Value)
                    .OrderByDescending(u => u.Contains("avx2") ? 2 : u.Contains("windows") ? 1 : 0)
                    .FirstOrDefault(u => u.Contains("windows") || u.Contains("Windows"));

                if (urlMatch == null)
                {
                    SendStatus("error", "Stockfish: no Windows asset found in release");
                    return null;
                }

                // Download zip with progress
                SendStatus("downloading", "Stockfish: downloading...");
                var tmpZip = Path.Combine(Path.GetTempPath(), "stockfish_dl.zip");
                using (var resp = await http.GetAsync(urlMatch, System.Net.Http.HttpCompletionOption.ResponseHeadersRead))
                {
                    resp.EnsureSuccessStatusCode();
                    long? total = resp.Content.Headers.ContentLength;
                    using var src = await resp.Content.ReadAsStreamAsync();
                    using var dst = new FileStream(tmpZip, FileMode.Create, FileAccess.Write, FileShare.None);
                    var buf = new byte[81920];
                    long downloaded = 0;
                    int lastPct = -1;
                    int n;
                    while ((n = await src.ReadAsync(buf, 0, buf.Length)) > 0)
                    {
                        await dst.WriteAsync(buf, 0, n);
                        downloaded += n;
                        if (total > 0)
                        {
                            int pct = (int)(downloaded * 100 / total.Value);
                            if (pct != lastPct && pct % 5 == 0)
                            {
                                lastPct = pct;
                                SendStatus("downloading", $"Stockfish: {pct}%");
                            }
                        }
                    }
                }

                // Extract and find the exe
                var tmpDir = Path.Combine(Path.GetTempPath(), "stockfish_extracted");
                if (Directory.Exists(tmpDir)) Directory.Delete(tmpDir, true);
                System.IO.Compression.ZipFile.ExtractToDirectory(tmpZip, tmpDir);

                var sfExe = Directory.EnumerateFiles(tmpDir, "*.exe", SearchOption.AllDirectories)
                    .FirstOrDefault(f => Path.GetFileName(f).StartsWith("stockfish", StringComparison.OrdinalIgnoreCase));

                if (sfExe == null)
                {
                    SendStatus("error", "Stockfish: exe not found in downloaded zip");
                    return null;
                }

                File.Copy(sfExe, destPath, overwrite: true);

                // Cleanup
                try { File.Delete(tmpZip); Directory.Delete(tmpDir, true); } catch { }

                SendStatus("ready", "Stockfish ready");
                DebugLog.Write($"StockfishManager: downloaded stockfish to {destPath}");
                return destPath;
            }
            catch (Exception ex)
            {
                SendStatus("error", $"Stockfish download failed: {ex.Message}");
                DebugLog.Write($"StockfishManager: download error: {ex.Message}");
                return null;
            }
        }
```

- [ ] **Step 2: Update TryStart() to call DownloadStockfishAsync when stockfish not found**

Find the `TryStart()` method. After `string? path = FindStockfish();` and the check `if (path == null)`, replace the existing error-and-return block with:

```csharp
            string? path = FindStockfish();
            if (path == null)
            {
                DebugLog.Write("StockfishManager: stockfish.exe not found — attempting download");
                path = DownloadStockfishAsync().GetAwaiter().GetResult();
                if (path == null) return false;
            }
```

- [ ] **Step 3: Add required using directive at top of file**

Check if `using System.Net.Http;` is already present. If not, add it near the other `using` directives at the top of `Program.cs`.

Also add `using System.IO.Compression;` if not already present.

### Part B: Track extension clients + broadcast bootstrap_status

- [ ] **Step 4: Add extension-tracking to WsServer**

Add field to `WsServer`:
```csharp
int _extensionClientCount = 0;
readonly object _extLock = new();
```

In `HandleAsync`, when a message comes in with `msg.Type == "identify"` and the message JSON contains `"extension"`, increment the counter and broadcast bootstrap status:

Add this case to the `switch (msg.Type)` block:

```csharp
                        case "identify":
                            if (json.Contains("\"extension\""))
                            {
                                lock (_extLock) _extensionClientCount++;
                                _ = Task.Run(() => _sfManager.BroadcastBootstrapStatus(
                                    BroadcastAsync, _extensionClientCount > 0));
                            }
                            break;
```

When the client disconnects, decrement if it was an extension client. Track per-client in the finally block:

Replace the `lock (_clientsLock) _clients.RemoveAll(c => c.ws == ws);` line in the `finally` block with:
```csharp
                lock (_clientsLock) _clients.RemoveAll(c => c.ws == ws);
                // Extension disconnect tracked in identify handler (simplification: count on first connect only)
```

- [ ] **Step 5: Add BroadcastBootstrapStatus to StockfishManager**

Add this method to `StockfishManager`:

```csharp
        public void BroadcastBootstrapStatus(Func<string, Task>? broadcast, bool extensionConnected)
        {
            if (broadcast == null) return;
            bool sfOk = _running && _sf != null && !_sf.HasExited;
            var msg = $"{{\"type\":\"bootstrap_status\",\"stockfishOk\":{sfOk.ToString().ToLower()},\"extensionConnected\":{extensionConnected.ToString().ToLower()}}}";
            _ = broadcast(msg);
        }
```

Also broadcast bootstrap status after Stockfish starts successfully in `TryStart()`. At the end of the successful startup path, call:
```csharp
BroadcastBootstrapStatus(BroadcastAsync, false); // extension status updated separately
```

### Part C: Build

- [ ] **Step 6: Build and verify**

```powershell
dotnet build engine/ChessistEngine.csproj -c Release
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```powershell
git add engine/Program.cs
git commit -m "feat: StockfishManager auto-download + extension detection + bootstrap_status"
```

---

## Task 5: content.js + lichess.js — send identify message on WS open

**Files:**
- Modify: `src/content/content.js`
- Modify: `src/content/lichess.js`

- [ ] **Step 1: Add identify message to content.js**

In `_connectEngineWs()` → `_overlayWs.onopen`, add as the FIRST line (before everything else):

```javascript
        _overlayWs.send(JSON.stringify({ type: 'identify', role: 'extension' }));
```

- [ ] **Step 2: Same change in lichess.js**

Apply the same addition to `_overlayWs.onopen` in `lichess.js`.

- [ ] **Step 3: Commit**

```powershell
git add src/content/content.js src/content/lichess.js
git commit -m "feat: content scripts send identify on WS connect for extension detection"
```

---

## Task 6: React UI — Eldritch theme + BootstrapGate + EvalPanel

**Files:**
- Create: `ui/src/styles/theme.css`
- Create: `ui/src/components/BootstrapGate.tsx`
- Create: `ui/src/components/EvalPanel.tsx`
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/App.css`
- Modify: `ui/src/main.tsx`

### Step 1: Create ui/src/styles/theme.css

- [ ] Create `ui/src/styles/theme.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

:root {
  --bg: #000000;
  --surface: #111111;
  --surface-hover: #1a1a1a;
  --border: #1f1f1f;
  --fg: #ffffff;
  --fg-muted: #969696;
  --fg-dim: #787878;
  --accent: #792A9E;
  --accent-rgb: 121, 42, 158;
  --accent-glow: 0 0 8px rgba(121, 42, 158, 0.55);
  --status-green: #22c55e;
  --status-yellow: #eab308;
  --status-red: #ef4444;
}
```

### Step 2: Create ui/src/components/BootstrapGate.tsx

- [ ] Create the file:

```tsx
interface BootstrapStatus {
  stockfishOk: boolean
  stockfishDownloading?: boolean
  stockfishProgress?: number
  extensionConnected: boolean
  statusMessage?: string
}

interface Props {
  wsConnected: boolean
  bootstrap: BootstrapStatus
}

function Step({ label, status, detail }: {
  label: string
  status: 'ok' | 'working' | 'waiting' | 'error'
  detail?: string
}) {
  const colors = {
    ok:      'var(--status-green)',
    working: 'var(--status-yellow)',
    waiting: 'var(--fg-dim)',
    error:   'var(--status-red)',
  }
  const labels = { ok: 'ok', working: detail || 'working', waiting: 'waiting', error: 'error' }
  const color = colors[status]
  const glow = status === 'ok'
    ? `0 0 6px rgba(34,197,94,0.7)`
    : status === 'working'
    ? `0 0 6px rgba(234,179,8,0.7)`
    : 'none'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, boxShadow: glow, flexShrink: 0,
      }} />
      <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontFamily: 'monospace' }}>{labels[status]}</span>
    </div>
  )
}

export default function BootstrapGate({ wsConnected, bootstrap }: Props) {
  const sfStatus = !wsConnected
    ? 'waiting'
    : bootstrap.stockfishOk
    ? 'ok'
    : 'working'

  const sfDetail = bootstrap.statusMessage?.startsWith('Stockfish:')
    ? bootstrap.statusMessage.replace('Stockfish: ', '')
    : undefined

  const extStatus = bootstrap.extensionConnected ? 'ok' : 'waiting'

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        paddingBottom: 12, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: wsConnected ? 'var(--accent)' : 'var(--fg-dim)',
          boxShadow: wsConnected ? 'var(--accent-glow)' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: 'var(--fg)' }}>
          SETUP
        </span>
      </div>

      <Step label="Engine running" status={wsConnected ? 'ok' : 'waiting'} />
      <Step label="Stockfish" status={sfStatus} detail={sfDetail} />
      <Step label="Extension" status={extStatus} />

      {!bootstrap.extensionConnected && wsConnected && (
        <div style={{
          marginTop: 16, padding: '10px 12px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6,
        }}>
          Load Chessist in <span style={{ color: 'var(--fg)', fontFamily: 'monospace' }}>chrome://extensions</span>
          {' '}then open a game on chess.com or lichess.org.
        </div>
      )}
    </div>
  )
}
```

### Step 3: Create ui/src/components/EvalPanel.tsx

- [ ] Create the file:

```tsx
interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
}

function formatScore(data: EvalData): string {
  if (data.mate !== undefined) return `M${data.mate}`
  if (data.cp !== undefined) {
    const p = data.cp / 100
    return (p >= 0 ? '+' : '') + p.toFixed(2)
  }
  return '—'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace', color: 'var(--fg)' }}>
        {value}
      </div>
    </div>
  )
}

export default function EvalPanel({ evalData }: { evalData: EvalData }) {
  const cp = evalData.cp
  const mate = evalData.mate
  let fillPct = 50
  if (mate !== undefined) fillPct = mate > 0 ? 95 : 5
  else if (cp !== undefined) fillPct = 50 + Math.max(-45, Math.min(45, cp / 50))

  return (
    <div>
      {/* Eval bar */}
      <div style={{
        margin: '0 0 1px 0',
        height: 6,
        background: 'var(--surface)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${fillPct}%`,
          background: 'var(--accent)',
          boxShadow: 'var(--accent-glow)',
          transition: 'width 0.25s ease',
        }} />
      </div>

      {/* Score display */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: 'var(--fg)',
        }}>
          {formatScore(evalData)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'monospace' }}>
          depth {evalData.depth}
        </span>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderLeft: '1px solid var(--border)',
        borderTop: '1px solid var(--border)',
      }}>
        <Stat label="Best Move" value={evalData.bestMove ?? '—'} />
        <Stat label="Depth"     value={String(evalData.depth)} />
        <Stat label="Score"     value={formatScore(evalData)} />
        <Stat label="kNPS"      value={evalData.nps ? String(Math.round(evalData.nps / 1000)) : '—'} />
      </div>
    </div>
  )
}
```

### Step 4: Rewrite ui/src/App.tsx

- [ ] Replace `ui/src/App.tsx` with:

```tsx
import { useEffect, useState, useRef } from 'react'
import BootstrapGate from './components/BootstrapGate'
import EvalPanel from './components/EvalPanel'

interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
}

interface BootstrapStatus {
  stockfishOk: boolean
  extensionConnected: boolean
  statusMessage?: string
}

type ConnStatus = 'connecting' | 'connected' | 'error'

export default function App() {
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting')
  const [statusMsg, setStatusMsg]   = useState<string>('')
  const [bootstrap, setBootstrap]   = useState<BootstrapStatus>({
    stockfishOk: false, extensionConnected: false,
  })
  const [evalData, setEvalData]     = useState<EvalData | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const reconnRef  = useRef(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:27301')
      wsRef.current = ws

      ws.onopen = () => {
        setConnStatus('connected')
        reconnRef.current = 0
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'eval' && msg.data) {
            setEvalData(msg.data)
          } else if (msg.type === 'engine_status') {
            setStatusMsg(msg.message ?? '')
            if (msg.status === 'error') setConnStatus('error')
            // Update bootstrap stockfish status from engine_status
            if (msg.status === 'ready') {
              setBootstrap(b => ({ ...b, stockfishOk: true }))
            }
          } else if (msg.type === 'bootstrap_status') {
            setBootstrap({
              stockfishOk: !!msg.stockfishOk,
              extensionConnected: !!msg.extensionConnected,
              statusMessage: statusMsg,
            })
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => {
        setConnStatus('connecting')
        setBootstrap({ stockfishOk: false, extensionConnected: false })
        const delay = Math.min(3000, 500 * Math.pow(2, reconnRef.current))
        reconnRef.current++
        setTimeout(connect, delay)
      }
      ws.onerror = () => {}
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  const wsConnected = connStatus === 'connected'
  const bootstrapDone = bootstrap.stockfishOk && bootstrap.extensionConnected
  const statusLabel = { connecting: 'Connecting…', connected: evalData ? 'Analyzing' : 'Ready', error: 'Error' }[connStatus]

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh', fontSize: 13 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: wsConnected ? 'var(--accent)' : 'var(--fg-dim)',
          boxShadow: wsConnected ? 'var(--accent-glow)' : 'none',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.08em', fontSize: 12 }}>CHESSIST</span>
        <span style={{ marginLeft: 'auto', color: 'var(--fg-muted)', fontSize: 11 }}>{statusLabel}</span>
      </div>

      {statusMsg && (
        <div style={{
          padding: '6px 16px', fontSize: 11,
          color: connStatus === 'error' ? 'var(--status-red)' : 'var(--fg-muted)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'monospace',
        }}>
          {statusMsg}
        </div>
      )}

      {!bootstrapDone ? (
        <BootstrapGate wsConnected={wsConnected} bootstrap={bootstrap} />
      ) : evalData ? (
        <EvalPanel evalData={evalData} />
      ) : (
        <div style={{ padding: 20, color: 'var(--fg-dim)', textAlign: 'center', fontSize: 12 }}>
          No position yet — open a game on chess.com or lichess.org
        </div>
      )}
    </div>
  )
}
```

### Step 5: Rewrite ui/src/App.css

- [ ] Replace `ui/src/App.css`:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Instrument Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

### Step 6: Update ui/src/main.tsx to import theme

- [ ] Update `ui/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/theme.css'
import './App.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### Step 7: Build and verify

- [ ] Build:

```powershell
cd "c:\Users\luri\Documents\Programming\Chessist\ui"
npm run build
cd ..
```

Expected: builds to `engine/bin/Release/net48/ui/`, 0 errors.

### Step 8: Commit

```powershell
git add ui/
git commit -m "feat: Eldritch theme + purple accent + BootstrapGate UI"
```

---

## Task 7: Rebuild ChessistEngine.exe with new Program.cs changes

- [ ] **Step 1: Build**

```powershell
dotnet build engine/ChessistEngine.csproj -c Release
```

Expected: 0 errors.

- [ ] **Step 2: Commit (no new files — exe is gitignored)**

No commit needed for the binary. The source was already committed in Task 4.

---

## Task 8: Final commit — updated docs

- [ ] **Step 1: Update CHANGELOG**

Add to top of `CHANGELOG.md`:

```markdown
## [1.3.2] — 2026-06-08

### Changed
- **Lean repo** — compiled binaries removed from git; repo is now ~4 MB
- **GitHub Actions CI** — tagged releases build and publish `chessist-engine-windows.zip`
- **setup.bat downloads binaries** — ChessistEngine.exe and Stockfish.exe fetched from GitHub releases on first run
- **Auto-download Stockfish** — ChessistEngine.exe auto-fetches Stockfish if missing, with WS progress broadcast
- **Extension detection** — engine detects when Chrome extension is connected
- **Eldritch theme** — React panel matches Eldritch's flat pitch-black aesthetic with Chessist purple (`#792A9E`) accent
- **BootstrapGate** — React panel shows setup checklist until engine + stockfish + extension are all ready
```

- [ ] **Step 2: Commit**

```powershell
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v1.3.2 lean repo + BootstrapGate"
```

---

## Self-Review

| Spec requirement | Task |
|---|---|
| Remove binaries from git | Task 1 |
| GitHub Actions CI | Task 2 |
| setup.bat downloads from GitHub | Task 3 |
| Auto-download Stockfish in exe | Task 4 |
| Extension detection via identify | Tasks 4, 5 |
| bootstrap_status WS broadcast | Task 4 |
| Identify message from content scripts | Task 5 |
| Eldritch theme + purple | Task 6 |
| BootstrapGate component | Task 6 |
| EvalPanel component | Task 6 |
| Updated App.tsx wiring | Task 6 |
| CHANGELOG | Task 8 |
