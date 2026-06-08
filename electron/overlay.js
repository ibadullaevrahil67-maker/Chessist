const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

function resolveOverlayExe(isDev, resourcesPath) {
  const devPath = path.join(__dirname, '..', 'overlay', 'bin', 'Release', 'net48', 'ChessistOverlay.exe')
  const prodPath = path.join(resourcesPath, 'overlay', 'ChessistOverlay.exe')
  if (isDev && fs.existsSync(devPath)) return devPath
  if (fs.existsSync(prodPath)) return prodPath
  if (fs.existsSync(devPath)) return devPath
  return null
}

class Overlay {
  constructor(isDev, resourcesPath, onStatus) {
    this.exe = resolveOverlayExe(isDev, resourcesPath)
    this.onStatus = onStatus
    this.proc = null
  }

  available() { return !!this.exe }

  start() {
    if (this._killed) return
    if (!this.exe) { this.onStatus?.({ overlayOk: false }); return }
    this.proc = spawn(this.exe, [], { windowsHide: true })
    this.proc.on('exit', () => {
      this.proc = null
      this.onStatus?.({ overlayOk: false })
      if (!this._killed) setTimeout(() => this.start(), 1500)
    })
    this.onStatus?.({ overlayOk: true })
  }

  draw(payload) {
    if (!this.proc || !this.proc.stdin.writable) return
    try { this.proc.stdin.write(JSON.stringify(payload) + '\n') } catch {}
  }

  kill() {
    this._killed = true
    if (this.proc) { try { this.proc.stdin.write('{"type":"quit"}\n') } catch {} ; try { this.proc.kill() } catch {} }
  }
}

module.exports = { Overlay, resolveOverlayExe }
