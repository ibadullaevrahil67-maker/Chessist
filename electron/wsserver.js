const { WebSocketServer } = require('ws')

const PORT = 27301

// Routes messages between the browser extension and the engine/overlay.
class Bridge {
  constructor(engine, overlay, onComponent) {
    this.engine = engine
    this.overlay = overlay
    this.onComponent = onComponent
    this.wss = null
    this.extClients = new Set()
    this.getGameSettings = null // set by main: () => gameSettings
  }

  start() {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: PORT })
    this.wss.on('connection', (ws) => {
      ws.on('message', (raw) => this._onMessage(ws, raw))
      ws.on('close', () => {
        if (this.extClients.delete(ws)) this.onComponent?.({ extensionConnected: this.extClients.size > 0 })
      })
    })
    this.wss.on('error', (e) => this.onComponent?.({ wsError: e.message }))

    // Heartbeat: ping extension clients every 20s. Incoming WS messages keep the
    // MV3 service worker alive (idle timeout ~30s), so the presence connection — and
    // thus extension detection — stays continuous regardless of the active tab.
    this._ping = setInterval(() => {
      for (const ws of this.extClients) {
        if (ws.readyState === 1) { try { ws.send('{"type":"ping"}') } catch {} }
      }
    }, 20000)
  }

  _onMessage(ws, raw) {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.type === 'identify' && msg.role === 'extension') {
      this.extClients.add(ws)
      this.onComponent?.({ extensionConnected: true })
      // Push current game settings to the freshly connected extension.
      const data = this.getGameSettings?.()
      if (data) { try { ws.send(JSON.stringify({ type: 'settings', data })) } catch {} }
      return
    }
    if (msg.type === 'evaluate') { this.engine.evaluate(msg.fen, msg.depth, msg.multiPv); return }
    if (msg.type === 'set_option') { this.engine.setOption(msg.name, msg.value); return }
    if (msg.type === 'stop') { this.engine.stop(); return }
    // New game → reset the transposition table. Normal moves NEVER reset (hash is reused).
    if (msg.type === 'new_game') { this.engine.newGame(); return }
    // Overlay draw payload (no engine type) — has evalBar/arrows/positionOnly/visible
    if ('evalBar' in msg || 'arrows' in msg || 'positionOnly' in msg || 'visible' in msg) {
      this.overlay.draw(msg)
    }
  }

  broadcastEval(ev) {
    const data = JSON.stringify({ type: 'eval', data: ev })
    for (const ws of this.wss?.clients ?? []) {
      if (ws.readyState === 1) { try { ws.send(data) } catch {} }
    }
  }

  broadcastStatus(status) {
    const data = JSON.stringify({ type: 'engine_status', ...status })
    for (const ws of this.wss?.clients ?? []) {
      if (ws.readyState === 1) { try { ws.send(data) } catch {} }
    }
  }

  // Push game settings to every connected extension client.
  broadcastSettings(settings) {
    const data = JSON.stringify({ type: 'settings', data: settings })
    for (const ws of this.extClients) {
      if (ws.readyState === 1) { try { ws.send(data) } catch {} }
    }
  }

  stop() { try { clearInterval(this._ping) } catch {} ; try { this.wss?.close() } catch {} }
}

module.exports = { Bridge, PORT }
