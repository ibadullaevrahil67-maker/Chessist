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
3. Go to the app's **Setup** tab and follow the **Browser Extension** guide — it reveals the bundled
   extension folder and walks you through `chrome://extensions` → Developer mode → **Load unpacked**.
4. Open a game on chess.com or lichess.org — the Setup tab flips Extension to *connected*.

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
