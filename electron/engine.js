const { spawn } = require('child_process')
const os = require('os')

function parseInfoLine(line) {
  const out = {}
  const depth = line.match(/\bdepth (\d+)/);            if (depth) out.depth = +depth[1]
  const mpv = line.match(/\bmultipv (\d+)/);            if (mpv) out.multipv = +mpv[1]
  const mate = line.match(/\bscore mate (-?\d+)/)
  const cp = line.match(/\bscore cp (-?\d+)/)
  if (mate) out.mate = +mate[1]
  else if (cp) out.cp = +cp[1]
  const nps = line.match(/\bnps (\d+)/);                if (nps) out.nps = +nps[1]
  const pv = line.match(/ pv (.+)$/)
  if (pv) { out.pv = pv[1].trim().split(/\s+/); out.bestMove = out.pv[0] }
  return (out.cp !== undefined || out.mate !== undefined) ? out : null
}

function defaultHashMb() {
  const freeMb = Math.floor(os.totalmem() / (1024 * 1024))
  return Math.max(128, Math.min(1024, Math.floor(freeMb / 8)))
}

class Engine {
  constructor(onEval, onStatus, opts = {}) {
    this.onEval = onEval
    this.onStatus = onStatus
    this.proc = null
    this.ready = false
    this.depth = 18
    this.multipv = 1
    this.curFen = null
    this.pvSlots = {}
    this.hashMb = opts.hashMb || defaultHashMb()
    this.threads = opts.threads || Math.max(1, os.cpus().length - 1)
  }

  start(stockfishPath) {
    this.proc = spawn(stockfishPath, [], { windowsHide: true })
    this.proc.stdout.setEncoding('utf8')
    let buf = ''
    this.proc.stdout.on('data', (chunk) => {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        this._handle(line)
      }
    })
    this.proc.on('exit', () => { this.ready = false; this.onStatus?.({ status: 'error', message: 'Stockfish exited' }) })
    this._send('uci')
  }

  _send(cmd) { this.proc?.stdin.write(cmd + '\n') }

  _handle(line) {
    if (line === 'uciok') {
      this._send(`setoption name Threads value ${this.threads}`)
      this._send(`setoption name Hash value ${this.hashMb}`)
      this._send('setoption name MultiPV value 1')
      this._send('isready')
      return
    }
    if (line === 'readyok') {
      this.ready = true
      this.onStatus?.({ status: 'ready', message: 'Engine ready' })
      return
    }
    if (line.startsWith('info depth')) {
      const ev = parseInfoLine(line)
      if (!ev || (ev.depth || 0) < 5) return
      const slot = ev.multipv || 1
      this.pvSlots[slot] = ev
      if (slot !== 1) return
      ev.fen = this.curFen
      ev.turn = this.curFen ? (this.curFen.split(' ')[1] || 'w') : 'w'
      ev.multiPvMoves = [1, 2, 3].map(i => this.pvSlots[i]?.pv?.[0]).filter(Boolean)
      this.onEval?.(ev)
    }
  }

  evaluate(fen, depth, multipv) {
    if (!this.ready) return
    if (depth) this.depth = depth
    if (multipv && multipv !== this.multipv) { this.multipv = multipv; this._send(`setoption name MultiPV value ${multipv}`) }
    this.curFen = fen
    this.pvSlots = {}
    this._send('stop')
    this._send('position fen ' + fen)
    this._send('go depth ' + this.depth)
  }

  newGame() {
    if (!this.ready) return
    this._send('stop')
    this._send('ucinewgame')
    this._send('isready')
    this.curFen = null
    this.pvSlots = {}
  }

  setOption(name, value) { this._send(`setoption name ${name} value ${value}`) }
  stop() { this._send('stop') }
  kill() { try { this.proc?.kill() } catch {} }
}

module.exports = { parseInfoLine, defaultHashMb, Engine }
