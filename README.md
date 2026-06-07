<p align="center">
  <img src="icons/icon128.png" alt="Chessist Logo" width="128" height="128">
</p>

<h1 align="center">Chessist</h1>

<p align="center">
  A Chromium extension that adds a live evaluation bar to Chess.com and Lichess games, powered by Stockfish.
  <br>
  <strong>Created by <a href="https://github.com/lurimous/">lurimous</a></strong>
</p>

<p align="center">
  <a href="https://github.com/lurimous/Chessist">GitHub</a> •
  <a href="https://discord.gg/2WgHtrgqZm">Discord</a> •
  <a href="https://ko-fi.com/imluri">Ko-fi</a>
</p>

---

## Compatibility

| | Supported |
|---|---|
| **Browsers** | Chrome, Brave, Edge (Chromium-based) |
| **Sites** | Chess.com, Lichess.org |
| **OS** | Windows 10 / 11 |
| **Overlay Mode** | Windows only (native .exe) |

---

## Screenshots

<p align="center">
  <img src="ss1.png" alt="Chessist eval bar and settings popup" width="700">
  <br><br>
  <img src="ss2.png" alt="Chessist in a live game with native engine" width="700">
</p>

## Features

- Real-time position evaluation bar (Chess.com and Lichess)
- Score in pawns format (e.g., +1.5) with depth indicator
- Best move arrow — plus optional alternative move arrows
- **Overlay Mode** — transparent native window drawn over the board, invisible to screen capture
- Works on live games, spectating, analysis, and archived games
- Auto-move and smart timing
- Configurable engine depth and skill level
- Native Stockfish support for 10–100× faster analysis
- Runs entirely locally — no server, no account required

---

## Quick Start

### 1. Clone

```
git clone https://github.com/lurimous/Chessist.git
```

### 2. Load the extension

1. Go to `chrome://extensions` (or `brave://extensions`)
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked** → select the `Chessist` folder

### 3. Run setup (once)

Double-click **`setup.bat`** — no prompts, takes ~2 seconds.

### 4. Play

Open any game on [chess.com](https://www.chess.com) or [lichess.org](https://lichess.org). The engine starts automatically.

---

## Overlay Mode

Overlay Mode renders the evaluation bar and move arrows in a **transparent native window** that sits on top of the browser. The browser-side UI is hidden, making Chessist invisible to screen capture and recording tools.

### Starting the overlay

The overlay launches automatically when you enable Overlay Mode — or run manually:

```
start.bat
```

The overlay minimizes to the **system tray** (bottom right). Right-click → Quit to exit.

### Overlay status

When Overlay Mode is enabled the popup shows a live status dot:

- 🟢 **Overlay connected** — overlay is running and receiving data
- 🔴 **Overlay not running** — run `start.bat` to launch it

### Updates

The overlay checks for updates on startup. A tray notification appears if a newer version is available on GitHub.

---

## Configuration

| Setting | Description |
|---|---|
| **Skill Level** | 1–20. Lower values allow occasional suboptimal moves |
| **Engine Depth** | How deep Stockfish searches (higher = stronger, slower) |
| **Show Best Move** | Draw an arrow for the top engine move |
| **Show Alternative Arrows** | Draw arrows for 2nd and 3rd best moves |
| **Auto Move** | Automatically play the best move |
| **Overlay Mode** | Use transparent native window instead of browser UI |
| **Player Color** | Auto-detect, or force White/Black perspective |

---

## Project Structure

```
Chessist/
├── setup.bat               # First-time setup (run once)
├── manifest.json
├── src/
│   ├── content/            # Board detection + eval display
│   ├── background/         # Service worker (engine launcher)
│   ├── popup/              # Extension popup
│   └── options/
├── engine/                 # ChessistEngine source + binaries
│   ├── ChessistEngine.csproj
│   ├── Program.cs
│   └── bin/Release/net48/
│        ├── ChessistEngine.exe   # Native engine + overlay + WebSocket server
│        ├── stockfish.exe        # Bundled Stockfish (GPL)
│        └── ui/                  # Built React status panel
├── host/                   # Native messaging host manifest
├── ui/                     # React+Vite status panel source
├── scripts/                # Dev helper scripts
└── icons/
```

---

## Troubleshooting

**Eval bar doesn't appear**
- Make sure you're on chess.com or lichess.org
- Refresh the page
- Check the extension is enabled in `chrome://extensions`

**Engine not connecting**
- Run `setup.bat` (only needed once after cloning)
- Reload the extension in chrome://extensions

**Overlay not showing**
- Check the tray icon area (click `^` in the taskbar corner)
- Run `start.bat` manually and check for errors in the console
- Windows Defender may flag the exe — if so, allow it or build from source: `dotnet build overlay\ChessistOverlay.csproj -c Release`

**"Extension context invalidated" error**
- Refresh the chess page — this happens when Chrome restarts the service worker after a long session

---

## Credits

- Created by [lurimous](https://github.com/lurimous/)
- [Stockfish](https://stockfishchess.org/) is GPL-licensed and bundled for convenience ([source](https://github.com/official-stockfish/Stockfish))

## License

MIT
