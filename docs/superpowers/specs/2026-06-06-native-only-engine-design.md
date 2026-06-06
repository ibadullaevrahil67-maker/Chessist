# Design: Native-only engine (remove WASM)

**Date:** 2026-06-06
**Status:** Approved (pending implementation plan)

## Goal

Make `ChessistEngine.exe` (native Stockfish) the **sole** analysis engine. Remove
the WASM/offscreen engine and the Python launcher entirely. This is a performance
change: native Stockfish is 10–100× faster than the WASM build.

Both rendering modes stay — the in-page eval bar/arrows drawn by `content.js`, and
the transparent overlay drawn by the exe. Only the *engine* changes; both renderers
are fed by the native engine over the existing WebSocket (`ws://127.0.0.1:27301`).

## Architecture after the change

```
content.js / lichess.js ──WS ws://127.0.0.1:27301──► ChessistEngine.exe ──► Stockfish
        │                                                   ▲
        └─ chrome.runtime ─► service-worker ─► native msg ──┘ (launch/restart/kill)
                                                  (ChessistEngine.exe in host-bridge mode)
```

One binary, two roles:

- **Normal mode** — overlay window + WS server + Stockfish (unchanged behaviour).
- **Host-bridge mode** — when Chrome launches the binary as a native-messaging host,
  it runs *no* WinForms/overlay. It performs the stdio length-prefixed JSON loop and
  launches / kills / restarts the detached normal-mode instance. This replaces
  `stockfish_host.py`.

Mode is selected in `Main()`: if `args` contains an origin starting with
`chrome-extension://` (Chrome passes the calling extension's origin as a native-host
argument) — or an explicit `-host` flag — run `HostBridge.Run()` and return before
any UI init. Otherwise run the normal overlay/engine app.

A system-wide named `Mutex` (e.g. `Global\ChessistEngine`) makes launching idempotent:
the normal-mode instance acquires it on startup; a second normal instance exits
immediately; the host bridge checks the mutex to answer "is the engine running?".

## Changes by component

### 1. `overlay/Program.cs` — add host-bridge mode

- `Main()`: detect native-host invocation (`chrome-extension://…` in `args`, or `-host`).
  When detected, run `HostBridge.Run()` and return — no `Application.Run()`, no overlay.
- `HostBridge`: port the launch/restart/kill/quit logic from `stockfish_host.py`:
  - stdin: read 4-byte little-endian length prefix + JSON message.
  - stdout: write 4-byte length prefix + JSON reply.
  - `launch` → if engine not already running (mutex check), `Process.Start` a detached
    normal-mode `ChessistEngine.exe` (`DETACHED_PROCESS | CREATE_NO_WINDOW`, or
    `-debug` window when requested). Reply `{type:"launch_result", success:…}`.
  - `restart` → kill, brief wait, launch.
  - `kill` → signal the running instance to exit (mutex-named event / `taskkill`).
  - `quit` → break the loop.
- Normal mode acquires the named mutex on startup; if already held, exit immediately
  (prevents duplicate engines / duplicate WS listeners on port 27301).

### 2. Native-messaging registration

- `native-host/com.chess.live.eval.json`: `path` → the absolute path of
  `…\overlay\bin\Release\net48\ChessistEngine.exe` (no `.bat`).
- **Delete** `native-host/stockfish_host.py` and `native-host/stockfish_host.bat`.

### 3. `src/background/service-worker.js` — slim down

- **Remove**: offscreen document creation/readiness tracking
  (`ensureOffscreenDocument`, `waitForOffscreenReady`, `OFFSCREEN_READY`),
  the WASM eval path (`EVALUATE` handler, `handleEvaluateRequest`,
  `handleWasmEvaluation`), `EVAL_UPDATE`, `BEST_MOVE`, `FORCE_RESTART_ENGINE`,
  and the WASM-side caching machinery (`positionCache`, `pvCache`, `applyMove`,
  `cacheEvaluation`, `getCachedEvaluation`, `checkPVContinuation`, and the FEN
  board expand/compress helpers used only by them).
- **Keep**: the native bridge (`connectNative`, `LAUNCH_ENGINE`,
  `RESTART_OVERLAY`, `KILL_ENGINE`), `EXECUTE_MOVE` (auto-move via
  `chrome.scripting.executeScript`), and the `WS_EVAL_UPDATE` → popup relay.
- **Add**: auto-launch. On `chrome.runtime.onStartup` / `onInstalled`, and when a
  `content-alive` port connects, call `connectNative()` + post `{type:'launch'}`.
  This decouples launching from Overlay Mode (the engine is now always required).

### 4. `src/content/content.js` + `src/content/lichess.js` — WS-only eval

- Remove the WASM-fallback branch in the eval-request function
  (`chrome.runtime.sendMessage({type:'EVALUATE'})`) and the WASM `EVAL_RESULT`
  message listener. The WebSocket becomes the only eval path.
- Keep the existing WS prediction caches (`_pvQuickCache`, `_preWarmCache`).
- Route engine options to the exe over WS instead of SW→offscreen:
  - Skill level → `{type:'set_option', name:'Skill Level', value:<n>}`
  - ELO → `{type:'set_option', name:'UCI_LimitStrength', value:'true'}` +
    `{type:'set_option', name:'UCI_Elo', value:<n>}` (and `false` to disable).
  - (Depth and MultiPV are already sent per-request inside the `evaluate` message.)
- When the WS is not open, trigger `LAUNCH_ENGINE` and surface a
  "starting engine… / engine not running" state instead of silently falling back.
- `lichess.js` mirrors the same edits.

### 5. `manifest.json`

- Remove the `"offscreen"` permission.
- Remove the `src/engine/*` and `src/offscreen/*` entries from
  `web_accessible_resources` (keep `icons/*`).

### 6. Deleted files

- `src/engine/` — `stockfish.js`, `stockfish.wasm`.
- `src/offscreen/` — `offscreen.html`, `offscreen.js`.
- `native-host/stockfish_host.py`, `native-host/stockfish_host.bat`.

### 7. Popup / options

- `popup.html`: engine-status copy drops "Falls back to built-in WASM engine when
  not running." Status reflects Not running → Starting → Connected.
- "Force Restart Engine" button (currently restarts WASM) → "Restart Engine",
  wired to the native `RESTART_OVERLAY` message.
- Auto-launch is no longer gated on the Overlay Mode toggle.

### 8. `setup.bat`

- Remove the Python check (step 1).
- Generate `com.chess.live.eval.json` with `path` pointing at `ChessistEngine.exe`.
- Keep extension-ID prompt + registry registration (Chrome + Brave) and the optional
  Windows-startup entry.
- Build hint: `dotnet build overlay\ChessistOverlay.csproj -c Release`.

## Error / edge handling

- **Exe missing** → host bridge replies `success:false`; popup shows
  "engine not found — build it."
- **Stockfish not found by the exe** → the exe already broadcasts
  `{type:'engine_status', status:'error', message:…}`; keep relaying it to the popup.
- **Engine crash / WS drop** → `content.js` already reconnects every 3 s and
  re-requests eval on reconnect. Add a launch retry when reconnect keeps failing
  (re-send `LAUNCH_ENGINE` on a backoff).
- **Duplicate launch** → named mutex guarantees a single normal-mode instance.

## Out of scope / notes

- README and CHANGELOG updates are included in the implementation.
- Version is **not** bumped unless explicitly requested (current `1.3.0`).
- Puzzle-mode code remains commented-out and untouched.
- No change to the WS eval protocol or overlay-drawing code paths.
```
