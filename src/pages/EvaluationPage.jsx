import EvalPanel from '../components/EvalPanel'

export default function EvaluationPage({ ev, status }) {
  if (ev) return <div style={{ padding: 16 }}><EvalPanel ev={ev} /></div>

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
