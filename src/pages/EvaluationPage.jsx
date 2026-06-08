import EvalPanel from '../components/EvalPanel'
import Board from '../components/Board'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const piecesKey = (fen) => (fen ? fen.split(' ')[0] : '')

function arrowsFromEval(ev) {
  const moves = (ev.multiPvMoves && ev.multiPvMoves.length) ? ev.multiPvMoves : (ev.bestMove ? [ev.bestMove] : [])
  return moves
    .filter(m => typeof m === 'string' && m.length >= 4)
    .slice(0, 3)
    .map((m, i) => ({ from: m.slice(0, 2), to: m.slice(2, 4), idx: i }))
}

export default function EvaluationPage({ ev, pos, status }) {
  const chessOn = status.chessConnected        // a chess tab is active
  const extOn = status.extensionConnected      // extension installed (service worker)
  const boardFen = pos?.fen || ev?.fen || START_FEN
  const flipped = !!pos?.flipped
  const hasPosition = !!(pos?.fen || ev?.fen)

  const evalMatches = ev?.fen && (!pos?.fen || piecesKey(ev.fen) === piecesKey(pos.fen))
  const showEval = chessOn && ev && evalMatches
  const arrows = showEval ? arrowsFromEval(ev) : []

  // Three states: live game · extension up but no game · nothing connected.
  // dot/label/hint reflect which.
  const site = status.chessSite || 'a chess site'
  let dot, label, labelColor, hint
  if (chessOn) {
    dot = 'rgb(var(--status-yellow))'; labelColor = 'rgb(var(--fg-muted))'
    label = hasPosition ? 'Analyzing…' : `On ${site}`
    hint = hasPosition ? '' : `You're on ${site} — start a game to see analysis.`
  } else if (extOn) {
    dot = 'rgb(var(--status-yellow))'; labelColor = 'rgb(var(--fg-muted))'; label = 'Connected to extension'
    hint = "Connected to the extension, but couldn't detect a game. Open a game on chess.com or lichess.org."
  } else {
    dot = 'rgb(var(--status-red))'; labelColor = 'rgb(var(--status-red))'; label = 'Disconnected'
    hint = 'No connection. Open the Setup tab to load the extension, then open a game.'
  }

  // Board greys out whenever there's no live game; fully grey when nothing is connected.
  const boardOpacity = chessOn ? (hasPosition ? 1 : 0.5) : (extOn ? 0.6 : 0.4)
  const boardFilter = chessOn ? (hasPosition ? 'none' : 'grayscale(0.4)') : (extOn ? 'grayscale(0.85)' : 'grayscale(1)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' }}>
      {/* header: eval panel (live) or status line */}
      <div style={{ flexShrink: 0 }}>
        {showEval ? <EvalPanel ev={ev} /> : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
            <span style={{ color: labelColor, fontWeight: 600 }}>{label}</span>
          </div>
        )}
      </div>

      {/* board fills the remaining space, kept square and bounded by both axes */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: '100%', maxWidth: '100%', aspectRatio: '1 / 1', position: 'relative', opacity: boardOpacity, filter: boardFilter }}>
          <Board fen={boardFen} arrows={arrows} flipped={flipped} fill />
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 12, color: 'rgb(var(--fg-dim))', lineHeight: 1.6, minHeight: 18 }}>
        {hint}
      </div>
    </div>
  )
}
