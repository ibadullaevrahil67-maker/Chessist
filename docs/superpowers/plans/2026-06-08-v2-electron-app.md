# Chessist v2 — Electron Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Chessist as a React+Vite+Electron desktop app that owns Stockfish and the WebSocket server, keeping the native C# overlay as a slim helper process driven over stdin; reorganize the repo and retire all C# engine / native-messaging code.

**Architecture:** Electron main process spawns `stockfish.exe` (Node child_process), runs a `ws` server the browser extension connects to, and spawns a slimmed `ChessistOverlay.exe` it feeds draw commands via stdin. The browser extension becomes a pure WS client. Repo splits into the Electron app (root), `extension/`, and the C# `overlay/` helper.

**Tech Stack:** Electron, React 18 + Vite, Node `ws` + `child_process` + `extract-zip`, C# .NET 4.8 WinForms (overlay only), electron-builder.

**Version target:** 2.0.0

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `package.json` | Electron app project (scripts, deps, electron-builder) |
| Create | `vite.config.js` | Renderer build, dev server :5173 |
| Create | `index.html` | Main-window entry |
| Create | `electron/main.js` | App entry; window; IPC; starts subsystems |
| Create | `electron/preload.js` | contextBridge API |
| Create | `electron/stockfish.js` | Locate/download Stockfish |
| Create | `electron/engine.js` | Stockfish child process + UCI parse |
| Create | `electron/wsserver.js` | ws://127.0.0.1:27301 extension bridge |
| Create | `electron/overlay.js` | Spawn ChessistOverlay.exe + stdin protocol |
| Create | `src/main.jsx`, `src/App.jsx` | Renderer root + layout |
| Create | `src/components/*` | BootstrapGate, EvalPanel, Settings, TitleBar |
| Create | `src/data/theme.js`, `src/styles/themes.css` | Theme (purple default) |
| Move | `engine/` → `overlay/` | C# overlay helper (then slimmed) |
| Move | root `manifest.json`,`src/`,`icons/` → `extension/` | Browser extension |
| Modify | `extension/manifest.json` | v2.0.0, drop nativeMessaging |
| Modify | `extension/background/service-worker.js` | Keep-alive + EXECUTE_MOVE only |
| Create | `scripts/build-overlay.ps1` | Dev build of the C# overlay |
| Modify | `.github/workflows/release.yml` | Build overlay + electron installer |
| Delete | `host/`, `setup.bat`, `ui/`, `Chessist.sln` (recreated for overlay), `ss1.png`, `ss2.png` | Obsolete |

---

## Phase 1 — Repo reorganization

### Task 1: Move browser extension into `extension/`

**Files:**
- Move: root `manifest.json`, `src/`, `icons/` → `extension/`

- [ ] **Step 1: Create extension/ and move files via git**

```powershell
cd "c:\Users\luri\Documents\Programming\Chessist"
New-Item -ItemType Directory -Force extension
git mv manifest.json extension/manifest.json
git mv src extension/src
git mv icons extension/icons
```

- [ ] **Step 2: Fix manifest paths**

Read `extension/manifest.json`. All paths inside are relative to the manifest, so `src/...` and `icons/...` still resolve correctly now that the manifest is in `extension/`. No path edits needed. Verify by reading the file.

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: move browser extension into extension/"
```

---

### Task 2: Move C# engine → `overlay/` and remove obsolete files

**Files:**
- Move: `engine/` → `overlay/`
- Delete: `host/`, `setup.bat`, `Chessist.sln`, `ss1.png`, `ss2.png`, old `scripts/`

- [ ] **Step 1: Move engine → overlay**

```powershell
cd "c:\Users\luri\Documents\Programming\Chessist"
git mv engine/Program.cs overlay/Program.cs
git mv engine/app.manifest overlay/app.manifest
git mv engine/ChessistEngine.csproj overlay/ChessistOverlay.csproj
```

(If `git mv` complains the target dir doesn't exist, create it first with `New-Item -ItemType Directory -Force overlay`.)

- [ ] **Step 2: Delete obsolete files**

```powershell
git rm -r host
git rm setup.bat
git rm Chessist.sln
git rm ss1.png ss2.png
git rm -r scripts 2>$null
```

(Skip any that error with "did not match".)

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore: move engine to overlay/, remove host/setup.bat/sln/screenshots"
```

---

### Task 3: Slim the C# overlay to overlay-only + stdin loop

**Files:**
- Modify: `overlay/ChessistOverlay.csproj`
- Modify: `overlay/Program.cs`

The current `Program.cs` (≈1470 lines) contains `OverlayForm`, `StockfishManager`, `TrayApp`, `SettingsForm`, `DebugLog`, `WsServer`, `HostBridge`, `Program.Main`, and the data contracts `EvalBarMsg`, `ArrowMsg`, `WsMsg`, `EvalData`, `EvalResponse`, `EngineStatusMsg`. We KEEP `OverlayForm`, `DebugLog`, `EvalBarMsg`, `ArrowMsg`, `WsMsg`. We DELETE `StockfishManager`, `TrayApp`, `SettingsForm`, `WsServer`, `HostBridge`, `EvalData`, `EvalResponse`, `EngineStatusMsg`. We REPLACE `Program.Main` with a stdin-driven loop.

- [ ] **Step 1: Read Program.cs and note class line ranges**

Read `overlay/Program.cs`. Confirm the class boundaries (approx): `EvalData` (~73), `EvalResponse` (~87), `EngineStatusMsg` (~93), `StockfishManager` (~551–955), `TrayApp` (~956–1006), `SettingsForm` (~1007–1080), `WsServer` (~1176–1343), `HostBridge` (~1344–1446), `Program` (~1447–end).

- [ ] **Step 2: Delete the engine/server/tray/host classes**

Delete these entire class blocks from `Program.cs`:
- `[DataContract] class EvalData { ... }`
- `[DataContract] class EvalResponse { ... }`
- `[DataContract] class EngineStatusMsg { ... }`
- `sealed class StockfishManager : IDisposable { ... }`
- `sealed class TrayApp : IDisposable { ... }`
- `sealed class SettingsForm : Form { ... }`
- `sealed class WsServer { ... }`
- `static class HostBridge { ... }`

Keep: `EvalBarMsg`, `ArrowMsg`, `WsMsg`, all the Win32 P/Invoke structs/delegates, `OverlayForm`, `DebugLog`.

- [ ] **Step 3: Replace Program.Main with a stdin loop**

Replace the entire `static class Program { ... }` with:

```csharp
    // ── Entry point ───────────────────────────────────────────────────────────────
    static class Program
    {
        static OverlayForm? _overlay;

        [STAThread]
        static void Main(string[] args)
        {
            bool debug = Array.Exists(args, a => a.Equals("-debug", StringComparison.OrdinalIgnoreCase));
            if (debug) DebugLog.Init();
            DebugLog.OpenLogFile();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            _overlay = new OverlayForm();

            // Background thread reads newline-delimited JSON draw commands from stdin.
            var reader = new Thread(StdinLoop) { IsBackground = true, Name = "StdinReader" };
            reader.Start();

            _overlay.Show();
            Application.Run();
        }

        static void StdinLoop()
        {
            var ser = new System.Runtime.Serialization.Json.DataContractJsonSerializer(typeof(WsMsg));
            string? line;
            var stdin = Console.In;
            while ((line = stdin.ReadLine()) != null)
            {
                if (line.Length == 0) continue;
                WsMsg msg;
                try
                {
                    using var ms = new MemoryStream(Encoding.UTF8.GetBytes(line));
                    msg = (WsMsg)ser.ReadObject(ms)!;
                }
                catch { continue; }

                if (msg.Type == "quit") { Application.Exit(); return; }

                var ov = _overlay;
                if (ov != null && !ov.IsDisposed)
                {
                    try { ov.BeginInvoke((Action)(() => ov.Apply(msg))); }
                    catch { /* form closing */ }
                }
            }
            // stdin closed (parent exited) → quit
            Application.Exit();
        }
    }
```

- [ ] **Step 4: Verify OverlayForm.Apply is public**

In `OverlayForm`, confirm `public void Apply(WsMsg msg)` exists and is public. It already is. No change.

- [ ] **Step 5: Update the csproj assembly name**

Edit `overlay/ChessistOverlay.csproj`: change `<AssemblyName>ChessistEngine</AssemblyName>` to `<AssemblyName>ChessistOverlay</AssemblyName>` and `<RootNamespace>ChessistEngine</RootNamespace>` to `<RootNamespace>ChessistOverlay</RootNamespace>`. Remove the `Microsoft.Web.WebView2` PackageReference and the `System.Net.Http`/`System.IO.Compression` references added earlier (no longer needed). Final csproj:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net48</TargetFramework>
    <AssemblyName>ChessistOverlay</AssemblyName>
    <RootNamespace>ChessistEngine</RootNamespace>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <Optimize>true</Optimize>
    <NoWarn>0649</NoWarn>
    <ApplicationManifest>app.manifest</ApplicationManifest>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="System.Windows.Forms" />
    <Reference Include="System.Drawing" />
    <Reference Include="System.Runtime.Serialization" />
  </ItemGroup>
</Project>
```

Note: keep `<RootNamespace>ChessistEngine</RootNamespace>` because the existing `namespace ChessistEngine` in Program.cs is unchanged — renaming the namespace would require editing every class. Only the assembly (output exe) name changes to `ChessistOverlay.exe`.

- [ ] **Step 6: Build**

```powershell
dotnet build overlay/ChessistOverlay.csproj -c Release
```

Expected: 0 errors, produces `overlay/bin/Release/net48/ChessistOverlay.exe`.

Fix any compile errors from dangling references to the deleted classes (e.g., if `OverlayForm` or `DebugLog` referenced a deleted type — they should not, but resolve any that appear).

- [ ] **Step 7: Smoke-test the stdin protocol**

```powershell
$p = Start-Process "overlay/bin/Release/net48/ChessistOverlay.exe" -PassThru
Start-Sleep -Milliseconds 800
$p.HasExited   # expect False (window pump running, waiting on stdin)
$p.Kill()
```

Expected: process stays alive. (Full draw verification happens in end-to-end testing.)

- [ ] **Step 8: Commit**

```powershell
git add overlay/Program.cs overlay/ChessistOverlay.csproj
git commit -m "feat: slim overlay to overlay-only C# helper driven via stdin"
```

---

## Phase 2 — Electron app skeleton

### Task 4: Scaffold Electron app (package.json, vite, main window)

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore` (update)
- Create: `electron/main.js`, `electron/preload.js`
- Create: `src/main.jsx`, `src/App.jsx`, `src/styles/themes.css`, `src/data/theme.js`, `src/index.css`
- Create: `public/.gitkeep`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "chessist",
  "version": "2.0.0",
  "private": true,
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently -k -n VITE,ELECTRON -c green,magenta \"vite\" \"wait-on tcp:5173 && electron .\"",
    "vite": "vite",
    "electron": "electron .",
    "build": "vite build",
    "dist": "vite build && electron-builder",
    "build:overlay": "powershell -ExecutionPolicy Bypass -File scripts/build-overlay.ps1",
    "test": "vitest run"
  },
  "dependencies": {
    "extract-zip": "^2.0.1",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.0",
    "electron": "^33.2.1",
    "electron-builder": "^25.1.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "vite": "^6.0.3",
    "vitest": "^2.1.8",
    "wait-on": "^8.0.1"
  },
  "build": {
    "appId": "dev.chessist.app",
    "productName": "Chessist",
    "files": ["dist/**/*", "electron/**/*", "package.json"],
    "extraResources": [
      { "from": "overlay/bin/Release/net48/ChessistOverlay.exe", "to": "overlay/ChessistOverlay.exe" }
    ],
    "win": { "target": "nsis" },
    "directories": { "output": "release" }
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chessist</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Update .gitignore**

Replace `.gitignore` with:
```
node_modules/
dist/
release/
overlay/bin/
overlay/obj/
*.log
*.pdb
*.ini
```

- [ ] **Step 5: Create electron/main.js**

```javascript
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 640,
    minWidth: 380,
    minHeight: 520,
    title: 'Chessist',
    backgroundColor: '#000000',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function registerIpc() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:close', () => mainWindow?.close())
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { getMainWindow: () => mainWindow }
```

- [ ] **Step 6: Create electron/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chessist', {
  isDesktop: true,
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onStatus: (cb) => {
    const h = (_e, payload) => cb(payload)
    ipcRenderer.on('status', h)
    return () => ipcRenderer.removeListener('status', h)
  },
  onEval: (cb) => {
    const h = (_e, payload) => cb(payload)
    ipcRenderer.on('eval', h)
    return () => ipcRenderer.removeListener('eval', h)
  },
})
```

- [ ] **Step 7: Create src/styles/themes.css**

```css
:root, [data-theme='purple'] {
  --bg: 0 0 0;
  --surface: 17 17 17;
  --border: 31 31 31;
  --fg: 255 255 255;
  --fg-muted: 150 150 150;
  --fg-dim: 120 120 120;
  --accent: 121 42 158;
  --status-green: 34 197 94;
  --status-yellow: 234 179 8;
  --status-red: 239 68 68;
}
```

- [ ] **Step 8: Create src/data/theme.js**

```javascript
export function applyTheme(name = 'purple') {
  document.documentElement.setAttribute('data-theme', name)
  document.documentElement.style.colorScheme = 'dark'
}
```

- [ ] **Step 9: Create src/index.css**

```css
@import './styles/themes.css';

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: rgb(var(--bg));
  color: rgb(var(--fg));
  font-family: 'Instrument Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
```

- [ ] **Step 10: Create src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { applyTheme } from './data/theme'
import App from './App'

applyTheme('purple')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 11: Create src/App.jsx (placeholder, expanded in Task 9)**

```jsx
export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 16, letterSpacing: '0.08em' }}>CHESSIST</h1>
      <p style={{ color: 'rgb(var(--fg-muted))', fontSize: 13, marginTop: 8 }}>
        Desktop app skeleton.
      </p>
    </div>
  )
}
```

- [ ] **Step 12: Install dependencies**

```powershell
npm install
```

- [ ] **Step 13: Verify the app launches**

```powershell
npm run dev
```

Expected: a Vite server starts on :5173 and an Electron window opens showing "CHESSIST". Close it (Ctrl+C in terminal). If it launches, the skeleton works.

- [ ] **Step 14: Commit**

```powershell
git add -A
git commit -m "feat: scaffold Electron + React + Vite desktop app skeleton"
```

---

## Phase 3 — Electron subsystems

### Task 5: electron/stockfish.js — locate + download

**Files:**
- Create: `electron/stockfish.js`
- Test: `electron/stockfish.test.js`

- [ ] **Step 1: Write the failing test for asset selection**

Create `electron/stockfish.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { pickWindowsAsset } from './stockfish.js'

describe('pickWindowsAsset', () => {
  it('prefers the avx2 windows build', () => {
    const assets = [
      { name: 'stockfish-ubuntu-x86-64-avx2.tar', browser_download_url: 'u' },
      { name: 'stockfish-windows-x86-64-sse41-popcnt.zip', browser_download_url: 'w-sse' },
      { name: 'stockfish-windows-x86-64-avx2.zip', browser_download_url: 'w-avx2' },
    ]
    expect(pickWindowsAsset(assets)).toBe('w-avx2')
  })

  it('falls back to any windows zip', () => {
    const assets = [
      { name: 'stockfish-windows-x86-64.zip', browser_download_url: 'w' },
      { name: 'stockfish-android.zip', browser_download_url: 'a' },
    ]
    expect(pickWindowsAsset(assets)).toBe('w')
  })

  it('returns null when no windows asset', () => {
    expect(pickWindowsAsset([{ name: 'stockfish-mac.tar', browser_download_url: 'm' }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

```powershell
npm test
```
Expected: FAIL (`pickWindowsAsset` not exported).

- [ ] **Step 3: Implement electron/stockfish.js**

```javascript
const fs = require('fs')
const path = require('path')
const https = require('https')
const os = require('os')
const extract = require('extract-zip')

const RELEASES_API = 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest'

function pickWindowsAsset(assets) {
  const win = assets.filter(a => /windows/i.test(a.name) && /\.zip$/i.test(a.name))
  if (win.length === 0) return null
  const avx2 = win.find(a => /avx2/i.test(a.name))
  return (avx2 || win[0]).browser_download_url
}

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Chessist/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsJson(res.headers.location))
      }
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Chessist/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, dest, onProgress))
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let got = 0
      const out = fs.createWriteStream(dest)
      res.on('data', d => {
        got += d.length
        if (total && onProgress) onProgress(Math.floor(got * 100 / total))
      })
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', reject)
    }).on('error', reject)
  })
}

// Resolve an existing stockfish path, or download one. userDataDir is app.getPath('userData').
async function ensureStockfish(userDataDir, onStatus) {
  const dest = path.join(userDataDir, 'stockfish.exe')
  if (fs.existsSync(dest)) return dest

  onStatus?.({ status: 'downloading', message: 'Stockfish: connecting...' })
  const release = await httpsJson(RELEASES_API)
  const url = pickWindowsAsset(release.assets || [])
  if (!url) { onStatus?.({ status: 'error', message: 'No Windows Stockfish asset' }); return null }

  const tmpZip = path.join(os.tmpdir(), 'stockfish_dl.zip')
  await download(url, tmpZip, pct => onStatus?.({ status: 'downloading', message: `Stockfish: ${pct}%` }))

  const tmpDir = path.join(os.tmpdir(), 'stockfish_extracted')
  fs.rmSync(tmpDir, { recursive: true, force: true })
  await extract(tmpZip, { dir: tmpDir })

  const exe = findExe(tmpDir)
  if (!exe) { onStatus?.({ status: 'error', message: 'Stockfish exe not found in zip' }); return null }
  fs.copyFileSync(exe, dest)
  fs.rmSync(tmpZip, { force: true })
  fs.rmSync(tmpDir, { recursive: true, force: true })

  onStatus?.({ status: 'ready', message: 'Stockfish ready' })
  return dest
}

function findExe(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { const r = findExe(full); if (r) return r }
    else if (/stockfish.*\.exe$/i.test(entry.name)) return full
  }
  return null
}

module.exports = { pickWindowsAsset, ensureStockfish }
```

- [ ] **Step 4: Run the test, expect pass**

```powershell
npm test
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```powershell
git add electron/stockfish.js electron/stockfish.test.js
git commit -m "feat: stockfish locate + download module"
```

---

### Task 6: electron/engine.js — Stockfish process + UCI parse

**Files:**
- Create: `electron/engine.js`
- Test: `electron/engine.test.js`

- [ ] **Step 1: Write the failing test for UCI parsing**

Create `electron/engine.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { parseInfoLine } from './engine.js'

describe('parseInfoLine', () => {
  it('parses cp score and pv', () => {
    const r = parseInfoLine('info depth 20 multipv 1 score cp 35 nps 1200000 pv e2e4 e7e5')
    expect(r).toEqual({ depth: 20, multipv: 1, cp: 35, nps: 1200000, pv: ['e2e4', 'e7e5'], bestMove: 'e2e4' })
  })

  it('parses mate score', () => {
    const r = parseInfoLine('info depth 12 multipv 1 score mate 3 pv d1h5 g8h6')
    expect(r.mate).toBe(3)
    expect(r.cp).toBeUndefined()
    expect(r.bestMove).toBe('d1h5')
  })

  it('returns null for non-score lines', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-xxxx.nnue')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, expect failure**

```powershell
npm test
```
Expected: FAIL (`parseInfoLine` not exported).

- [ ] **Step 3: Implement electron/engine.js**

```javascript
const { spawn } = require('child_process')

function parseInfoLine(line) {
  const out = {}
  const depth = line.match(/\bdepth (\d+)/);            if (depth) out.depth = +depth[1]
  const mpv = line.match(/\bmultipv (\d+)/);            if (mpv) out.multipv = +mpv[1]
  const mate = line.match(/\bscore mate (-?\d+)/)
  const cp = line.match(/\bscore cp (-?\d+)/)
  if (mate) out.mate = +mate[1]
  else if (cp) out.cp = +cp[1]
  const nps = line.match(/\bnps (\d+)/);                if (nps) out.nps = +nps[1]
  const pv = line.match(/ pv (.+)$/)
  if (pv) { out.pv = pv[1].trim().split(/\s+/); out.bestMove = out.pv[0] }
  return (out.cp !== undefined || out.mate !== undefined) ? out : null
}

class Engine {
  constructor(onEval, onStatus) {
    this.onEval = onEval
    this.onStatus = onStatus
    this.proc = null
    this.ready = false
    this.depth = 18
    this.multipv = 1
    this.curFen = null
    this.pvSlots = {}
  }

  start(stockfishPath) {
    this.proc = spawn(stockfishPath, [], { windowsHide: true })
    this.proc.stdout.setEncoding('utf8')
    let buf = ''
    this.proc.stdout.on('data', (chunk) => {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        this._handle(line)
      }
    })
    this.proc.on('exit', () => { this.ready = false; this.onStatus?.({ status: 'error', message: 'Stockfish exited' }) })
    this._send('uci')
  }

  _send(cmd) { this.proc?.stdin.write(cmd + '\n') }

  _handle(line) {
    if (line === 'uciok') { this._send('setoption name MultiPV value 1'); this._send('isready'); return }
    if (line === 'readyok') { this.ready = true; this.onStatus?.({ status: 'ready', message: 'Engine ready' }); return }
    if (line.startsWith('info depth')) {
      const ev = parseInfoLine(line)
      if (!ev || (ev.depth || 0) < 5) return
      const slot = ev.multipv || 1
      this.pvSlots[slot] = ev
      if (slot !== 1) return
      ev.fen = this.curFen
      ev.turn = this.curFen ? (this.curFen.split(' ')[1] || 'w') : 'w'
      ev.multiPvMoves = [1, 2, 3].map(i => this.pvSlots[i]?.pv?.[0]).filter(Boolean)
      this.onEval?.(ev)
    }
  }

  evaluate(fen, depth, multipv) {
    if (!this.ready) return
    if (depth) this.depth = depth
    if (multipv && multipv !== this.multipv) { this.multipv = multipv; this._send(`setoption name MultiPV value ${multipv}`) }
    this.curFen = fen
    this.pvSlots = {}
    this._send('stop')
    this._send('position fen ' + fen)
    this._send('go depth ' + this.depth)
  }

  setOption(name, value) { this._send(`setoption name ${name} value ${value}`) }
  stop() { this._send('stop') }
  kill() { try { this.proc?.kill() } catch {} }
}

module.exports = { parseInfoLine, Engine }
```

- [ ] **Step 4: Run test, expect pass**

```powershell
npm test
```
Expected: parseInfoLine tests pass (6 total with stockfish tests).

- [ ] **Step 5: Commit**

```powershell
git add electron/engine.js electron/engine.test.js
git commit -m "feat: Stockfish engine module with UCI parsing"
```

---

### Task 7: electron/overlay.js — spawn overlay helper + stdin

**Files:**
- Create: `electron/overlay.js`

- [ ] **Step 1: Implement electron/overlay.js**

```javascript
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

function resolveOverlayExe(isDev, resourcesPath) {
  const devPath = path.join(__dirname, '..', 'overlay', 'bin', 'Release', 'net48', 'ChessistOverlay.exe')
  const prodPath = path.join(resourcesPath, 'overlay', 'ChessistOverlay.exe')
  if (isDev && fs.existsSync(devPath)) return devPath
  if (fs.existsSync(prodPath)) return prodPath
  if (fs.existsSync(devPath)) return devPath
  return null
}

class Overlay {
  constructor(isDev, resourcesPath, onStatus) {
    this.exe = resolveOverlayExe(isDev, resourcesPath)
    this.onStatus = onStatus
    this.proc = null
  }

  available() { return !!this.exe }

  start() {
    if (!this.exe) { this.onStatus?.({ overlayOk: false }); return }
    this.proc = spawn(this.exe, [], { windowsHide: true })
    this.proc.on('exit', () => {
      this.proc = null
      this.onStatus?.({ overlayOk: false })
      // auto-restart after a short delay
      setTimeout(() => this.start(), 1500)
    })
    this.onStatus?.({ overlayOk: true })
  }

  // payload is the overlay draw object from the extension (viewX/viewY/.../evalBar/arrows)
  draw(payload) {
    if (!this.proc || !this.proc.stdin.writable) return
    try { this.proc.stdin.write(JSON.stringify(payload) + '\n') } catch {}
  }

  kill() {
    if (this.proc) { try { this.proc.stdin.write('{"type":"quit"}\n') } catch {} ; try { this.proc.kill() } catch {} }
  }
}

module.exports = { Overlay, resolveOverlayExe }
```

- [ ] **Step 2: Commit**

```powershell
git add electron/overlay.js
git commit -m "feat: overlay helper process driver"
```

---

### Task 8: electron/wsserver.js + wire everything in main.js

**Files:**
- Create: `electron/wsserver.js`
- Modify: `electron/main.js`

- [ ] **Step 1: Implement electron/wsserver.js**

```javascript
const { WebSocketServer } = require('ws')

const PORT = 27301

// Routes messages between the browser extension and the engine/overlay.
// engine: { evaluate, setOption, stop }  overlay: { draw }
// onComponent: (partialStatus) => void  — e.g. { extensionConnected: true }
class Bridge {
  constructor(engine, overlay, onComponent) {
    this.engine = engine
    this.overlay = overlay
    this.onComponent = onComponent
    this.wss = null
    this.extClients = new Set()
  }

  start() {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: PORT })
    this.wss.on('connection', (ws) => {
      ws.on('message', (raw) => this._onMessage(ws, raw))
      ws.on('close', () => {
        if (this.extClients.delete(ws)) this.onComponent?.({ extensionConnected: this.extClients.size > 0 })
      })
    })
    this.wss.on('error', (e) => this.onComponent?.({ wsError: e.message }))
  }

  _onMessage(ws, raw) {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'identify' && msg.role === 'extension') {
      this.extClients.add(ws)
      this.onComponent?.({ extensionConnected: true })
      return
    }
    if (msg.type === 'evaluate') { this.engine.evaluate(msg.fen, msg.depth, msg.multiPv); return }
    if (msg.type === 'set_option') { this.engine.setOption(msg.name, msg.value); return }
    if (msg.type === 'stop') { this.engine.stop(); return }
    // Overlay draw payload (no engine type) — has evalBar/arrows/positionOnly/visible
    if ('evalBar' in msg || 'arrows' in msg || 'positionOnly' in msg || 'visible' in msg) {
      this.overlay.draw(msg)
    }
  }

  // Broadcast an eval result to all connected clients (the extension)
  broadcastEval(ev) {
    const data = JSON.stringify({ type: 'eval', data: ev })
    for (const ws of this.wss?.clients ?? []) {
      if (ws.readyState === 1) { try { ws.send(data) } catch {} }
    }
  }

  broadcastStatus(status) {
    const data = JSON.stringify({ type: 'engine_status', ...status })
    for (const ws of this.wss?.clients ?? []) {
      if (ws.readyState === 1) { try { ws.send(data) } catch {} }
    }
  }

  stop() { try { this.wss?.close() } catch {} }
}

module.exports = { Bridge, PORT }
```

- [ ] **Step 2: Rewrite electron/main.js to wire subsystems**

```javascript
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const { ensureStockfish } = require('./stockfish')
const { Engine } = require('./engine')
const { Overlay } = require('./overlay')
const { Bridge } = require('./wsserver')

const isDev = !app.isPackaged
let mainWindow = null
let engine = null
let overlay = null
let bridge = null

const componentStatus = {
  stockfishOk: false,
  overlayOk: false,
  extensionConnected: false,
  message: '',
}

function pushStatus(patch) {
  Object.assign(componentStatus, patch)
  mainWindow?.webContents.send('status', componentStatus)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460, height: 640, minWidth: 380, minHeight: 520,
    title: 'Chessist', backgroundColor: '#000000',
    frame: false, titleBarStyle: 'hidden', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: false,
    },
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
  mainWindow.webContents.on('did-finish-load', () => pushStatus({}))
}

async function startSubsystems() {
  overlay = new Overlay(isDev, process.resourcesPath, (s) => pushStatus(s))
  engine = new Engine(
    (ev) => { bridge?.broadcastEval(ev); mainWindow?.webContents.send('eval', ev) },
    (s) => {
      if (s.status === 'ready') pushStatus({ stockfishOk: true, message: '' })
      else if (s.status === 'error') pushStatus({ stockfishOk: false, message: s.message })
      else pushStatus({ message: s.message })
      bridge?.broadcastStatus(s)
    }
  )
  bridge = new Bridge(engine, overlay, (c) => pushStatus(c))
  bridge.start()
  overlay.start()

  const userData = app.getPath('userData')
  const sfPath = await ensureStockfish(userData, (s) => {
    pushStatus({ message: s.message, stockfishOk: s.status === 'ready' })
    bridge?.broadcastStatus(s)
  })
  if (sfPath) engine.start(sfPath)
}

function registerIpc() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('status:get', () => componentStatus)
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()
  startSubsystems()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { engine?.kill(); overlay?.kill(); bridge?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

- [ ] **Step 3: Add status:get to preload**

In `electron/preload.js`, add inside the `chessist` object:
```javascript
  getStatus: () => ipcRenderer.invoke('status:get'),
```

- [ ] **Step 4: Verify the app boots and downloads Stockfish**

```powershell
npm run dev
```
Expected: window opens; after a few seconds, console/devtools shows Stockfish downloading then engine ready. Close the app. (UI for this lands in Task 9; for now just confirm no crashes in the Electron terminal.)

- [ ] **Step 5: Commit**

```powershell
git add electron/wsserver.js electron/main.js electron/preload.js
git commit -m "feat: WS bridge + wire engine/overlay/stockfish in main process"
```

---

## Phase 4 — Renderer UI

### Task 9: React UI — BootstrapGate, EvalPanel, Settings, TitleBar

**Files:**
- Create: `src/components/TitleBar.jsx`, `src/components/BootstrapGate.jsx`, `src/components/EvalPanel.jsx`, `src/components/Settings.jsx`
- Modify: `src/App.jsx`
- Reference: `ui/src/components/BootstrapGate.tsx`, `ui/src/components/EvalPanel.tsx` (port these to JSX, switching the WS connection to the preload IPC bridge)

- [ ] **Step 1: Create src/components/TitleBar.jsx**

```jsx
export default function TitleBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 36,
      WebkitAppRegion: 'drag', padding: '0 8px 0 14px',
      borderBottom: '1px solid rgb(var(--border))',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent),0.6)' }} />
      <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em' }}>CHESSIST</span>
      <div style={{ marginLeft: 'auto', display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => window.chessist.minimizeWindow()} style={btn}>—</button>
        <button onClick={() => window.chessist.closeWindow()} style={{ ...btn, ...closeBtn }}>✕</button>
      </div>
    </div>
  )
}
const btn = { width: 36, height: 36, background: 'transparent', border: 'none', color: 'rgb(var(--fg-muted))', cursor: 'pointer', fontSize: 13 }
const closeBtn = {}
```

- [ ] **Step 2: Create src/components/BootstrapGate.jsx**

```jsx
function Step({ label, status, detail }) {
  const colors = { ok: 'var(--status-green)', working: 'var(--status-yellow)', waiting: 'var(--fg-dim)' }
  const c = `rgb(${colors[status]})`
  const glow = status === 'ok' ? '0 0 6px rgba(34,197,94,0.7)' : status === 'working' ? '0 0 6px rgba(234,179,8,0.7)' : 'none'
  const text = status === 'ok' ? 'ok' : status === 'working' ? (detail || 'working') : 'waiting'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgb(var(--border))' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: glow }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color: c, fontSize: 12, fontFamily: 'monospace' }}>{text}</span>
    </div>
  )
}

export default function BootstrapGate({ status }) {
  const sf = status.stockfishOk ? 'ok' : 'working'
  const sfDetail = status.message?.startsWith('Stockfish:') ? status.message.replace('Stockfish: ', '') : undefined
  const ov = status.overlayOk ? 'ok' : 'waiting'
  const ext = status.extensionConnected ? 'ok' : 'waiting'
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', marginBottom: 12, color: 'rgb(var(--fg-muted))' }}>SETUP</div>
      <Step label="Stockfish engine" status={sf} detail={sfDetail} />
      <Step label="Overlay" status={ov} />
      <Step label="Extension" status={ext} />
      {!status.extensionConnected && (
        <div style={{ marginTop: 16, padding: '10px 12px', border: '1px solid rgb(var(--border))', background: 'rgb(var(--surface))', fontSize: 12, color: 'rgb(var(--fg-muted))', lineHeight: 1.6 }}>
          Load Chessist in <span style={{ color: 'rgb(var(--fg))', fontFamily: 'monospace' }}>chrome://extensions</span> then open a game on chess.com or lichess.org.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/EvalPanel.jsx**

```jsx
function fmt(ev) {
  if (ev.mate !== undefined) return `M${ev.mate}`
  if (ev.cp !== undefined) { const p = ev.cp / 100; return (p >= 0 ? '+' : '') + p.toFixed(2) }
  return '—'
}
function Stat({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', borderRight: '1px solid rgb(var(--border))', borderBottom: '1px solid rgb(var(--border))' }}>
      <div style={{ fontSize: 9, color: 'rgb(var(--fg-dim))', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
export default function EvalPanel({ ev }) {
  let fill = 50
  if (ev.mate !== undefined) fill = ev.mate > 0 ? 95 : 5
  else if (ev.cp !== undefined) fill = 50 + Math.max(-45, Math.min(45, ev.cp / 50))
  return (
    <div>
      <div style={{ height: 6, background: 'rgb(var(--surface))', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent),0.55)', transition: 'width 0.25s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgb(var(--border))' }}>
        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(ev)}</span>
        <span style={{ fontSize: 12, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace' }}>depth {ev.depth}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderLeft: '1px solid rgb(var(--border))', borderTop: '1px solid rgb(var(--border))' }}>
        <Stat label="Best Move" value={ev.bestMove ?? '—'} />
        <Stat label="Depth" value={String(ev.depth)} />
        <Stat label="Score" value={fmt(ev)} />
        <Stat label="kNPS" value={ev.nps ? String(Math.round(ev.nps / 1000)) : '—'} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite src/App.jsx**

```jsx
import { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import BootstrapGate from './components/BootstrapGate'
import EvalPanel from './components/EvalPanel'

export default function App() {
  const [status, setStatus] = useState({ stockfishOk: false, overlayOk: false, extensionConnected: false, message: '' })
  const [ev, setEv] = useState(null)

  useEffect(() => {
    window.chessist.getStatus().then(setStatus)
    const offS = window.chessist.onStatus(setStatus)
    const offE = window.chessist.onEval(setEv)
    return () => { offS(); offE() }
  }, [])

  const ready = status.stockfishOk && status.extensionConnected

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--bg))' }}>
      <TitleBar />
      {status.message && (
        <div style={{ padding: '6px 16px', fontSize: 11, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace', borderBottom: '1px solid rgb(var(--border))' }}>
          {status.message}
        </div>
      )}
      {!ready ? <BootstrapGate status={status} /> : ev ? <EvalPanel ev={ev} /> : (
        <div style={{ padding: 20, textAlign: 'center', color: 'rgb(var(--fg-dim))', fontSize: 12 }}>
          Open a game on chess.com or lichess.org
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify UI renders the bootstrap checklist**

```powershell
npm run dev
```
Expected: title bar + SETUP checklist. "Stockfish engine" goes to ok after download; "Extension" stays waiting (no extension yet); "Overlay" ok if the overlay exe is built. Close app.

- [ ] **Step 6: Commit**

```powershell
git add src/
git commit -m "feat: React UI — TitleBar, BootstrapGate, EvalPanel wired to IPC"
```

---

## Phase 5 — Extension, build, docs

### Task 10: Extension v2 — drop native messaging

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/src/background/service-worker.js`
- Modify: `extension/src/content/content.js`, `extension/src/content/lichess.js` (verify identify already present)

- [ ] **Step 1: Update manifest.json**

In `extension/manifest.json`: set `"version": "2.0.0"`. Remove `"nativeMessaging"` from `permissions`. Remove the `"key"` field if present (native-host pinning no longer needed). Keep `storage`, `tabs`, `scripting` permissions and host permissions.

- [ ] **Step 2: Slim service-worker.js**

Replace `extension/src/background/service-worker.js` with a minimal version (keep-alive + auto-move only):

```javascript
// Chessist - Service Worker (v2)
// The desktop app owns the engine. This worker only keeps content scripts alive
// and executes auto-moves via scripting.

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'content-alive') return
  // keep-alive only
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_MOVE') {
    const tabId = sender.tab?.id
    if (!tabId) { sendResponse({ success: false, error: 'No tabId' }); return true }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (from, to, promo) => {
        const files = 'abcdefgh'
        const cgWrap = document.querySelector('cg-wrap') || document.querySelector('.cg-wrap')
        const chessComBoard = document.querySelector('wc-chess-board') || document.querySelector('chess-board')
        const isLichess = !!cgWrap
        let isFlipped, surface
        if (isLichess) {
          isFlipped = cgWrap.classList.contains('orientation-black')
          surface = cgWrap.querySelector('cg-board') || cgWrap
        } else {
          if (!chessComBoard) return false
          isFlipped = chessComBoard.classList.contains('flipped') || chessComBoard.getAttribute('board-orientation') === 'black'
          surface = chessComBoard.querySelector('.board') || chessComBoard.shadowRoot?.querySelector('.board') || chessComBoard
        }
        const rect = surface.getBoundingClientRect()
        const sz = rect.width / 8
        function sqPx(sq) {
          const f = files.indexOf(sq[0]), r = parseInt(sq[1]) - 1
          const x = isFlipped ? rect.left + (7 - f + 0.5) * sz : rect.left + (f + 0.5) * sz
          const y = isFlipped ? rect.top + (r + 0.5) * sz : rect.top + (7 - r + 0.5) * sz
          return { x, y }
        }
        const fp = sqPx(from), tp = sqPx(to)
        if (isLichess) {
          function fire(el, type, x, y, btns) {
            el.dispatchEvent(new PointerEvent(type, { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:btns!=null?btns:1 }))
          }
          let pieceEl = null
          const pieces = surface.querySelectorAll('piece')
          let bestDist = sz
          for (const p of pieces) {
            const m = p.style.transform.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/)
            if (!m) continue
            const px = parseFloat(m[1]), py = parseFloat(m[2])
            const ef = files.indexOf(from[0]), er = parseInt(from[1]) - 1
            const ex = isFlipped ? (7-ef)*sz : ef*sz
            const ey = isFlipped ? er*sz : (7-er)*sz
            const d = Math.hypot(px-ex, py-ey)
            if (d < bestDist) { bestDist = d; pieceEl = p }
          }
          const fromEl = pieceEl || document.elementFromPoint(fp.x, fp.y) || surface
          fire(fromEl, 'pointerdown', fp.x, fp.y, 1)
          fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:fp.x, clientY:fp.y, button:0, buttons:1 }))
          setTimeout(() => {
            document.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true, composed:true, clientX:tp.x, clientY:tp.y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }))
            setTimeout(() => {
              const toEl = document.elementFromPoint(tp.x, tp.y) || surface
              fire(toEl, 'pointerup', tp.x, tp.y, 0)
              toEl.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:tp.x, clientY:tp.y, button:0 }))
            }, 50)
          }, 50)
        } else {
          function fireClick(x, y) {
            const el = document.elementFromPoint(x, y) || chessComBoard
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }))
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:1 }))
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:0 }))
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, clientX:x, clientY:y, button:0, buttons:0 }))
            el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 }))
          }
          fireClick(fp.x, fp.y)
          setTimeout(() => fireClick(tp.x, tp.y), 100)
        }
        return true
      },
      args: [message.from, message.to, message.promotion || null]
    }).then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }))
    return true
  }
  return false
})
```

- [ ] **Step 3: Verify content scripts still send identify**

Read `extension/src/content/content.js` and `extension/src/content/lichess.js`. Confirm `_overlayWs.onopen` sends `{ type: 'identify', role: 'extension' }` (added in the previous round). If missing, add it as the first line of the onopen handler. No other content-script changes needed — they already speak the WS eval + overlay-draw protocol that the new Bridge routes.

- [ ] **Step 4: Verify the extension loads**

In Chrome: `chrome://extensions` → reload/Load unpacked → select the `extension/` folder. Confirm it loads with no errors and no `nativeMessaging` permission warning.

- [ ] **Step 5: Commit**

```powershell
git add extension/
git commit -m "feat: extension v2 — drop native messaging, slim service worker"
```

---

### Task 11: Dev overlay build script + CI workflow

**Files:**
- Create: `scripts/build-overlay.ps1`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Create scripts/build-overlay.ps1**

```powershell
# Builds the C# overlay helper for local dev.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
dotnet build (Join-Path $root 'overlay/ChessistOverlay.csproj') -c Release
Write-Host "Overlay built: overlay/bin/Release/net48/ChessistOverlay.exe"
```

- [ ] **Step 2: Rewrite .github/workflows/release.yml**

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']
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

      - name: Build overlay helper
        run: dotnet build overlay/ChessistOverlay.csproj -c Release

      - name: Install app deps
        run: npm ci

      - name: Build installer
        run: npm run dist

      - name: Publish release
        uses: softprops/action-gh-release@v2
        with:
          files: release/*.exe
          generate_release_notes: true
```

- [ ] **Step 3: Commit**

```powershell
git add scripts/build-overlay.ps1 .github/workflows/release.yml
git commit -m "ci: build overlay + electron installer; add dev overlay build script"
```

---

### Task 12: Delete ui/, update README + CHANGELOG

**Files:**
- Delete: `ui/`
- Modify: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Remove the old ui/ scaffold (ported into src/)**

```powershell
git rm -r ui
```

- [ ] **Step 2: Rewrite README.md**

Replace `README.md` with:

```markdown
<p align="center"><img src="extension/icons/icon128.png" width="96" height="96" alt="Chessist"></p>
<h1 align="center">Chessist</h1>
<p align="center">Live Stockfish evaluation for Chess.com and Lichess — a desktop app + browser extension.</p>

---

## What it is

- **Chessist desktop app** (Electron) — runs Stockfish, shows live eval, and draws a transparent,
  screen-capture-invisible overlay on the board.
- **Chessist browser extension** — reads the board on chess.com / lichess.org and talks to the app.

Windows 10/11. The overlay is Windows-only.

## Install

1. Download and run the latest **Chessist installer** from the [Releases](https://github.com/imluri/Chessist/releases) page.
2. Open the Chessist app. It downloads Stockfish on first run.
3. Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** → select the `extension/` folder.
4. Open a game on chess.com or lichess.org.

## Develop

Requirements: Node 20+, .NET SDK 8 (to build the overlay).

```
npm install
npm run build:overlay     # builds the C# overlay helper
npm run dev               # Vite + Electron
```

Build an installer: `npm run dist` (output in `release/`).

## Project structure

```
Chessist/
├── electron/      # Electron main process (engine, ws server, overlay driver)
├── src/           # React renderer (main window)
├── overlay/       # C# overlay helper (transparent, capture-invisible window)
├── extension/     # browser extension (load unpacked)
└── scripts/       # dev helpers
```

## Credits

Created by [lurimous](https://github.com/lurimous/). Powered by [Stockfish](https://stockfishchess.org/)
(GPL, downloaded at first run). MIT licensed (app + extension).
```

- [ ] **Step 3: Update CHANGELOG.md**

Add at the top:

```markdown
## [2.0.0] — 2026-06-08

### Changed
- **Rebuilt as an Electron desktop app** (React + Vite) — owns Stockfish and the WebSocket server
- **Overlay is now a slim C# helper** (`ChessistOverlay.exe`) driven by the desktop app over stdin — same transparent, screen-capture-invisible window
- **No setup.bat, no native messaging** — the app downloads Stockfish on first run; the extension is a pure WebSocket client
- **Repo reorganized** — Electron app at root, browser extension under `extension/`, overlay under `overlay/`
- Removed the C# engine, native-messaging host, and WASM remnants
```

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "docs: v2 README + CHANGELOG; remove old ui/ scaffold"
```

---

### Task 13: End-to-end verification

No code changes — verify the full flow.

- [ ] **Step 1: Build overlay + launch app**

```powershell
npm run build:overlay
npm run dev
```
Expected: app window opens; SETUP checklist shows Stockfish downloading → ok, Overlay → ok.

- [ ] **Step 2: Load extension and open a game**

Load `extension/` unpacked in Chrome. Open a chess.com or lichess.org game. Expected:
- BootstrapGate "Extension" flips to ok; the panel switches to the live EvalPanel.
- The eval updates as moves are played.

- [ ] **Step 3: Test overlay mode**

In the extension popup/options, enable overlay mode. Expected: the transparent eval bar + arrows appear on the board, and (in a screen recording / screen share) the overlay is not captured.

- [ ] **Step 4: Test auto-move**

Enable auto-move. Expected: the app's best move is played on the board.

- [ ] **Step 5: Confirm no stray processes on quit**

Close the Chessist app. In Task Manager, confirm `stockfish.exe` and `ChessistOverlay.exe` are gone.

- [ ] **Step 6: Done — no commit needed**

---

## Self-Review

| Spec requirement | Task |
|---|---|
| Electron app owns engine + WS + UI | Tasks 4, 6, 8 |
| Overlay = slim C# helper via stdin | Task 3 |
| Stockfish download-on-first-run | Task 5 |
| UCI parsing in Node | Task 6 |
| Overlay driver process | Task 7 |
| WS bridge routes evaluate/overlay | Task 8 |
| Repo reorg (extension/, overlay/, root app) | Tasks 1, 2 |
| React UI: BootstrapGate + EvalPanel + TitleBar | Task 9 |
| Theme purple default | Tasks 4, 9 |
| Extension v2, no native messaging | Task 10 |
| electron-builder + extraResources overlay | Task 4 (package.json), Task 11 (CI) |
| CI builds overlay + installer | Task 11 |
| README + CHANGELOG v2 | Task 12 |
| Delete engine/host/ui/setup.bat | Tasks 2, 12 |

**Placeholder scan:** No TBDs; all code blocks complete.
**Type consistency:** `Engine`, `Overlay`, `Bridge`, `ensureStockfish`, `parseInfoLine`, `pickWindowsAsset`, the `componentStatus` shape (`stockfishOk`/`overlayOk`/`extensionConnected`/`message`), and the preload `chessist.*` API are consistent across tasks.
