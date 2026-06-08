const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chessist', {
  isDesktop: true,
  platform: process.platform,
  getStatus: () => ipcRenderer.invoke('status:get'),
  getEngineSettings: () => ipcRenderer.invoke('engine:get'),
  setEngineOption: (key, value) => ipcRenderer.invoke('engine:set', { key, value }),
  getGameSettings: () => ipcRenderer.invoke('game:get'),
  setGameOption: (key, value) => ipcRenderer.invoke('game:set', { key, value }),
  redownloadStockfish: () => ipcRenderer.invoke('stockfish:redownload'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  getExtensionPath: () => ipcRenderer.invoke('extension:path'),
  revealExtensionFolder: () => ipcRenderer.invoke('extension:reveal'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onStatus: (cb) => {
    const h = (_e, payload) => cb(payload)
    ipcRenderer.on('status', h)
    return () => ipcRenderer.removeListener('status', h)
  },
  onEval: (cb) => {
    const h = (_e, payload) => cb(payload)
    ipcRenderer.on('eval', h)
    return () => ipcRenderer.removeListener('eval', h)
  },
  onPosition: (cb) => {
    const h = (_e, payload) => cb(payload)
    ipcRenderer.on('position', h)
    return () => ipcRenderer.removeListener('position', h)
  },
})
