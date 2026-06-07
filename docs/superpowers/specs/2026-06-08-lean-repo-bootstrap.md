# Lean Repo + BootstrapGate + Eldritch Theme

**Date:** 2026-06-08  
**Status:** Approved  
**Builds on:** `2026-06-08-native-only-engine-design.md`

---

## Goals

1. **Lean repo** — remove all compiled binaries from git. Clone is ~4 MB instead of ~170 MB.
2. **Install from URL** — `setup.bat` downloads `ChessistEngine.exe` + React UI from a GitHub Release, and `stockfish.exe` from official Stockfish releases.
3. **Self-healing engine** — if `stockfish.exe` is deleted, `ChessistEngine.exe` re-downloads it automatically on next start, with WS progress broadcast.
4. **BootstrapGate** — React panel shows a sequential checklist (Engine running → Stockfish ready → Extension detected) with live status.
5. **Eldritch theme + Chessist purple** — UI matches Eldritch's pitch-black flat aesthetic, using `#792A9E` as the primary accent instead of Eldritch's white.

---

## Repo changes

### Removed from git tracking
- `engine/bin/` — all compiled output (ChessistEngine.exe, stockfish.exe, ui/)
- `ui/node_modules/` (already covered by `.gitignore` pattern add)

### Updated `.gitignore`
```
engine/bin/
engine/obj/
ui/node_modules/
native-host/__pycache__/
*.log
*.pdb
*.ini
```

### Added
- `.github/workflows/release.yml` — builds and publishes ChessistEngine.exe + UI on tag

---

## GitHub Actions release pipeline

**File:** `.github/workflows/release.yml`  
**Trigger:** push of tag `v*.*.*`  
**Runner:** `windows-latest`

Steps:
1. `dotnet build engine/ChessistEngine.csproj -c Release` → produces `engine/bin/Release/net48/ChessistEngine.exe`
2. `npm ci && npm run build` in `ui/` → produces `engine/bin/Release/net48/ui/`
3. Zip `engine/bin/Release/net48/` → `chessist-engine-windows.zip` (contains `ChessistEngine.exe`, `ChessistEngine.exe.config`, `ui/`)
4. Create GitHub Release with `chessist-engine-windows.zip` as asset

stockfish.exe is **not** in the Chessist release — always fetched from official-stockfish/Stockfish.

---

## setup.bat (new behavior)

Four steps, all PowerShell-backed, no user prompts:

```
1. Download chessist-engine-windows.zip from latest Chessist GitHub release
   → extracts to engine\bin\Release\net48\
2. Download latest Stockfish Windows x86-64-avx2 zip from official-stockfish/Stockfish releases
   → extracts stockfish-windows-x86-64-avx2.exe, renames to stockfish.exe
3. Register native host (HKCU, unchanged)
4. Print "Done."
```

If GitHub is unreachable, prints error and exits with code 1.  
On re-run, skips downloads if files already exist (checks file presence).

---

## ChessistEngine.exe — StockfishManager auto-download

If `FindStockfish()` returns null on startup, `TryStart()` triggers a download:

1. `GET https://api.github.com/repos/official-stockfish/Stockfish/releases/latest`  
   with `User-Agent: ChessistEngine/1.0`
2. Parse response with regex to find `browser_download_url` matching `*windows*x86-64*avx2*.zip`  
   (fallback: first `.zip` asset containing `windows`)
3. Download zip with `HttpClient`, report progress every 5% via `SendStatus("downloading", "Stockfish X%")`
4. Extract using `ZipFile.ExtractToDirectory`, find `*.exe` in extracted folder, copy to `stockfish.exe` next to ChessistEngine.exe
5. Continue with `TryStart()` as normal

Uses `System.Net.Http.HttpClient` and `System.IO.Compression.ZipFile` (both available .NET 4.5+).

---

## ChessistEngine.exe — Extension detection

content.js sends `{type:"identify", role:"extension"}` immediately on WS open.  
`WsServer` tracks `_extensionConnected` (true if any client sent this identify message; reset to false when all such clients disconnect).

New WS broadcast from server on any state change:  
```json
{"type":"bootstrap_status","stockfishOk":true,"stockfishDownloading":false,"stockfishProgress":0,"extensionConnected":true}
```

Broadcast on:
- Stockfish download start / progress / complete / error
- Extension client connect / disconnect
- Stockfish process start / stop

---

## React UI — Eldritch theme + Chessist purple

### Design language

| Property | Value |
|---|---|
| Background | `#000000` |
| Surface (card) | `#111111` |
| Surface hover | `#1a1a1a` |
| Border | `#1f1f1f` |
| Text primary | `#ffffff` |
| Text muted | `#969696` |
| **Accent (purple)** | **`#792A9E`** |
| Accent glow | `0 0 8px rgba(121,42,158,0.6)` |
| Status green | `#22c55e` |
| Status yellow | `#eab308` |
| Status red | `#ef4444` |
| Border radius | `0` (sharp corners throughout) |
| Font | `Instrument Sans`, `system-ui` |

### CSS variables (ui/src/styles/theme.css)

```css
:root {
  --bg: #000;
  --surface: #111111;
  --surface-hover: #1a1a1a;
  --border: #1f1f1f;
  --fg: #fff;
  --fg-muted: #969696;
  --fg-dim: #787878;
  --accent: #792A9E;
  --accent-glow: 0 0 8px rgba(121,42,158,0.55);
  --status-green: #22c55e;
  --status-yellow: #eab308;
  --status-red: #ef4444;
}
```

### BootstrapGate component

Shown when `bootstrap_status.stockfishOk === false || bootstrap_status.extensionConnected === false`.  
Dismissed automatically when all checks pass.

```
┌─────────────────────────────────────────────────┐
│  ● CHESSIST                          v1.3.1      │  ← purple dot (glow), white title
├─────────────────────────────────────────────────┤
│                                                  │
│  SETUP                                           │  ← fg-muted uppercase label
│                                                  │
│  ● Engine running                        ok      │  ← green dot, always true if panel open
│  ▣ Stockfish                  downloading 47%    │  ← yellow + purple progress bar
│  ○ Extension                      waiting        │  ← dim dot + instruction below
│                                                  │
│  Load Chessist in chrome://extensions            │  ← shown only when ext not detected
│  then open a game on chess.com or lichess.org    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Eval panel (after bootstrap complete)

```
┌─────────────────────────────────────────────────┐
│  ● CHESSIST                        Analyzing     │
├─────────────────────────────────────────────────┤
│  ▐███████████████░░░░░░░░  +1.82               │  ← horizontal eval bar, purple fill
├─────────────────────────┬───────────────────────┤
│  SCORE     +1.82        │  DEPTH     22          │
│  BEST      e2e4         │  kNPS      312         │
└─────────────────────────┴───────────────────────┘
```

Sharp corners, `#111111` card, `#1f1f1f` borders, `#792A9E` eval bar fill with glow.

---

## content.js / lichess.js addition

On `_overlayWs.onopen`, send:
```javascript
_overlayWs.send(JSON.stringify({ type: 'identify', role: 'extension' }));
```

---

## Files changed

| File | Change |
|---|---|
| `.gitignore` | Add `engine/bin/`, `ui/node_modules/` |
| `setup.bat` | Full rewrite — download from GitHub releases |
| `.github/workflows/release.yml` | New — CI build + release |
| `engine/Program.cs` | StockfishManager auto-download; WsServer extension detection; bootstrap_status broadcast |
| `src/content/content.js` | Add identify message on WS open |
| `src/content/lichess.js` | Same |
| `ui/src/styles/theme.css` | New — CSS variables |
| `ui/src/components/BootstrapGate.tsx` | New — setup checklist |
| `ui/src/components/EvalPanel.tsx` | New — renamed/refactored eval display |
| `ui/src/App.tsx` | Wire BootstrapGate + EvalPanel, WS bootstrap_status handling |
| `ui/src/App.css` | Updated with Eldritch/purple theme base styles |
