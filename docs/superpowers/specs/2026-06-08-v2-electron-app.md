# Chessist v2 — Electron Desktop App

**Date:** 2026-06-08
**Status:** Approved — ready for implementation plan
**Version target:** 2.0.0

---

## Goals

Convert Chessist from a C# WinForms engine + browser-only UI into a **React + Vite + Electron
desktop app** (modeled on `Eldritch`), while preserving the signature transparent, screen-capture-
invisible overlay drawn on the chess board.

1. Electron desktop app owns the engine (Stockfish), the WebSocket server, and all UI.
2. The overlay stays **native** — a slim C# helper process (`ChessistOverlay.exe`) the Electron app
   drives over stdin. Pixel-exact, capture-invisible, zero overlay regression.
3. No `setup.bat`, no native-messaging host. The app handles setup (Stockfish download) in-app via a
   BootstrapGate. The browser extension is a pure WebSocket client.
4. Reorganize the repo: Electron app at root, browser extension under `extension/`, native overlay
   helper under `overlay/`.

---

## Architecture

```
┌─ Browser Extension (load unpacked from extension/) ─┐
│  content.js / lichess.js                             │
│   • FEN + move detection                             │
│   • auto-move execution (via service worker)         │
│   • in-page eval bar/arrows  (browser render mode)   │
│   • WS client → ws://127.0.0.1:27301                 │
│   • overlay render mode → sends draw payload over WS │
│  service-worker.js  (keep-alive + EXECUTE_MOVE only) │
│  popup / options    (settings)                       │
└───────────────────────┬──────────────────────────────┘
                        │ WebSocket (ws://127.0.0.1:27301)
┌─ Chessist Desktop App (Electron, root project) ──────┐
│  electron/main.js                                     │
│   ├─ wsserver.js  — WS server (extension bridge)      │
│   ├─ engine.js    — spawns stockfish.exe, parses UCI  │
│   ├─ stockfish.js — locate/download Stockfish         │
│   └─ overlay.js   — spawns ChessistOverlay.exe,        │
│                     streams draw JSON to its stdin     │
│  Main window (React, opaque, frameless) — Eldritch-style│
│   • BootstrapGate · EvalPanel · Settings · TitleBar    │
└───────────────────────┬───────────────────────────────┘
                        │ spawn + stdin (newline JSON)
┌─ ChessistOverlay.exe (C#, overlay-only) ─────────────┐
│  • transparent layered window (WDA_EXCLUDEFROMCAPTURE)│
│  • finds Chrome render-widget HWND, tracks position   │
│  • draws eval bar + arrows over the board             │
└───────────────────────────────────────────────────────┘
```

**What dissolves from the old C# engine:** `StockfishManager`, `WsServer`, `HostBridge`,
`SettingsForm` are all removed. Stockfish management → Node `child_process`. WS server → Node `ws`.
Native messaging → gone. Only `OverlayForm` (+ its Win32 P/Invoke and JSON draw contracts) survives,
moved into the new `overlay/` project and fed by stdin instead of WebSocket.

---

## Repository structure (after reorg)

```
Chessist/
├── package.json            # Electron app — scripts, deps, electron-builder config
├── vite.config.js          # renderer build (base './', dev port 5173)
├── index.html              # main-window entry
├── electron/
│   ├── main.js             # app entry; creates main window; wires IPC; starts subsystems
│   ├── preload.js          # contextBridge: window controls + engine/status API
│   ├── wsserver.js         # ws://127.0.0.1:27301 — receives from extension
│   ├── engine.js           # Stockfish child process + UCI parse + eval broadcast
│   ├── stockfish.js        # locate stockfish.exe; download from GitHub if missing
│   └── overlay.js          # spawn ChessistOverlay.exe; write draw JSON to stdin
├── src/                    # main-window React renderer
│   ├── main.jsx  App.jsx
│   ├── components/         # BootstrapGate, EvalPanel, Settings, TitleBar, Sidebar, icons
│   ├── data/theme.js       # theme registry (purple default)
│   ├── styles/themes.css   # CSS-variable themes
│   └── lib/                # engine client (IPC), settings helpers
├── public/                 # logo.png, fonts/instrument-sans.woff2
├── overlay/                # C# overlay helper (slimmed from old engine/)
│   ├── ChessistOverlay.csproj   # net48, WinExe
│   ├── Program.cs               # OverlayForm + Win32 + stdin JSON loop
│   └── app.manifest
├── extension/              # browser extension (load unpacked from here)
│   ├── manifest.json       # v2.0.0; no nativeMessaging permission
│   ├── content/  background/  popup/  options/  icons/
├── scripts/                # dev helpers (e.g. build-overlay.ps1)
├── .github/workflows/release.yml
└── docs/
```

**Deleted:** `engine/` (C# ChessistEngine), `host/`, `ui/` (absorbed into `src/`), root
`manifest.json` + root `src/` extension code (moved to `extension/`), `setup.bat`, old `scripts/`
batch launchers tied to the C# exe.

---

## Components

### electron/main.js
- Creates the frameless opaque main `BrowserWindow` (Eldritch pattern: `frame:false`,
  `backgroundColor:'#000'`, hardened `webPreferences`, preload).
- On ready: start `wsserver`, start `engine` (which triggers Stockfish locate/download), spawn the
  overlay helper. Registers IPC (window controls, get-status, settings).
- `before-quit`: kill Stockfish + overlay child processes.

### electron/wsserver.js
- `ws` server on `127.0.0.1:27301`. Tracks connected clients; marks a client as the extension when it
  sends `{type:'identify',role:'extension'}`.
- Routes inbound messages:
  - `evaluate` / `set_option` / `stop` → `engine`
  - overlay draw payloads (messages with `evalBar`/`arrows`/`positionOnly`/`visible`) → `overlay`
- Broadcasts `{type:'eval',data}` and `{type:'engine_status'}` to all clients.
- Emits component-status changes (extension connected/disconnected) to main → renderer.

### electron/engine.js
- Spawns `stockfish.exe` (path from `stockfish.js`), `UseShellExecute:false`, pipes stdio.
- UCI handshake; `position fen ... / go depth N`; parses `info`/`bestmove` lines into
  `{depth,cp,mate,bestMove,pv,nps,multipv}` (ports the parsing already in offscreen.js/Program.cs).
- Broadcasts eval to wsserver (→ extension) and to the main window (→ EvalPanel) via IPC.
- `set_option` maps skill level / ELO / MultiPV.

### electron/stockfish.js
- Resolves Stockfish path: `userData/stockfish.exe`, else next to app, else PATH.
- If missing: download latest Windows build from `official-stockfish/Stockfish` GitHub releases
  (Node `https` stream + `unzip`/`extract-zip`), report progress events → BootstrapGate. Saves to
  `userData/stockfish.exe`. (Ports the C# `DownloadStockfishAsync` logic to Node.)

### electron/overlay.js
- Resolves `ChessistOverlay.exe`: `process.resourcesPath/overlay/` in prod, `overlay/bin/Release/net48/`
  in dev. If absent, overlay mode is reported unavailable (graceful).
- Spawns it once; writes newline-delimited JSON draw commands to its stdin. Restarts on crash.
- Kill on app quit.

### overlay/ (C# helper)
- `Program.cs`: `Main` reads newline-delimited JSON from stdin in a loop; each line deserializes into
  the existing `WsMsg` contract; calls `OverlayForm.Apply(msg)`. WinForms message pump runs on the UI
  thread; a background thread reads stdin.
- Keeps: `OverlayForm` (layered window, `WDA_EXCLUDEFROMCAPTURE`, Chrome render-widget HWND tracking,
  GDI+ eval bar + arrow drawing, manual-offset INI), all Win32 P/Invoke, the JSON `DataContract`s.
- Removes: `StockfishManager`, `WsServer`, `HostBridge`, `SettingsForm`, `TrayApp`.

### src/ (main window React)
- **BootstrapGate** — shown until engine ready + overlay running + extension connected. Sequential
  checklist with glow dots (Engine · Stockfish · Overlay · Extension), Stockfish download progress.
- **EvalPanel** — live eval bar, score, depth, best move, kNPS (purple accent).
- **Settings** — depth, skill/ELO, render mode (browser vs overlay), arrows, auto-move (mirrors the
  extension popup settings; settings sync to extension over WS and to engine).
- **TitleBar** — custom window controls (frameless), via preload IPC.
- Theme: Eldritch CSS-variable system, `data-theme`, **default accent `#792A9E`**.

### extension/
- `manifest.json` → `2.0.0`; remove `nativeMessaging` permission.
- `service-worker.js` → keep only keep-alive + `EXECUTE_MOVE`; remove all native-host/launch code.
- `content.js` / `lichess.js` → unchanged WS eval logic; still send `identify` on connect; overlay
  draw payloads now go to Electron (which relays to the overlay helper). Both render modes preserved.
- `popup` / `options` → drop engine launch/restart UI (engine lifecycle is the desktop app's job);
  keep gameplay settings.

---

## Data flow

1. Extension reads FEN → WS `{type:'evaluate',fen,depth,multiPv}` → wsserver → engine → Stockfish.
2. Stockfish UCI → engine parses → `{type:'eval',data}` → wsserver broadcasts to extension + IPC to
   main window EvalPanel.
3. Extension (overlay mode) sends draw payload `{viewX,viewY,width,height,dpr,flipped,evalBar,arrows}`
   → wsserver → overlay.js → `ChessistOverlay.exe` stdin → native window draws over board.
4. Extension (browser mode) draws arrows/eval in-page itself (unchanged).

---

## Build, packaging, distribution

- **Dev:** `npm run dev` = `concurrently` Vite (5173) + Electron (Eldritch pattern). A
  `scripts/build-overlay.ps1` builds the C# overlay into `overlay/bin/Release/net48/` for dev.
- **Build:** `npm run dist` = `vite build && electron-builder` → NSIS installer.
  electron-builder `extraResources` copies `overlay/bin/Release/net48/ChessistOverlay.exe` into the
  packaged app's `resources/overlay/`.
- **CI:** `.github/workflows/release.yml` on `v*.*.*` tag (windows-latest): `setup-dotnet` builds the
  overlay, `setup-node` + `npm ci` + `npm run dist` builds the installer, publishes the NSIS `.exe`
  as a GitHub Release asset.
- **User install:** download + run the installer, open the app, load the extension unpacked once.
  Stockfish auto-downloads on first run. **No .NET install required** — `net48` ships with Windows 10/11;
  only building from source needs the .NET SDK + Node.

---

## Error handling

- **Stockfish download fails** → BootstrapGate shows error + retry; engine reports `engine_status:error`.
- **Overlay exe missing/crashes** → overlay mode marked unavailable in UI; app + browser-mode rendering
  still work; overlay.js auto-restarts on crash.
- **Extension not connected** → BootstrapGate shows "Load Chessist in chrome://extensions".
- **Port 27301 in use** → wsserver surfaces a clear error in the main window.

---

## Out of scope

- Module manager / installable-module registry (deferred — only one native module today).
- Cross-platform overlay (Windows-only; `net48` + Win32). The Electron shell is cross-platform but the
  overlay helper is Windows-only.
- Puzzle mode stays as-is (commented-out).

---

## Migration notes

- The C# `OverlayForm` + Win32 + draw code is **moved, not rewritten** — only its input changes from
  WebSocket to stdin, and the surrounding engine/WS/tray/host classes are deleted.
- The React panel built in the previous round (`ui/`) is the seed for `src/` — BootstrapGate and
  EvalPanel components carry over with the same theme.
- Stockfish download logic ports from C# `DownloadStockfishAsync` to Node in `stockfish.js`.
