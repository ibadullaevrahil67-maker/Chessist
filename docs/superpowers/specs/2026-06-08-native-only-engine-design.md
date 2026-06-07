# Chessist Rearchitecture: Native-only Engine + React UI

**Date:** 2026-06-08  
**Status:** Approved — ready for implementation plan  
**Supersedes:** `2026-06-06-native-only-engine-design.md`

---

## Goals

1. **Remove WASM** — `ChessistEngine.exe` (native Stockfish) is the sole analysis engine.
2. **Remove Python** — the exe doubles as its own native-messaging host (HostBridge mode).
3. **React+Vite UI** — the overlay's eval bar and arrows move from GDI+ C# drawing to a React app rendered via WebView2.
4. **Frictionless install** — `git clone` → load unpacked → `setup.bat` (zero prompts) → eval works.

---

## Final Architecture

```
Browser Extension
 ├── content.js / lichess.js
 │     • FEN detection + WS send
 │     • auto-move (always)
 │     • in-page arrows/eval bar (overlay mode OFF)
 ├── service-worker.js
 │     • auto-launch engine via native messaging
 │     • relay WS_EVAL_UPDATE to popup
 └── popup.html/js  (minimal: status + settings)
          │ chrome.runtime.connectNative
          ▼
ChessistEngine.exe  (two modes, one binary)
 ├── [host-bridge mode]  ← Chrome native-messaging invocation
 │     • stdin/stdout length-prefixed JSON loop
 │     • launch / restart / kill the normal-mode instance
 │     • mutex check for is-running
 └── [normal mode]  ← user / startup invocation
       ├── WebSocket server  ws://127.0.0.1:27301
       │     • receives {type:'evaluate', fen, depth, multiPv} from extension
       │     • receives {type:'set_option', name, value} from extension
       │     • broadcasts {type:'eval', data:{...}} to all clients
       ├── StockfishManager  (unchanged process management)
       ├── OverlayForm  (transparent WebView2 host, click-through)
       │     • Win32 window positioning (unchanged)
       │     • posts render JSON to React via WebView2 bridge
       └── React+Vite app  (WebView2, served from local files)
             • EvalBar component
             • ArrowOverlay component (canvas)
             • receives render data via window.chrome.webview messages
```

---

## Repository Structure (after reorganization)

```
Chessist/                         ← extension root ("Load unpacked" points here)
├── manifest.json                 ← "key" added for pinned ID
├── README.md  CHANGELOG.md  .gitignore  LICENSE
├── setup.bat                     ← fully non-interactive, no Python required
├── icons/
├── src/
│   ├── content/  content.js  lichess.js  content.css
│   ├── background/  service-worker.js
│   ├── popup/  popup.html  popup.js  popup.css
│   └── options/  options.html  options.js  options.css
├── engine/                       ← renamed from overlay/
│   ├── ChessistEngine.csproj     ← renamed from ChessistOverlay.csproj
│   ├── Program.cs  app.manifest
│   └── bin/Release/net48/
│        ├── ChessistEngine.exe   ← committed (prebuilt)
│        ├── ChessistEngine.exe.config
│        └── stockfish.exe        ← committed (bundled)
├── host/                         ← renamed from native-host/
│   └── com.chessist.engine.json  ← renamed manifest, pinned extension ID
├── ui/                           ← NEW: React+Vite source
│   ├── src/  App.tsx  main.tsx  components/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── scripts/                      ← moved from dev/ + root
│   ├── start.bat
│   ├── start_debug.bat
│   └── rebuild.bat
└── Chessist.sln                  ← updated path reference
```

**Deleted files:**
- `logo.png` — unreferenced leftover
- `INSTANT_MOVE_FEATURE.md` — stale dev note
- `native-host/stockfish_host.py`, `native-host/stockfish_host.bat`
- `src/engine/` (stockfish.js, stockfish.wasm)
- `src/offscreen/` (offscreen.html, offscreen.js)
- `start.bat` (root) — moved to `scripts/`
- `dev/` directory — contents moved to `scripts/`

**Stopped tracking (gitignore additions):**
- `engine/bin/Release/net48/*.pdb`
- `engine/bin/Release/net48/*.ini`
- `engine/bin/Release/net48/*.log`
- `engine/bin/Release/net48/ChessistOverlay.log`

---

## Extension ID Pinning

Generate a 2048-bit RSA keypair. Embed the DER-encoded public key (base64) in `manifest.json` as `"key"`. Chrome derives a deterministic extension ID from this key — the same ID on every machine, every install.

The `host/com.chessist.engine.json` `allowed_origins` hardcodes this ID, so setup.bat needs no user input.

The private key is **not** committed to the repo.

---

## ChessistEngine.exe — HostBridge Mode

Chrome passes the calling extension's origin (`chrome-extension://<ID>/`) as an argument when launching a native-messaging host. `Main()` detects this:

```csharp
bool isHost = Array.Exists(args, a =>
    a.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase) ||
    a.Equals("-host", StringComparison.OrdinalIgnoreCase));
if (isHost) { HostBridge.Run(); return; }
```

`HostBridge.Run()` performs the stdio length-prefixed JSON loop (4-byte LE length + UTF-8 JSON), handling messages: `launch`, `restart`, `kill`, `quit`.

A named mutex `"ChessistEngineInstance"` (session-scoped):
- Normal mode acquires it on startup; second instance exits immediately.
- HostBridge checks `Mutex.TryOpenExisting` to answer "is engine running?".

---

## ChessistEngine.exe — Normal Mode Changes

### OverlayForm: WebView2 replaces GDI+

- NuGet: `Microsoft.Web.WebView2` (latest stable)
- `OverlayForm` no longer does any GDI+ drawing.
- The form hosts a `WebView2` control that fills it, with transparent background.
- Window transparency: `WS_EX_LAYERED | WS_EX_TRANSPARENT` (click-through, unchanged Win32 approach). `SetLayeredWindowAttributes(LWA_COLORKEY, ColorKey=Color.Black)` makes the form background transparent. WebView2 `DefaultBackgroundColor = Color.FromArgb(0,0,0,0)`.
- Navigates to the bundled React app via virtual host: `SetVirtualHostNameToFolderMapping("chessist.local", uiPath, HostResourceAccessKind.Allow)` → `Navigate("https://chessist.local/index.html")`.

### OverlayForm.Apply() — new behaviour

When `WsServer` receives an overlay message (no `Type` field), it calls `OverlayForm.Apply(msg)`:
1. Move/resize the native window (Win32, unchanged).
2. Serialize the render payload and post to React:
   ```csharp
   var render = new { visible=msg.Visible, flipped=msg.Flipped,
                       evalBar=msg.EvalBar, arrows=msg.Arrows };
   _webView.CoreWebView2.PostWebMessageAsString(JsonSerialize(render));
   ```

### StockfishManager.FindStockfish()

Remove stale candidate `..\..\..\..\native-host\stockfish.exe`. Priority order:
1. `stockfish.exe` (same dir as exe — the bundled one)
2. `stockfish\stockfish.exe`
3. PATH lookup via `where stockfish`
4. Common install paths

---

## React+Vite UI (`ui/`)

Tech: React 18, TypeScript, Vite, no external UI library.

### Communication

React receives render data via the WebView2 native message bridge:
```typescript
// in App.tsx
window.chrome?.webview?.addEventListener('message', (e: MessageEvent) => {
  const state: RenderState = JSON.parse(e.data);
  setRenderState(state);
});
```

No WebSocket in the React app — C# posts directly.

### RenderState type

```typescript
interface RenderState {
  visible: boolean;
  flipped: boolean;
  evalBar: { fillPercent: number; isFlipped: boolean; score: string } | null;
  arrows: Array<{ from: string; to: string }>;  // algebraic squares e.g. "e2","e4"
}
```

### EvalBar

Vertical bar on the left edge of the window. White fills from top when winning, black from bottom. Score text centered. Matches current GDI+ visual.

### ArrowOverlay

`<canvas>` positioned absolutely, fills the window. Arrow colors:
- Index 0: purple (best move)
- Index 1: yellow (2nd best)
- Index 2: red (3rd best)

Square-to-pixel (board fills the entire WebView2 window):
```typescript
function sqCenter(sq: string, w: number, h: number, flipped: boolean): [number, number] {
  const file = sq.charCodeAt(0) - 97;  // a=0..h=7
  const rank = parseInt(sq[1]) - 1;    // 1=0..8=7
  const sqW = w / 8, sqH = h / 8;
  const x = flipped ? (7 - file + 0.5) * sqW : (file + 0.5) * sqW;
  const y = flipped ? (rank + 0.5) * sqH      : (7 - rank + 0.5) * sqH;
  return [x, y];
}
```

Arrow: line + filled triangle arrowhead, 20% square-width stroke, semi-transparent fill.

### Build output

Vite builds to `ui/dist/`. The rebuild script copies `ui/dist/` → `engine/bin/Release/net48/ui/` so it's next to the exe. C# maps `engine/bin/Release/net48/ui/` as the virtual host folder.

---

## Extension Changes

### manifest.json

- Add `"key": "<base64-der-public-key>"`
- Remove `"offscreen"` from permissions
- Remove `src/engine/*` and `src/offscreen/*` from `web_accessible_resources` (keep `icons/*`)

### service-worker.js

**Removed:** offscreen creation, WASM eval path, `EVALUATE`/`EVAL_UPDATE`/`BEST_MOVE`/`OFFSCREEN_READY`/`FORCE_RESTART_ENGINE` handlers, FEN board manipulation helpers, position/PV caches.

**Added:** `chrome.runtime.onStartup` + `chrome.runtime.onConnect` → `connectNative()` + `{type:'launch'}` (auto-launch on page load).

**Kept:** `LAUNCH_ENGINE`, `RESTART_OVERLAY`, `KILL_ENGINE`, `EXECUTE_MOVE`, `WS_EVAL_UPDATE` relay, `SET_DEPTH`, `GET_LAST_EVAL`, `broadcastToContentScripts`.

**Settings forwarding:** `SET_SKILL_LEVEL`, `SET_ELO`, `SET_MULTIPV`, `STOP_ANALYSIS`, `RESET_ENGINE` → `broadcastToContentScripts` so content scripts forward to WS as `set_option` / `stop`.

### content.js + lichess.js

- Remove WASM fallback branch (`chrome.runtime.sendMessage({type:'EVALUATE'})`) and `EVAL_RESULT` listener.
- On WS message `SET_SKILL_LEVEL` → `_overlayWs.send({type:'set_option', name:'Skill Level', value})`.
- On WS message `SET_ELO` → send `UCI_LimitStrength` + `UCI_Elo` options.
- On WS message `SET_MULTIPV` → `_overlayWs.send({type:'set_option', name:'MultiPV', value})`.
- On WS message `STOP_ANALYSIS` → `_overlayWs.send({type:'stop'})`.
- On WS message `RESET_ENGINE` → `_overlayWs.send({type:'stop'})` + clear local caches.
- On WS connect: read settings from `chrome.storage.sync` and send current skill/ELO/multipv as `set_option`.
- When WS not open: trigger `chrome.runtime.sendMessage({type:'LAUNCH_ENGINE'})` + show "starting engine…" state.

### popup.html / popup.js

- Remove "Falls back to built-in WASM engine…" description text.
- "Force Restart Engine" (WASM restart) → "Restart Engine", sends `RESTART_OVERLAY`.
- Engine status states: `not_running` → `starting` → `connected` (no WASM fallback state).

---

## setup.bat — Zero Prompts

```
1. Resolve absolute paths (ROOT_DIR from %~dp0)
2. Write host/com.chessist.engine.json with absolute engine path + hardcoded pinned ID
3. Register HKCU NativeMessagingHosts key for Chrome + Brave + Edge
4. Done — no Python, no ID prompt, no Stockfish step
```

Optional `--startup` flag: `setup.bat --startup` adds ChessistEngine.exe to Windows startup.

---

## Frictionless Install Flow

```
1. git clone  (exe + stockfish.exe already present in engine/bin/Release/net48/)
2. chrome://extensions → Load unpacked → select Chessist folder  (ID is fixed)
3. setup.bat  (no prompts, ~2 seconds)
4. Open chess.com / lichess — engine auto-launches, WS connects, eval appears
```

---

## Error Handling

- **WebView2 runtime missing** → `CoreWebView2InitializationCompleted` handler shows a message box with download link; overlay falls back to hidden.
- **Exe missing** → HostBridge replies `{success:false, error:'ChessistEngine.exe not found'}`; popup shows build instructions.
- **Stockfish not found by exe** → existing `engine_status: error` broadcast; popup shows error.
- **Engine crash / WS drop** → content.js reconnects every 3 s; on repeated failure re-sends `LAUNCH_ENGINE` (backoff after 3 attempts).
- **Duplicate instance** → named mutex; second normal-mode exe exits silently.

---

## Out of Scope

- Puzzle-mode code stays commented-out.
- Version not bumped (stays 1.3.0) unless requested.
- Edge browser NativeMessagingHosts registry key added as a bonus (same path).
