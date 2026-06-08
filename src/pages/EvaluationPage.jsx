import EvalPanel from '../components/EvalPanel'

export default function EvaluationPage({ ev, status }) {
  if (ev) return <div style={{ padding: 16 }}><EvalPanel ev={ev} /></div>

  const hint = !status.extensionConnected
    ? 'Load the Chessist extension and open a game on chess.com or lichess.org.'
    : 'Open a game on chess.com or lichess.org — evaluation appears here.'

  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'rgb(var(--fg-dim))', fontSize: 13, lineHeight: 1.7 }}>
      {hint}
    </div>
  )
}
