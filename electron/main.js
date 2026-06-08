const { app, BrowserWindow, ipcMain, Menu, shell, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const { ensureStockfish } = require('./stockfish')
const { Engine } = require('./engine')
const { Overlay } = require('./overlay')
const { Bridge } = require('./wsserver')

const isDev = !app.isPackaged
let mainWindow = null
let engine = null
let overlay = null
let bridge = null

// ── Settings persistence (userData/chessist-settings.json = { engine, game }) ──
// Game/display settings owned by the app and pushed to the extension over WS.
const gameSettings = {
  enabled: true,
  depth: 18,
  showBestMove: false,
  showOpponentBestMove: false,
  showAltArrows: true,
  autoMove: false,
  instantMove: false,
  autoMoveDelayMin: 0.1,
  autoMoveDelayMax: 0.3,
  renderMode: 'overlay',   // 'overlay' | 'browser' | 'electron'
  playerColor: 'auto',     // 'auto' | 'white' | 'black'
  // ── niche / advanced ──
  showMoveIcon: false,     // move-classification icons on the board
  smartTiming: true,       // human-like auto-move timing
  autoRematch: false,
  autoNewGame: false,
  stealthMode: true,       // suppress console logs
  wlBalance: false,        // win/loss balancing
  maxConsecutiveWins: 2,
  maxConsecutiveLosses: 3,
  throwRandom: false,      // randomly throw games
  lossRandom: false,
  targetAccuracy: 100,     // target move accuracy %
}

function settingsPath() { return path.join(app.getPath('userData'), 'chessist-settings.json') }
function loadAll() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) || {} } catch { return {} }
}
function saveAll() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify({ engine: engine?.getSettings() ?? {}, game: gameSettings }, null, 2))
  } catch {}
}

const componentStatus = {
  stockfishOk: false,
  overlayOk: false,
  extensionConnected: false,
  message: '',
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function pushStatus(patch) {
  Object.assign(componentStatus, patch)
  sendToRenderer('status', componentStatus)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 600, minWidth: 720, minHeight: 480,
    title: 'Chessist', backgroundColor: '#000000',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
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
  mainWindow.on('closed', () => { mainWindow = null })
}

async function startSubsystems() {
  overlay = new Overlay(isDev, process.resourcesPath, (s) => pushStatus(s))
  engine = new Engine(
    (ev) => { bridge?.broadcastEval(ev); sendToRenderer('eval', ev) },
    (s) => {
      if (s.status === 'ready') pushStatus({ stockfishOk: true, message: '' })
      else if (s.status === 'error') pushStatus({ stockfishOk: false, message: s.message })
      else pushStatus({ message: s.message })
      bridge?.broadcastStatus(s)
    }
  )
  // Restore saved settings before first start (engine applied on uciok).
  const saved = loadAll()
  Object.assign(engine.settings, saved.engine || {})
  Object.assign(gameSettings, saved.game || {})
  bridge = new Bridge(engine, overlay, (c) => pushStatus(c))
  bridge.getGameSettings = () => gameSettings
  bridge.onPosition = (p) => sendToRenderer('position', p)
  bridge.start()
  overlay.start()

  const userData = app.getPath('userData')
  const sfPath = await ensureStockfish(userData, (s) => {
    pushStatus({ message: s.message, stockfishOk: s.status === 'ready' })
    bridge?.broadcastStatus(s)
  })
  if (sfPath) engine.start(sfPath)
}

async function redownloadStockfish() {
  engine?.kill()
  const dest = path.join(app.getPath('userData'), 'stockfish.exe')
  try { fs.rmSync(dest, { force: true }) } catch {}
  pushStatus({ stockfishOk: false, message: 'Stockfish: re-downloading...' })
  const sfPath = await ensureStockfish(app.getPath('userData'), (s) => {
    pushStatus({ message: s.message, stockfishOk: s.status === 'ready' })
    bridge?.broadcastStatus(s)
  })
  if (sfPath) engine.start(sfPath)
}

function registerIpc() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('status:get', () => componentStatus)
  ipcMain.handle('engine:get', () => engine?.getSettings() ?? {})
  ipcMain.handle('engine:set', (_e, { key, value }) => {
    engine?.applySetting(key, value)
    saveAll()
    return engine?.getSettings() ?? {}
  })
  ipcMain.handle('game:get', () => gameSettings)
  ipcMain.handle('game:set', (_e, { key, value }) => {
    if (key in gameSettings) gameSettings[key] = value
    saveAll()
    bridge?.broadcastSettings(gameSettings)
    return gameSettings
  })
  ipcMain.handle('stockfish:redownload', () => redownloadStockfish())
  ipcMain.handle('shell:open', (_e, url) => { try { shell.openExternal(url) } catch {} })
  ipcMain.handle('extension:path', () => extensionDir())
  ipcMain.handle('extension:reveal', () => { try { return shell.openPath(extensionDir()) } catch { return '' } })
  ipcMain.handle('clipboard:write', (_e, text) => { try { clipboard.writeText(String(text)) } catch {} })
}

// The bundled (or repo) browser-extension folder users load unpacked.
function extensionDir() {
  return isDev
    ? path.join(__dirname, '..', 'extension')
    : path.join(process.resourcesPath, 'extension')
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
