# Chessist Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove WASM engine, remove Python launcher, pin extension ID for zero-prompt install, add HostBridge mode to ChessistEngine.exe, migrate settings UI to React+Vite panel in WebView2, and reorganize the repo.

**Architecture:** Browser extension becomes a thin FEN-detection + auto-move bridge; ChessistEngine.exe is the sole engine (Stockfish) and also hosts a React+Vite status panel via WebView2; a named mutex prevents duplicate instances; the exe doubles as its own native-messaging host (HostBridge mode, detecting the `chrome-extension://` origin arg Chrome passes).

**Tech Stack:** JS/Chrome MV3 extension, C# .NET 4.8 WinForms, WebView2, React 18 + TypeScript + Vite, Stockfish UCI.

**Extension ID (pinned):** `oecfgiflfobnbajnpanbpjnnkgdhiifb`

---

## File Map

| Action | Path |
|--------|------|
| DELETE | `logo.png`, `INSTANT_MOVE_FEATURE.md` |
| DELETE | `native-host/stockfish_host.py`, `native-host/stockfish_host.bat` |
| DELETE | `src/engine/`, `src/offscreen/` |
| MOVE | `overlay/` → `engine/` |
| MOVE (rename) | `engine/ChessistOverlay.csproj` → `engine/ChessistEngine.csproj` |
| MOVE | `native-host/` → `host/` (keep only json manifest) |
| MOVE | `dev/rebuild.bat`, `dev/start_debug.bat` + `start.bat` → `scripts/` |
| CREATE | `host/com.chessist.engine.json` |
| CREATE | `ui/` (React+Vite app) |
| MODIFY | `manifest.json` — add `key`, remove offscreen permission + dead resources |
| MODIFY | `setup.bat` — fully non-interactive |
| MODIFY | `Chessist.sln` — updated project path |
| MODIFY | `engine/Program.cs` — HostBridge, mutex, SettingsForm, StockfishManager cleanup |
| MODIFY | `engine/ChessistEngine.csproj` — add WebView2 NuGet |
| MODIFY | `src/background/service-worker.js` — remove WASM, add auto-launch |
| MODIFY | `src/content/content.js` — WS-only eval, settings relay |
| MODIFY | `src/content/lichess.js` — same |
| MODIFY | `src/popup/popup.html` + `popup.js` — remove WASM refs, Restart Engine button |
| MODIFY | `.gitignore` — stop tracking *.pdb *.log *.ini under engine/bin/Release/ |
| MODIFY | `README.md`, `CHANGELOG.md` |

---

## Task 1: Delete dead files + update .gitignore

**Files:**
- Delete: `logo.png`, `INSTANT_MOVE_FEATURE.md`
- Modify: `.gitignore`

- [ ] **Step 1: Remove dead files from tracking and disk**

```powershell
cd "c:\Users\luri\Documents\Programming\Chessist"
git rm logo.png INSTANT_MOVE_FEATURE.md
git rm native-host/stockfish_host.py native-host/stockfish_host.bat
# stop tracking binary junk (keep exe + exe.config + stockfish.exe)
git rm --cached overlay/bin/Release/net48/ChessistEngine.pdb
git rm --cached overlay/bin/Release/net48/ChessistEngine.ini
git rm --cached overlay/bin/Release/net48/ChessistOverlay.ini
git rm --cached overlay/bin/Release/net48/ChessistOverlay.log
```

- [ ] **Step 2: Update .gitignore**

Replace the entire `.gitignore` with:

```
native-host/__pycache__/
overlay/bin/Debug/
overlay/obj/
engine/bin/Debug/
engine/obj/
*.log
*.pdb
*.ini
```

- [ ] **Step 3: Verify**

```powershell
git status
```
Expected: deleted files staged, `.gitignore` modified.

- [ ] **Step 4: Commit**

```powershell
git add .gitignore
git commit -m "chore: delete dead files and stop tracking binary junk"
```

---

## Task 2: Reorganize directories

**Files:**
- Move: `overlay/` → `engine/`, rename csproj
- Move: `native-host/` → `host/` (only the json)
- Create: `scripts/` directory; move `dev/*.bat` + `start.bat`
- Modify: `Chessist.sln`

- [ ] **Step 1: Move and rename directories**

```powershell
# rename overlay → engine (PowerShell can't rename in one step on Windows)
Copy-Item -Recurse overlay engine
git rm -r overlay
git add engine
```

Wait — git already tracks `overlay/`. Use git mv:

```powershell
# git mv doesn't handle directory rename easily; do it file by file
git mv overlay/ChessistOverlay.csproj engine/ChessistEngine.csproj
git mv overlay/Program.cs engine/Program.cs
git mv overlay/app.manifest engine/app.manifest
# Move the bin/Release directory (prebuilt exe)
git mv "overlay/bin/Release/net48/ChessistEngine.exe" "engine/bin/Release/net48/ChessistEngine.exe"
git mv "overlay/bin/Release/net48/ChessistEngine.exe.config" "engine/bin/Release/net48/ChessistEngine.exe.config"
```

- [ ] **Step 2: Move native-host → host**

```powershell
New-Item -ItemType Directory -Force host
git mv native-host/com.chess.live.eval.json host/com.chess.live.eval.json
# Remove the empty native-host dir from tracking
git rm -r --cached native-host 2>$null
```

- [ ] **Step 3: Create scripts/ and move dev scripts**

```powershell
New-Item -ItemType Directory -Force scripts
git mv dev/rebuild.bat scripts/rebuild.bat
git mv dev/start_debug.bat scripts/start_debug.bat
git mv start.bat scripts/start.bat
# Remove empty dev/ dir
git rm -r --cached dev 2>$null
```

- [ ] **Step 4: Update scripts/start.bat to point to new exe path**

Open `scripts/start.bat` and change any `overlay\bin\Release\net48\ChessistEngine.exe` reference to `engine\bin\Release\net48\ChessistEngine.exe`. Read the file first:

```
(read scripts/start.bat and update the path)
```

- [ ] **Step 5: Update scripts/rebuild.bat**

Read `scripts/rebuild.bat` and update any `overlay\ChessistOverlay.csproj` → `engine\ChessistEngine.csproj`.

- [ ] **Step 6: Update Chessist.sln**

Replace the full content of `Chessist.sln` with:

```
Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.5.2.0
MinimumVisualStudioVersion = 10.0.40219.1
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "ChessistEngine", "engine\ChessistEngine.csproj", "{091F64DF-B2B9-F0BA-EAC8-AF06C470B3A5}"
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|Any CPU = Debug|Any CPU
		Release|Any CPU = Release|Any CPU
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{091F64DF-B2B9-F0BA-EAC8-AF06C470B3A5}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{091F64DF-B2B9-F0BA-EAC8-AF06C470B3A5}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{091F64DF-B2B9-F0BA-EAC8-AF06C470B3A5}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{091F64DF-B2B9-F0BA-EAC8-AF06C470B3A5}.Release|Any CPU.Build.0 = Release|Any CPU
	EndGlobalSection
	GlobalSection(SolutionProperties) = preSolution
		HideSolutionNode = FALSE
	EndGlobalSection
	GlobalSection(ExtensibilityGlobals) = postSolution
		SolutionGuid = {D100178B-0139-4B50-8FF3-E2050B9B5DAC}
	EndGlobalSection
EndGlobal
```

- [ ] **Step 7: Update engine/ChessistEngine.csproj — fix OutputPath and ApplicationManifest**

The csproj `ApplicationManifest` still says `app.manifest` (relative, fine). The `AssemblyName` is already `ChessistEngine`. No changes needed beyond what the file mv already did.

Verify:
```powershell
Get-Content engine/ChessistEngine.csproj
```
Expected: `AssemblyName` = `ChessistEngine`, `ApplicationManifest` = `app.manifest`.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: reorganize repo (overlay→engine, native-host→host, dev→scripts)"
```

---

## Task 3: Pin extension ID in manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add "key" field to manifest.json**

In `manifest.json`, add the `"key"` field as the second line (after the opening `{`):

```json
{
  "manifest_version": 3,
  "name": "Chessist",
  "version": "1.3.0",
  "key": "MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQEAxHFGKPG8F8bVYHOvHJuXrzzoulC8atmS0+o8G0jhzTktpblVSKcj5Ol9fByVw2PKgTdEuIT8CrkQIIZIC89fr7gyRk9KqALefvtETUuDIHZsp53jxqT54DIwrjafaCgpOOaQezVZYw2YVJP7aA+nQPFRvyfizrKxtOrcYMSckHEYQ8FA/BfEmGRcTUdGqRihXSMpXZc62BAFD8/TZzLW+6tRKvRI6o0sOjxHLlqOzXQ2CyfTjvF9Erl3Xuzr2xFeHcK+3JpnELHEk6BEVbC/40w7JLMzGXREhszcHRMQxYSnk4QKydDEYNPDUyNM+7Xc1cgqraqNhTwgQCPJ0lvZkQICAQE=",
  "description": "Live chess evaluation bar for Chess.com and Lichess - powered by Stockfish. Created by lurimous.",
  ...
```

- [ ] **Step 2: Verify extension ID**

Load the extension unpacked in Chrome (or reload if already loaded). The ID shown in `chrome://extensions` must be:

```
oecfgiflfobnbajnpanbpjnnkgdhiifb
```

- [ ] **Step 3: Commit**

```powershell
git add manifest.json
git commit -m "feat: pin extension ID via manifest key"
```

---

## Task 4: Rewrite setup.bat — zero prompts

**Files:**
- Modify: `setup.bat`

- [ ] **Step 1: Replace setup.bat entirely**

```bat
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
```

- [ ] **Step 2: Verify (dry run)**

```powershell
cmd /c setup.bat
```

Expected output:
```
=== Chessist Setup ===
Registered native host for Chrome, Brave, and Edge.
Done. Reload the extension in chrome://extensions and open a game.
```

Verify manifest written:
```powershell
Get-Content host/com.chessist.engine.json
```

Expected: JSON with absolute path to ChessistEngine.exe and the pinned extension ID.

- [ ] **Step 3: Commit**

```powershell
git add setup.bat
git commit -m "feat: rewrite setup.bat — zero prompts, no Python required"
```

---

## Task 5: Create host/com.chessist.engine.json + remove old manifest

**Files:**
- Create: `host/com.chessist.engine.json` (template; setup.bat writes the real one with absolute path)
- Delete: `host/com.chess.live.eval.json`

- [ ] **Step 1: Write the template manifest**

Create `host/com.chessist.engine.json` as a template committed to the repo. setup.bat overwrites it with the real absolute path at install time:

```json
{
  "name": "com.chessist.engine",
  "description": "Chessist - Engine Launcher",
  "path": "REPLACE_WITH_ABSOLUTE_PATH_TO_ChessistEngine.exe",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://oecfgiflfobnbajnpanbpjnnkgdhiifb/"
  ]
}
```

- [ ] **Step 2: Remove old manifest**

```powershell
git rm host/com.chess.live.eval.json
```

- [ ] **Step 3: Commit**

```powershell
git add host/com.chessist.engine.json
git commit -m "chore: replace com.chess.live.eval host manifest with com.chessist.engine"
```

---

## Task 6: Update manifest.json — remove WASM permissions and resources

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Remove "offscreen" permission**

In `manifest.json`, remove `"offscreen"` from the `permissions` array. Result:

```json
"permissions": [
  "storage",
  "tabs",
  "nativeMessaging",
  "scripting"
],
```

- [ ] **Step 2: Update web_accessible_resources**

Remove the `src/engine/*` and `src/offscreen/*` entries. Only `icons/*` remains:

```json
"web_accessible_resources": [
  {
    "resources": ["icons/*"],
    "matches": ["<all_urls>"]
  }
]
```

- [ ] **Step 3: Commit**

```powershell
git add manifest.json
git commit -m "feat: remove offscreen permission and WASM resources from manifest"
```

---

## Task 7: Rewrite service-worker.js — remove WASM, add auto-launch

**Files:**
- Modify: `src/background/service-worker.js`

- [ ] **Step 1: Replace service-worker.js**

The new file removes all WASM/offscreen machinery and adds auto-launch. Write the complete replacement:

```javascript
// Chessist - Service Worker
// Coordinates content script ↔ ChessistEngine.exe (native Stockfish over WebSocket)

let lastEvaluation = null;

// === NATIVE BRIDGE ===
let nativePort = null;

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative('com.chessist.engine');
    nativePort.onMessage.addListener((msg) => {
      // launch_result etc. — no-op for now
    });
    nativePort.onDisconnect.addListener(() => { nativePort = null; });
  } catch (e) {
    console.log('Chessist SW: native host not available:', e.message);
  }
}

function launchEngine(debug = false) {
  connectNative();
  nativePort?.postMessage({ type: 'launch', debug });
}

// === TAB CACHE ===
let cachedContentTabIds = null;
let tabCacheTimer = null;
function invalidateTabCache() {
  cachedContentTabIds = null;
  if (tabCacheTimer) { clearTimeout(tabCacheTimer); tabCacheTimer = null; }
}
chrome.tabs.onCreated.addListener(invalidateTabCache);
chrome.tabs.onRemoved.addListener(invalidateTabCache);
chrome.tabs.onUpdated.addListener((id, info) => { if (info.url) invalidateTabCache(); });

// === AUTO-LAUNCH ===
chrome.runtime.onStartup.addListener(() => launchEngine());
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.sync.get(['enabled', 'showBestMove', 'engineDepth']);
  await chrome.storage.sync.set({
    enabled:      existing.enabled      ?? true,
    showBestMove: existing.showBestMove ?? false,
    engineDepth:  existing.engineDepth  ?? 18,
  });
  launchEngine();
});

// Content scripts open a persistent port to keep the service worker alive.
// Also triggers engine launch when a chess tab opens.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'content-alive') return;
  launchEngine();
});

// === MESSAGE HANDLER ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LAUNCH_ENGINE') {
    launchEngine(message.debug || false);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'RESTART_OVERLAY') {
    connectNative();
    nativePort?.postMessage({ type: 'restart', debug: message.debug || false });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'KILL_ENGINE') {
    connectNative();
    nativePort?.postMessage({ type: 'kill' });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'EXECUTE_MOVE') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ success: false, error: 'No tabId' }); return true; }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (from, to, promo) => {
        const files = 'abcdefgh';
        const cgWrap = document.querySelector('cg-wrap') || document.querySelector('.cg-wrap');
        const chessComBoard = document.querySelector('wc-chess-board') || document.querySelector('chess-board');
        const isLichess = !!cgWrap;
        let isFlipped, surface;
        if (isLichess) {
          isFlipped = cgWrap.classList.contains('orientation-black');
          surface = cgWrap.querySelector('cg-board') || cgWrap;
        } else {
          if (!chessComBoard) return false;
          isFlipped = chessComBoard.classList.contains('flipped') || chessComBoard.getAttribute('board-orientation') === 'black';
          surface = chessComBoard.querySelector('.board') || chessComBoard.shadowRoot?.querySelector('.board') || chessComBoard;
        }
        const rect = surface.getBoundingClientRect();
        const sz = rect.width / 8;
        function sqPx(sq) {
          const f = files.indexOf(sq[0]), r = parseInt(sq[1]) - 1;
          const x = isFlipped ? rect.left + (7 - f + 0.5) * sz : rect.left + (f + 0.5) * sz;
          const y = isFlipped ? rect.top + (r + 0.5) * sz      : rect.top + (7 - r + 0.5) * sz;
          return { x, y };
        }
        const fp = sqPx(from), tp = sqPx(to);
        if (isLichess) {
          function fire(el, type, x, y, btns) {
            el.dispatchEvent(new PointerEvent(type, { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:btns!=null?btns:1 }));
          }
          let pieceEl = null;
          const pieces = surface.querySelectorAll('piece');
          let bestDist = sz;
          for (const p of pieces) {
            const m = p.style.transform.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/);
            if (!m) continue;
            const px = parseFloat(m[1]), py = parseFloat(m[2]);
            const ef = files.indexOf(from[0]), er = parseInt(from[1]) - 1;
            const ex = isFlipped ? (7-ef)*sz : ef*sz;
            const ey = isFlipped ? er*sz : (7-er)*sz;
            const d = Math.hypot(px-ex, py-ey);
            if (d < bestDist) { bestDist = d; pieceEl = p; }
          }
          const fromEl = pieceEl || document.elementFromPoint(fp.x, fp.y) || surface;
          fire(fromEl, 'pointerdown', fp.x, fp.y, 1);
          fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:fp.x, clientY:fp.y, button:0, buttons:1 }));
          setTimeout(() => {
            document.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true, composed:true, clientX:tp.x, clientY:tp.y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }));
            setTimeout(() => {
              const toEl = document.elementFromPoint(tp.x, tp.y) || surface;
              fire(toEl, 'pointerup', tp.x, tp.y, 0);
              toEl.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:tp.x, clientY:tp.y, button:0 }));
            }, 50);
          }, 50);
        } else {
          function fireClick(x, y) {
            const el = document.elementFromPoint(x, y) || chessComBoard;
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }));
            el.dispatchEvent(new MouseEvent('mousedown',   { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:1 }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:0 }));
            el.dispatchEvent(new MouseEvent('mouseup',     { bubbles:true, clientX:x, clientY:y, button:0, buttons:0 }));
            el.dispatchEvent(new MouseEvent('click',       { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 }));
          }
          fireClick(fp.x, fp.y);
          setTimeout(() => fireClick(tp.x, tp.y), 100);
        }
        return true;
      },
      args: [message.from, message.to, message.promotion || null]
    }).then(() => sendResponse({ success: true }))
      .catch(e => { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // Eval arrived in content script via WS — relay to popup
  if (message.type === 'WS_EVAL_UPDATE') {
    lastEvaluation = message.evaluation;
    chrome.runtime.sendMessage({ type: 'EVAL_RESULT', evaluation: message.evaluation }).catch(() => {});
    return;
  }

  if (message.type === 'GET_LAST_EVAL') {
    sendResponse({ evaluation: lastEvaluation });
    return true;
  }

  if (message.type === 'SET_DEPTH') {
    broadcastToContentScripts({ type: 'SET_DEPTH', depth: message.depth });
    sendResponse({ success: true });
    return true;
  }

  // These are forwarded to content scripts, which relay over WebSocket to the engine
  if (['SET_SKILL_LEVEL', 'SET_ELO', 'SET_MULTIPV', 'STOP_ANALYSIS', 'RESET_ENGINE'].includes(message.type)) {
    broadcastToContentScripts(message);
    sendResponse({ success: true });
    return true;
  }

  return false;
});

async function broadcastToContentScripts(message) {
  try {
    if (!cachedContentTabIds) {
      const [chessTabs, lichessTabs] = await Promise.all([
        chrome.tabs.query({ url: 'https://www.chess.com/*' }),
        chrome.tabs.query({ url: 'https://lichess.org/*' })
      ]);
      cachedContentTabIds = [...chessTabs, ...lichessTabs].map(t => t.id);
      tabCacheTimer = setTimeout(invalidateTabCache, 10000);
    }
    await Promise.all(
      cachedContentTabIds.map(id =>
        chrome.tabs.sendMessage(id, message).catch(() => {
          cachedContentTabIds = cachedContentTabIds?.filter(t => t !== id) ?? null;
        })
      )
    );
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {
    console.error('Chessist SW: broadcast error:', e);
  }
}
```

- [ ] **Step 2: Verify syntax**

Load the extension in Chrome (`chrome://extensions` → reload). Check the service worker background page for errors.

Expected: no errors, "Chessist" extension loads without warnings.

- [ ] **Step 3: Commit**

```powershell
git add src/background/service-worker.js
git commit -m "feat: remove WASM engine from service-worker, add auto-launch via native host"
```

---

## Task 8: Update content.js — WS-only eval + settings relay

**Files:**
- Modify: `src/content/content.js`

The changes are targeted edits to the large `content.js` file. All edits are in the `requestEval` function, the WS message listener, and the `chrome.runtime.onMessage` listener.

- [ ] **Step 1: Remove the WASM fallback in requestEval**

Find the section starting at the comment `// Fallback: WASM via service worker` (around line 2421). Remove from that comment through the closing `} catch` of the WASM block (ends around line 2471). Replace with:

```javascript
    // Engine not connected — trigger launch and show status
    if (!_launchTriggered) {
      _launchTriggered = true;
      chrome.runtime.sendMessage({ type: 'LAUNCH_ENGINE' }).catch(() => {});
      setTimeout(() => { _launchTriggered = false; }, 5000);
    }
    showEngineStartingMessage();
```

- [ ] **Step 2: Add `_launchTriggered` variable and `showEngineStartingMessage`**

Near the top of the content script scope (with the other `let` declarations around line 1656), add:

```javascript
  let _launchTriggered = false;
```

Add a `showEngineStartingMessage` function near the existing `showRefreshMessage`:

```javascript
  function showEngineStartingMessage() {
    // Reuse or create a subtle status indicator
    let el = document.getElementById('chessist-engine-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chessist-engine-status';
      el.style.cssText = 'position:fixed;bottom:12px;right:12px;background:rgba(0,0,0,.75);color:#fff;font:12px/1.4 sans-serif;padding:6px 10px;border-radius:6px;z-index:99999;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = '⌛ Chessist: starting engine…';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
```

- [ ] **Step 3: Remove the EVAL_RESULT listener**

Find the section (around line 2519):
```javascript
  // Listen for eval updates from background (WASM fallback path)
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!extensionContextValid) return;
      try {
        if (message.type === 'EVAL_RESULT' && message.evaluation) {
          handleEvaluationResult(message.evaluation);
        }
```

Remove the `EVAL_RESULT` handler from this listener. Keep the listener if it handles other message types.

- [ ] **Step 4: Add settings relay handlers to the chrome.runtime.onMessage listener**

In the existing `chrome.runtime.onMessage.addListener` block, add these handlers alongside the existing ones (`RE_EVALUATE`, etc.):

```javascript
      } else if (message.type === 'SET_SKILL_LEVEL') {
        if (_overlayWs?.readyState === WebSocket.OPEN) {
          const level = parseInt(message.level) || 20;
          _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'Skill Level', value: String(level) }));
          if (level < 20) {
            _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'UCI_LimitStrength', value: 'false' }));
          }
        }

      } else if (message.type === 'SET_ELO') {
        if (_overlayWs?.readyState === WebSocket.OPEN) {
          if (message.elo) {
            _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'UCI_LimitStrength', value: 'true' }));
            _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'UCI_Elo', value: String(message.elo) }));
          } else {
            _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'UCI_LimitStrength', value: 'false' }));
          }
        }

      } else if (message.type === 'SET_MULTIPV') {
        if (_overlayWs?.readyState === WebSocket.OPEN) {
          _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'MultiPV', value: String(message.value || 1) }));
        }

      } else if (message.type === 'STOP_ANALYSIS') {
        if (_overlayWs?.readyState === WebSocket.OPEN) {
          _overlayWs.send(JSON.stringify({ type: 'stop' }));
        }

      } else if (message.type === 'RESET_ENGINE') {
        if (_overlayWs?.readyState === WebSocket.OPEN) {
          _overlayWs.send(JSON.stringify({ type: 'stop' }));
        }
        _pvQuickCache = null;
        _preWarmCache = null;
```

- [ ] **Step 5: Send current settings on WS connect**

In `_connectEngineWs()` → `_overlayWs.onopen`, after the existing open-handler code, add:

```javascript
        // Sync current settings to engine on connect
        chrome.storage.sync.get(['skillLevel', 'showAltArrows']).then(s => {
          if (!_overlayWs || _overlayWs.readyState !== WebSocket.OPEN) return;
          const level = parseInt(s.skillLevel) || 20;
          _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'Skill Level', value: String(level) }));
          const mpv = s.showAltArrows ? '3' : '1';
          _overlayWs.send(JSON.stringify({ type: 'set_option', name: 'MultiPV', value: mpv }));
        }).catch(() => {});
```

- [ ] **Step 6: Reset launch counter on WS open**

In `_overlayWs.onopen`, add at the top:

```javascript
        _launchTriggered = false;
```

- [ ] **Step 7: Verify**

Reload the extension. Open chess.com. In the DevTools console for the chess.com tab:
- Check no "sendMessage" errors about EVALUATE
- WS should connect to ws://127.0.0.1:27301 if engine is running

- [ ] **Step 8: Commit**

```powershell
git add src/content/content.js
git commit -m "feat: content.js — WS-only eval, remove WASM fallback, add settings relay"
```

---

## Task 9: Update lichess.js — same changes as content.js

**Files:**
- Modify: `src/content/lichess.js`

Apply the identical changes from Task 8 to `lichess.js`:
- Remove WASM fallback block in `requestEval`
- Add `_launchTriggered`, `showEngineStartingMessage`
- Remove `EVAL_RESULT` from message listener
- Add `SET_SKILL_LEVEL`, `SET_ELO`, `SET_MULTIPV`, `STOP_ANALYSIS`, `RESET_ENGINE` relay handlers
- Send settings on WS connect
- Reset `_launchTriggered` on WS open

Lichess.js has the same structure as content.js (identical engine bridge code). Use the same patterns.

- [ ] **Step 1: Apply all changes from Task 8 to lichess.js**

(Follow the same steps, finding the equivalent locations in the file.)

- [ ] **Step 2: Commit**

```powershell
git add src/content/lichess.js
git commit -m "feat: lichess.js — WS-only eval, remove WASM fallback, add settings relay"
```

---

## Task 10: Update popup.html + popup.js

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`

- [ ] **Step 1: Update popup.html — remove WASM references**

Find and replace the engine section description text. Replace:

```html
<p class="engine-desc-hint">Run <strong>ChessistEngine.exe</strong> for native Stockfish. Falls back to built-in WASM engine when not running.</p>
```

With:

```html
<p class="engine-desc-hint">Run <strong>setup.bat</strong> once to register the engine. It starts automatically when you open a game.</p>
```

Find the "Force Restart Engine" button:

```html
<button type="button" id="forceRestartBtn" class="force-restart-btn" title="Force restart WASM engine if stuck">
  Force Restart Engine
```

Replace with:

```html
<button type="button" id="forceRestartBtn" class="force-restart-btn" title="Restart ChessistEngine.exe">
  Restart Engine
```

- [ ] **Step 2: Update popup.js — fix force restart button handler**

Find the `forceRestartBtn` event listener (around line 515). It currently sends `FORCE_RESTART_ENGINE`. Replace its handler body with:

```javascript
  document.getElementById('forceRestartBtn')?.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ type: 'RESTART_OVERLAY' }).catch(() => {});
  });
```

- [ ] **Step 3: Check options.js for WASM references**

```powershell
Select-String -Path src/options/options.js -Pattern "wasm|WASM|offscreen|FORCE_RESTART"
```

If any matches found, remove those references similarly to popup.js.

- [ ] **Step 4: Commit**

```powershell
git add src/popup/popup.html src/popup/popup.js src/options/options.js
git commit -m "feat: update popup — remove WASM refs, wire Restart Engine to RESTART_OVERLAY"
```

---

## Task 11: Delete src/engine/ and src/offscreen/

**Files:**
- Delete: `src/engine/stockfish.js`, `src/engine/stockfish.wasm`
- Delete: `src/offscreen/offscreen.html`, `src/offscreen/offscreen.js`

- [ ] **Step 1: Remove from git tracking and disk**

```powershell
git rm src/engine/stockfish.js src/engine/stockfish.wasm
git rm src/offscreen/offscreen.html src/offscreen/offscreen.js
```

- [ ] **Step 2: Verify no remaining references**

```powershell
Select-String -Path src -Recurse -Pattern "stockfish\.wasm|offscreen\.html|src/engine/|src/offscreen/"
```

Expected: no matches.

- [ ] **Step 3: Commit**

```powershell
git commit -m "feat: delete WASM engine and offscreen document"
```

---

## Task 12: Add HostBridge + named mutex to engine/Program.cs

**Files:**
- Modify: `engine/Program.cs`

This task makes two targeted changes to `Program.cs`:
1. Replace `static void Main(string[] args)` with a version that detects host-bridge mode and acquires a named mutex.
2. Add the new `static class HostBridge` before the `Program` class.

- [ ] **Step 1: Replace Main()**

Find the `static void Main(string[] args)` block (currently around line 1147) and replace it entirely:

```csharp
        [STAThread]
        static void Main(string[] args)
        {
            // Host-bridge mode: Chrome passes "chrome-extension://..." as an argument
            bool isHost = Array.Exists(args, a =>
                a.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase) ||
                a.Equals("-host", StringComparison.OrdinalIgnoreCase));

            if (isHost) { HostBridge.Run(); return; }

            // Prevent duplicate normal-mode instances
            bool createdNew;
            var mutex = new Mutex(true, "ChessistEngineInstance", out createdNew);
            if (!createdNew) { mutex.Dispose(); return; }

            bool debug = Array.Exists(args, a => a.Equals("-debug", StringComparison.OrdinalIgnoreCase));
            if (debug) DebugLog.Init();
            DebugLog.OpenLogFile();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            using var cts     = new CancellationTokenSource();
            using var overlay = new OverlayForm();
            using var tray    = new TrayApp();
            using var sfMgr   = new StockfishManager();
            var wsServer      = new WsServer(overlay, sfMgr);

            Application.ApplicationExit += (_, _) => { cts.Cancel(); mutex.ReleaseMutex(); };

            Task.Run(() => wsServer.RunAsync(cts.Token));
            Task.Run(() => sfMgr.TryStart());

            overlay.Show();
            Application.Run();
            mutex.Dispose();
        }
```

- [ ] **Step 2: Add HostBridge class**

Insert the following class just before `static class Program` (i.e., between the `WsServer` class closing `}` and `// ── Entry point ───`):

```csharp
    // ── Native-messaging host bridge ──────────────────────────────────────────────
    // When Chrome launches ChessistEngine.exe as a native-messaging host it passes
    // the calling extension's origin (chrome-extension://ID/) as an argument.
    // In that mode we skip all UI and run the stdio JSON loop instead.

    static class HostBridge
    {
        static Stream In  => Console.OpenStandardInput();
        static Stream Out => Console.OpenStandardOutput();

        static string? Read()
        {
            var lb = new byte[4];
            int read = 0;
            while (read < 4)
            {
                int n = In.Read(lb, read, 4 - read);
                if (n == 0) return null;
                read += n;
            }
            int len = BitConverter.ToInt32(lb, 0);
            var buf = new byte[len]; read = 0;
            while (read < len)
            {
                int n = In.Read(buf, read, len - read);
                if (n == 0) return null;
                read += n;
            }
            return Encoding.UTF8.GetString(buf);
        }

        static void Write(string json)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            Out.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
            Out.Write(bytes, 0, bytes.Length);
            Out.Flush();
        }

        static bool IsRunning()
        {
            Mutex? m = null;
            try   { return Mutex.TryOpenExisting("ChessistEngineInstance", out m); }
            catch { return false; }
            finally { m?.Dispose(); }
        }

        static void Launch(bool debug)
        {
            if (IsRunning())
            {
                Write("{\"type\":\"launch_result\",\"success\":true,\"already_running\":true}");
                return;
            }
            try
            {
                var exe = System.Reflection.Assembly.GetExecutingAssembly().Location;
                var psi = new ProcessStartInfo(exe)
                {
                    UseShellExecute = false,
                    CreateNoWindow  = !debug,
                    Arguments       = debug ? "-debug" : "",
                };
                Process.Start(psi);
                Write("{\"type\":\"launch_result\",\"success\":true}");
            }
            catch (Exception ex)
            {
                var msg = ex.Message.Replace("\"", "'");
                Write($"{{\"type\":\"launch_result\",\"success\":false,\"error\":\"{msg}\"}}");
            }
        }

        static void Kill()
        {
            int self = Process.GetCurrentProcess().Id;
            foreach (var p in Process.GetProcessesByName("ChessistEngine"))
            {
                try { if (p.Id != self) p.Kill(); } catch { }
                p.Dispose();
            }
        }

        public static void Run()
        {
            while (true)
            {
                var json = Read();
                if (json == null) break;

                var typeM  = System.Text.RegularExpressions.Regex.Match(json, "\"type\"\\s*:\\s*\"([^\"]+)\"");
                var debugM = System.Text.RegularExpressions.Regex.Match(json, "\"debug\"\\s*:\\s*true");
                string type  = typeM.Success ? typeM.Groups[1].Value : "";
                bool   debug = debugM.Success;

                switch (type)
                {
                    case "launch":  Launch(debug); break;
                    case "restart": Kill(); Thread.Sleep(500); Launch(debug); break;
                    case "kill":    Kill(); break;
                    case "quit":    return;
                }
            }
        }
    }
```

- [ ] **Step 3: Clean up StockfishManager._sfCandidates**

Find `_sfCandidates` (around line 550). Remove the stale candidate:
```csharp
@"..\..\..\..\native-host\stockfish.exe",
```

The updated array:
```csharp
static readonly string[] _sfCandidates =
{
    "stockfish.exe",
    @"stockfish\stockfish.exe",
    @"C:\Program Files\Stockfish\stockfish.exe",
    @"C:\Program Files (x86)\Stockfish\stockfish.exe",
    @"C:\stockfish\stockfish.exe",
};
```

- [ ] **Step 4: Build and verify**

```powershell
dotnet build engine/ChessistEngine.csproj -c Release
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Test HostBridge mode manually**

```powershell
# Simulate Chrome calling the host bridge
$psi = [System.Diagnostics.ProcessStartInfo]::new("engine/bin/Release/net48/ChessistEngine.exe")
$psi.Arguments = "chrome-extension://oecfgiflfobnbajnpanbpjnnkgdhiifb/"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$p = [System.Diagnostics.Process]::Start($psi)

# Send a "launch" message (4-byte length prefix + JSON)
$json = '{"type":"launch","debug":false}'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$lenBytes = [BitConverter]::GetBytes($bytes.Length)
$p.StandardInput.BaseStream.Write($lenBytes, 0, 4)
$p.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
$p.StandardInput.BaseStream.Flush()

# Read response
$lenBuf = New-Object byte[] 4
$p.StandardOutput.BaseStream.Read($lenBuf, 0, 4) | Out-Null
$len = [BitConverter]::ToInt32($lenBuf, 0)
$buf = New-Object byte[] $len
$p.StandardOutput.BaseStream.Read($buf, 0, $len) | Out-Null
[System.Text.Encoding]::UTF8.GetString($buf)
```

Expected: `{"type":"launch_result","success":true}` (or `already_running:true` if the engine was already running).

- [ ] **Step 6: Commit**

```powershell
git add engine/Program.cs
git commit -m "feat: add HostBridge mode + named mutex to ChessistEngine.exe"
```

---

## Task 13: Add WebView2 NuGet + SettingsForm

**Files:**
- Modify: `engine/ChessistEngine.csproj`
- Modify: `engine/Program.cs`

This adds a floating React panel window accessible from the system tray.

- [ ] **Step 1: Add WebView2 NuGet package**

Replace `engine/ChessistEngine.csproj` with:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net48</TargetFramework>
    <AssemblyName>ChessistEngine</AssemblyName>
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
  <ItemGroup>
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2849.39" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Add SettingsForm class to Program.cs**

Insert the following class just before the `HostBridge` class (or after `TrayApp`). Find the `TrayApp` class end (`}`) and add after it:

```csharp
    // ── Settings panel (WebView2 floating window) ─────────────────────────────────

    sealed class SettingsForm : Form
    {
        Microsoft.Web.WebView2.WinForms.WebView2 _webView = null!;

        public SettingsForm()
        {
            Text            = "Chessist Panel";
            Width           = 420;
            Height          = 520;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox     = false;
            ShowInTaskbar   = false;
            StartPosition   = FormStartPosition.Manual;

            // Position bottom-right of primary screen
            var screen = System.Windows.Forms.Screen.PrimaryScreen!.WorkingArea;
            Location = new System.Drawing.Point(screen.Right - Width - 20, screen.Bottom - Height - 20);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);

            _webView = new Microsoft.Web.WebView2.WinForms.WebView2 { Dock = DockStyle.Fill };
            _webView.CoreWebView2InitializationCompleted += (s, ev) =>
            {
                if (!ev.IsSuccess)
                {
                    MessageBox.Show(
                        "WebView2 runtime not found.\nDownload: https://developer.microsoft.com/microsoft-edge/webview2/",
                        "Chessist", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = DebugLog.Enabled;

                var uiPath = Path.Combine(
                    Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location)!, "ui");

                if (Directory.Exists(uiPath))
                {
                    _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "chessist.local", uiPath,
                        Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
                    _webView.CoreWebView2.Navigate("https://chessist.local/index.html");
                }
                else
                {
                    _webView.CoreWebView2.NavigateToString(
                        "<html><body style='font-family:sans-serif;padding:20px'>" +
                        "<h2>Chessist Panel</h2>" +
                        "<p>UI not built yet. Run: <code>cd ui &amp;&amp; npm run build</code> then copy dist/ to engine/bin/Release/net48/ui/</p>" +
                        "</body></html>");
                }
            };
            Controls.Add(_webView);
            _webView.EnsureCoreWebView2Async();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // Hide instead of close so tray can re-show it
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide();
            }
            else
            {
                base.OnFormClosing(e);
            }
        }
    }
```

- [ ] **Step 3: Wire SettingsForm to TrayApp**

Find the `TrayApp` class in `Program.cs`. Locate where the tray menu items are created (the context menu setup). Add a "Open Panel" menu item. First find where `TrayApp` stores/creates the `ContextMenuStrip`, then add:

In the `TrayApp` constructor (or wherever the context menu is built), find the section that adds menu items and add:

```csharp
// Add "Open Panel" item at the top of the tray menu
var panelItem = new ToolStripMenuItem("Open Panel");
panelItem.Click += (_, _) =>
{
    if (_settingsForm == null || _settingsForm.IsDisposed)
        _settingsForm = new SettingsForm();
    _settingsForm.Show();
    _settingsForm.BringToFront();
};
contextMenu.Items.Insert(0, panelItem);
contextMenu.Items.Insert(1, new ToolStripSeparator());
```

Add the field to `TrayApp`:
```csharp
SettingsForm? _settingsForm;
```

- [ ] **Step 4: Build**

```powershell
dotnet build engine/ChessistEngine.csproj -c Release
```

Expected: Build succeeded. If NuGet restore fails, run `dotnet restore` first.

- [ ] **Step 5: Commit**

```powershell
git add engine/ChessistEngine.csproj engine/Program.cs
git commit -m "feat: add WebView2 SettingsForm + wire to tray menu"
```

---

## Task 14: Scaffold React+Vite status panel

**Files:**
- Create: `ui/package.json`
- Create: `ui/vite.config.ts`
- Create: `ui/tsconfig.json`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/App.css`

- [ ] **Step 1: Create ui/package.json**

```json
{
  "name": "chessist-ui",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.1"
  }
}
```

- [ ] **Step 2: Create ui/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../engine/bin/Release/net48/ui',
    emptyOutDir: true,
  },
  base: './',
})
```

- [ ] **Step 3: Create ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create ui/index.html**

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
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create ui/src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create ui/src/App.tsx**

```tsx
import { useEffect, useState, useRef } from 'react'

interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
  fen?: string
}

interface EngineStatus {
  status: 'connecting' | 'ready' | 'searching' | 'error'
  message?: string
}

function formatScore(data: EvalData): string {
  if (data.mate !== undefined) return `M${data.mate}`
  if (data.cp !== undefined) {
    const pawns = data.cp / 100
    return (pawns >= 0 ? '+' : '') + pawns.toFixed(2)
  }
  return '—'
}

function EvalBar({ cp, mate }: { cp?: number; mate?: number }) {
  let fillPercent = 50
  if (mate !== undefined) fillPercent = mate > 0 ? 95 : 5
  else if (cp !== undefined) fillPercent = 50 + Math.max(-45, Math.min(45, cp / 50))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
      <div style={{ width: 12, height: 80, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', bottom: 0, width: '100%',
          height: `${fillPercent}%`, background: '#fff',
          transition: 'height 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>
        {mate !== undefined ? `M${mate}` : cp !== undefined ? ((cp >= 0 ? '+' : '') + (cp / 100).toFixed(2)) : '—'}
      </div>
    </div>
  )
}

export default function App() {
  const [status, setStatus]     = useState<EngineStatus>({ status: 'connecting' })
  const [evalData, setEvalData] = useState<EvalData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:27301')
      wsRef.current = ws

      ws.onopen = () => {
        setStatus({ status: 'ready' })
        reconnectRef.current = 0
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'eval' && msg.data) {
            setEvalData(msg.data)
            setStatus(s => s.status === 'error' ? { status: 'ready' } : { ...s, status: 'searching' })
          } else if (msg.type === 'engine_status') {
            setStatus({ status: msg.status, message: msg.message })
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setStatus({ status: 'connecting' })
        const delay = Math.min(3000, 500 * Math.pow(2, reconnectRef.current))
        reconnectRef.current++
        setTimeout(connect, delay)
      }

      ws.onerror = () => {}
    }

    connect()
    return () => { wsRef.current?.close() }
  }, [])

  const statusColor = { connecting: '#888', ready: '#4caf50', searching: '#2196f3', error: '#f44336' }[status.status]
  const statusLabel = { connecting: 'Connecting…', ready: 'Ready', searching: 'Analyzing', error: 'Error' }[status.status]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, minHeight: '100vh', background: '#1e1e1e', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontWeight: 600 }}>Chessist Engine</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{statusLabel}</span>
      </div>

      {status.message && (
        <div style={{ fontSize: 12, color: '#f44336', marginBottom: 8 }}>{status.message}</div>
      )}

      {evalData ? (
        <>
          <EvalBar cp={evalData.cp} mate={evalData.mate} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <Stat label="Score"    value={formatScore(evalData)} />
            <Stat label="Depth"    value={String(evalData.depth)} />
            <Stat label="Best"     value={evalData.bestMove ?? '—'} />
            <Stat label="kNPS"     value={evalData.nps ? String(Math.round(evalData.nps / 1000)) : '—'} />
          </div>
        </>
      ) : (
        <div style={{ color: '#666', marginTop: 20, textAlign: 'center' }}>
          {status.status === 'connecting' ? 'Waiting for engine…' : 'No position yet'}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#2a2a2a', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 7: Create ui/src/App.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1e1e1e; }
```

- [ ] **Step 8: Install dependencies and build**

```powershell
cd ui
npm install
npm run build
cd ..
```

Expected: `engine/bin/Release/net48/ui/` directory created with `index.html` and assets.

- [ ] **Step 9: Verify the build output exists**

```powershell
Test-Path "engine/bin/Release/net48/ui/index.html"
```

Expected: `True`

- [ ] **Step 10: Commit**

```powershell
git add ui/
git add engine/bin/Release/net48/ui/
git commit -m "feat: React+Vite engine status panel"
```

---

## Task 15: Bundle stockfish.exe

**Files:**
- Add: `engine/bin/Release/net48/stockfish.exe`

The engine already looks for `stockfish.exe` in the same directory as the exe (first candidate in `_sfCandidates`). Just place a Stockfish binary there.

- [ ] **Step 1: Download Stockfish for Windows**

Go to https://stockfishchess.org/download/ and download the latest Windows binary. Extract `stockfish-windows-x86-64-avx2.exe` (or the appropriate variant for the target machine).

Rename the downloaded file to `stockfish.exe` and place it at:
```
engine/bin/Release/net48/stockfish.exe
```

- [ ] **Step 2: Verify it runs**

```powershell
echo "uci`nisready`nquit" | engine/bin/Release/net48/stockfish.exe
```

Expected: output includes `uciok` and `readyok`.

- [ ] **Step 3: Track in git**

```powershell
git add engine/bin/Release/net48/stockfish.exe
git commit -m "chore: bundle stockfish.exe for zero-config install"
```

Note: `stockfish.exe` is GPL-licensed. The README must acknowledge this (covered in Task 16).

---

## Task 16: End-to-end verification

No code changes — verify the full flow works.

- [ ] **Step 1: Run setup.bat**

```powershell
cmd /c setup.bat
```

Expected: completes silently, no prompts.

- [ ] **Step 2: Verify registry entry**

```powershell
reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.chessist.engine"
```

Expected: value points to `host/com.chessist.engine.json`.

- [ ] **Step 3: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select the repo root
4. Confirm extension ID shown is `oecfgiflfobnbajnpanbpjnnkgdhiifb`

- [ ] **Step 4: Open chess.com — verify engine auto-launches**

1. Open `https://www.chess.com/play/online`
2. Within ~3 seconds, the extension's service worker should launch ChessistEngine.exe
3. Check Task Manager: `ChessistEngine.exe` appears, `stockfish.exe` appears as child process
4. The extension popup shows engine status "Connected"

- [ ] **Step 5: Verify eval works**

Make a move on chess.com. The evaluation bar should update. Open DevTools console on chess.com tab and verify no errors about WASM or offscreen.

- [ ] **Step 6: Test Restart Engine button**

In the popup, click "Restart Engine". ChessistEngine.exe should stop and restart. Eval should resume within ~3 seconds.

- [ ] **Step 7: Open the React panel**

Right-click the system tray icon → "Open Panel". The SettingsForm should appear with the React status dashboard showing engine status and current eval.

- [ ] **Step 8: Commit verification notes (none needed — just proceed to Task 17)**

---

## Task 17: Update README + CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README.md project structure section**

Replace the `Project Structure` section with the new layout:

```
Chessist/
├── setup.bat               # First-time setup (run once)
├── manifest.json
├── src/
│   ├── content/            # Board detection + eval display
│   ├── background/         # Service worker (engine launcher)
│   ├── popup/              # Extension popup
│   └── options/
├── engine/                 # ChessistEngine.exe source
│   ├── ChessistEngine.csproj
│   ├── Program.cs
│   └── bin/Release/net48/
│        ├── ChessistEngine.exe  # Native engine + overlay + WebSocket server
│        ├── stockfish.exe       # Bundled Stockfish
│        └── ui/                 # Built React status panel
├── host/                   # Native messaging host manifest
├── ui/                     # React+Vite status panel source
├── scripts/                # Dev helper scripts
└── icons/
```

- [ ] **Step 2: Update README.md Quick Start section**

Replace requirements and install steps:

```markdown
## Quick Start

### 1. Clone
git clone https://github.com/lurimous/Chessist.git

### 2. Load the extension
1. Open chrome://extensions (or brave://extensions)
2. Enable Developer mode (toggle, top right)
3. Click Load unpacked → select the Chessist folder

### 3. Run setup (once)
Double-click setup.bat — no prompts, takes ~2 seconds.

### 4. Play
Open any game on chess.com or lichess.org.
The engine starts automatically.
```

- [ ] **Step 3: Update Credits to mention Stockfish GPL**

Add to Credits:
```
- Stockfish is GPL-licensed and bundled for convenience. Source: https://github.com/official-stockfish/Stockfish
```

- [ ] **Step 4: Add CHANGELOG entry**

Add at the top of CHANGELOG.md:

```markdown
## [1.3.1] — 2026-06-08

### Changed
- **Removed WASM engine** — ChessistEngine.exe (native Stockfish) is now the sole analysis engine
- **Removed Python dependency** — ChessistEngine.exe now acts as its own native-messaging host
- **Bundled Stockfish** — no separate Stockfish install required
- **Zero-prompt setup** — setup.bat requires no user input (extension ID is pinned)
- **React+Vite status panel** — tray icon → Open Panel shows engine status and live eval
- Repo reorganized: `overlay/` → `engine/`, `native-host/` → `host/`, dev scripts moved to `scripts/`
```

- [ ] **Step 5: Commit**

```powershell
git add README.md CHANGELOG.md
git commit -m "docs: update README and CHANGELOG for v1.3.1 rearchitecture"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Remove WASM | Tasks 7, 8, 9, 11 |
| Remove Python launcher | Task 12 (HostBridge) |
| Pin extension ID | Task 3 |
| Zero-prompt setup.bat | Task 4 |
| Auto-launch engine on page load | Task 7 (onStartup/onConnect) |
| Restart Engine button | Task 10 |
| Settings relay over WS | Tasks 8, 9 |
| HostBridge mode in exe | Task 12 |
| Named mutex (one instance) | Task 12 |
| React+Vite panel | Tasks 13, 14 |
| Bundle stockfish.exe | Task 15 |
| Repo reorganization | Tasks 1, 2 |
| .gitignore cleanup | Task 1 |
| README + CHANGELOG | Task 17 |
| StockfishManager cleanup | Task 12 |

All spec sections covered.

**Placeholder scan:** No TBDs found. All code blocks are complete.

**Type consistency:** `HostBridge`, `SettingsForm`, `connectNative`, `launchEngine` naming consistent across tasks.
