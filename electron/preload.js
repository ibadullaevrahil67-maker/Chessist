const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chessist', {
  isDesktop: true,
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
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
})
