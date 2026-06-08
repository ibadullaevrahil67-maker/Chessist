const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
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

// ── Engine settings persistence (userData/chessist-settings.json) ──────────────
function settingsPath() { return path.join(app.getPath('userData'), 'chessist-settings.json') }
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) } catch { return {} }
}
function saveSettings(obj) {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2)) } catch {}
}

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
    width: 900, height: 600, minWidth: 720, minHeight: 480,
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
  // Restore saved engine settings before first start (applied on uciok).
  Object.assign(engine.settings, loadSettings())
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
  ipcMain.on('window:close', () => mainWindow?.close())
  ipcMain.handle('status:get', () => componentStatus)
  ipcMain.handle('engine:get', () => engine?.getSettings() ?? {})
  ipcMain.handle('engine:set', (_e, { key, value }) => {
    engine?.applySetting(key, value)
    if (engine) saveSettings(engine.getSettings())
    return engine?.getSettings() ?? {}
  })
  ipcMain.handle('stockfish:redownload', () => redownloadStockfish())
  ipcMain.handle('shell:open', (_e, url) => { try { shell.openExternal(url) } catch {} })
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
