import EvalPanel from '../components/EvalPanel'
import Board from '../components/Board'

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

  const connected = status.extensionConnected
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'rgb(var(--fg-dim))', fontSize: 13, lineHeight: 1.8 }}>
      <div style={{ color: 'rgb(var(--fg-muted))', marginBottom: 6 }}>
        Open a game on chess.com or lichess.org — evaluation appears here.
      </div>
      {!connected && (
        <div style={{ fontSize: 12 }}>
          Extension not detected yet. If you haven't loaded it, see the <strong style={{ color: 'rgb(var(--fg-muted))' }}>Setup</strong> tab.
        </div>
      )}
    </div>
  )
}
