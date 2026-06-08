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
  const boardFen = pos?.fen || ev?.fen || START_FEN
  const flipped = !!pos?.flipped
  const isPlaceholder = !pos?.fen && !ev?.fen

  const evalMatches = ev?.fen && (!pos?.fen || piecesKey(ev.fen) === piecesKey(pos.fen))
  const arrows = (ev && evalMatches) ? arrowsFromEval(ev) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' }}>
      {/* header: eval panel or status line */}
      <div style={{ flexShrink: 0 }}>
        {ev && evalMatches
          ? <EvalPanel ev={ev} />
          : (
            <div style={{ fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
              {status.extensionConnected ? 'Analyzing…' : 'Waiting for a game'}
            </div>
          )}
      </div>

      {/* board fills the remaining space, kept square and bounded by both axes */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          height: '100%', maxWidth: '100%', aspectRatio: '1 / 1', position: 'relative',
          opacity: isPlaceholder ? 0.35 : 1, filter: isPlaceholder ? 'grayscale(0.4)' : 'none',
        }}>
          <Board fen={boardFen} arrows={arrows} flipped={flipped} fill />
        </div>
      </div>

      {isPlaceholder && (
        <div style={{ flexShrink: 0, textAlign: 'center', fontSize: 12, color: 'rgb(var(--fg-dim))', lineHeight: 1.6 }}>
          {status.extensionConnected
            ? 'Connected — make a move on chess.com or lichess.org.'
            : 'Open a game on chess.com or lichess.org. If nothing connects, see the Setup tab.'}
        </div>
      )}
    </div>
  )
}
