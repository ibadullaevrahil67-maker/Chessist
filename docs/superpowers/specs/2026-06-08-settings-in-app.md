# Move settings into the desktop app; extension shows connectivity only

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Core settings first (depth, skill, ELO, arrows, auto-move + timing, render mode, player color). Niche settings (W/L balance, auto-rematch, stealth, move icons, manual-map offsets) migrate in a follow-up.

---

## Goal

Make the Chessist **desktop app the single settings authority**. The browser extension becomes a
thin client: its popup shows only connectivity, and its content scripts obey settings pushed from
the app over the existing WebSocket. The extension's settings popup controls and options page are
removed.

---

## Architecture

- **App owns + persists all settings** (`userData/chessist-settings.json`, `{ engine, game }`).
- **Engine params** (skill, ELO, threads, hash) are applied to Stockfish directly in the app
  (already done by the Engine page).
- **Game/display settings** (depth, arrows, auto-move + timing, render mode, player color, master
  enable) are pushed to the extension over WS as `{ type: 'settings', data: {...} }`:
  - on extension connect (right after `identify`), and
  - on every change from the app's Game page.
- The **extension content scripts** apply the pushed settings to their existing module vars
  (reusing the same re-apply operations as the current `SETTINGS_UPDATED` path) and keep sending
  `depth`/`multiPv` in evaluate requests — now sourced from the pushed settings rather than
  `chrome.storage`.
- The **extension popup** becomes a connectivity indicator. The **options page is removed**.

### Settings data contract (game)

```js
{
  enabled: true,                 // master on/off
  depth: 18,                     // target search depth (sent in evaluate)
  showBestMove: false,
  showOpponentBestMove: false,
  showAltArrows: true,           // also drives MultiPV 3 vs 1 in the evaluate request
  autoMove: false,
  instantMove: false,
  autoMoveDelayMin: 0.1,         // seconds
  autoMoveDelayMax: 0.3,
  renderMode: 'overlay',         // 'overlay' | 'browser'  (overlay → overlayMode=true)
  playerColor: 'auto',           // 'auto' | 'white' | 'black'
}
```

Engine params (skill, ELO, threads, hash) stay in the existing engine-settings object/page.

---

## Components

### electron/wsserver.js
- On `identify` from an extension client, immediately send `{ type:'settings', data }` using a
  `getGameSettings()` provider supplied by main.
- Add `broadcastSettings(data)` to push to all extension clients on change.

### electron/main.js
- Add `gameSettings` (defaults above), loaded from `chessist-settings.json` `game` key.
- Restructure persistence to `{ engine: {...}, game: {...} }`.
- IPC: `game:get` → returns gameSettings; `game:set` ({key,value}) → update + persist + broadcast.
- Give the bridge `getGameSettings = () => gameSettings`.

### src/pages/GamePage.jsx (new sidebar item "Game")
- Controls: master Enable, Depth (10–30), Show best move, Show opponent's best move, Show
  alternative arrows, Auto-move, Instant move, auto-move delay min/max, Render mode (overlay /
  in-page), Player color (auto / white / black).
- Loads via `getGameSettings()`, writes via `setGameOption(key, value)` (IPC), updates live.
- Sidebar gains a "Game" entry (between Evaluation and Engine).

### extension/src/content/content.js + lichess.js
- Add a WS handler: when `{ type:'settings', data }` arrives, apply each core field to the existing
  module vars and run the same re-apply operations the `SETTINGS_UPDATED` handler does
  (`renderMode==='overlay'` → `overlayMode=true`; re-detect player color; re-eval on depth change;
  toggle in-page eval bar vs overlay; clear/redraw arrows).
- Evaluate requests keep sending `depth`/`multiPv` but sourced from these (already do).
- `chrome.storage` reads in `loadSettings()` remain as the initial defaults; the app's push
  overrides them once connected. (Niche settings still come from storage until the follow-up.)

### extension/src/popup/ (connectivity only)
- `popup.html` / `popup.js` reduced to: a status dot + "Connected to Chessist" / "Not connected",
  app name/version, and a short hint to open the desktop app. It checks connectivity by opening a
  WebSocket to `ws://127.0.0.1:27301` (closes immediately after).
- All settings controls removed. `popup.css` trimmed.

### extension/manifest.json
- Remove the `options_ui` entry. Delete `extension/src/options/`.

---

## Out of scope (follow-up)
- Niche settings: W/L balance, auto-rematch / auto-new-game, stealth mode, move-classification
  icons, smart timing, accuracy target, manual-map overlay offsets. These keep their current
  storage-based behavior (no UI in the extension anymore, but defaults still load) until migrated.

---

## Error / edge handling
- Extension not connected → app Game page still edits + persists; values apply when it connects.
- App pushes settings on connect, so a freshly loaded content script syncs immediately.
- `renderMode: 'browser'` → content script draws the in-page eval bar/arrows and stops sending
  overlay draw payloads; `'overlay'` → hides in-page UI and drives the native overlay (current
  behavior).
