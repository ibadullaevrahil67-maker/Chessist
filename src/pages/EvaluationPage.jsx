import EvalPanel from '../components/EvalPanel'
import Board from '../components/Board'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function arrowsFromEval(ev) {
  const moves = (ev.multiPvMoves && ev.multiPvMoves.length) ? ev.multiPvMoves : (ev.bestMove ? [ev.bestMove] : [])
  return moves
    .filter(m => typeof m === 'string' && m.length >= 4)
    .slice(0, 3)
    .map((m, i) => ({ from: m.slice(0, 2), to: m.slice(2, 4), idx: i }))
}

export default function EvaluationPage({ ev, status }) {
  if (ev) {
    return (
      <div style={{ padding: 16 }}>
        <EvalPanel ev={ev} />
        {ev.fen && (
          <div style={{ marginTop: 16 }}>
            <Board fen={ev.fen} arrows={arrowsFromEval(ev)} />
          </div>
        )}
      </div>
    )
  }

  // No eval yet — show a dimmed placeholder board + a contextual hint.
  const connected = status.extensionConnected
  const hint = connected
    ? 'Waiting for a position — make a move on chess.com or lichess.org.'
    : 'Open a game on chess.com or lichess.org. If nothing connects, load the extension from the Setup tab.'

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ opacity: 0.35, filter: 'grayscale(0.4)', width: '100%', pointerEvents: 'none' }}>
        <Board fen={START_FEN} arrows={[]} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--fg-muted))', marginBottom: 4 }}>
          {connected ? 'Connected — no position yet' : 'Waiting for a game'}
        </div>
        <div style={{ fontSize: 12, color: 'rgb(var(--fg-dim))' }}>{hint}</div>
      </div>
    </div>
  )
}
