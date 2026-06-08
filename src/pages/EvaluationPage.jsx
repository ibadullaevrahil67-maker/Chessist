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
  const connected = status.chessConnected        // a chess tab is active
  const boardFen = pos?.fen || ev?.fen || START_FEN
  const flipped = !!pos?.flipped
  const hasPosition = !!(pos?.fen || ev?.fen)

  const evalMatches = ev?.fen && (!pos?.fen || piecesKey(ev.fen) === piecesKey(pos.fen))
  const arrows = (connected && ev && evalMatches) ? arrowsFromEval(ev) : []

  // Disconnected (no chess tab) → grayscale + dim. No game yet but connected → light dim.
  const boardOpacity = !connected ? 0.45 : (hasPosition ? 1 : 0.4)
  const boardFilter = !connected ? 'grayscale(1)' : (hasPosition ? 'none' : 'grayscale(0.4)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' }}>
      {/* header: eval panel or status line */}
      <div style={{ flexShrink: 0 }}>
        {connected && ev && evalMatches
          ? <EvalPanel ev={ev} />
          : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'rgb(var(--status-yellow))' : 'rgb(var(--status-red))' }} />
              <span style={{ color: connected ? 'rgb(var(--fg-muted))' : 'rgb(var(--status-red))', fontWeight: 600 }}>
                {connected ? 'Analyzing…' : 'Disconnected'}
              </span>
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
        {!connected
          ? 'No chess tab. Open a game on chess.com or lichess.org.'
          : !hasPosition
          ? 'Connected — make a move to start analysis.'
          : ''}
      </div>
    </div>
  )
}
