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
  // Board is driven by the authoritative current position (pos) when we have it,
  // falling back to the eval's FEN, then the start position placeholder.
  const boardFen = pos?.fen || ev?.fen || START_FEN
  const flipped = !!pos?.flipped
  const isPlaceholder = !pos?.fen && !ev?.fen

  // Show arrows only when the eval matches the board we're displaying.
  const evalMatches = ev?.fen && (!pos?.fen || piecesKey(ev.fen) === piecesKey(pos.fen))
  const arrows = (ev && evalMatches) ? arrowsFromEval(ev) : []

  return (
    <div style={{ padding: 16 }}>
      {ev && evalMatches
        ? <EvalPanel ev={ev} />
        : (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgb(var(--border))', fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
            {status.extensionConnected ? 'Analyzing…' : 'Waiting for a game'}
          </div>
        )}

      <div style={{ marginTop: 16, opacity: isPlaceholder ? 0.35 : 1, filter: isPlaceholder ? 'grayscale(0.4)' : 'none' }}>
        <Board fen={boardFen} arrows={arrows} flipped={flipped} maxWidth={440} />
      </div>

      {isPlaceholder && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgb(var(--fg-dim))', lineHeight: 1.7 }}>
          {status.extensionConnected
            ? 'Connected — make a move on chess.com or lichess.org.'
            : 'Open a game on chess.com or lichess.org. If nothing connects, see the Setup tab.'}
        </div>
      )}
    </div>
  )
}
