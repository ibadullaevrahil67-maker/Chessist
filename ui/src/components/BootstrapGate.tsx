interface BootstrapStatus {
  stockfishOk: boolean
  extensionConnected: boolean
  statusMessage?: string
}

interface Props {
  wsConnected: boolean
  bootstrap: BootstrapStatus
}

function Step({ label, status, detail }: {
  label: string
  status: 'ok' | 'working' | 'waiting' | 'error'
  detail?: string
}) {
  const colors = {
    ok:      'var(--status-green)',
    working: 'var(--status-yellow)',
    waiting: 'var(--fg-dim)',
    error:   'var(--status-red)',
  }
  const labels = { ok: 'ok', working: detail || 'working', waiting: 'waiting', error: 'error' }
  const color = colors[status]
  const glow = status === 'ok'
    ? '0 0 6px rgba(34,197,94,0.7)'
    : status === 'working'
    ? '0 0 6px rgba(234,179,8,0.7)'
    : 'none'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, boxShadow: glow, flexShrink: 0,
      }} />
      <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontFamily: 'monospace' }}>{labels[status]}</span>
    </div>
  )
}

export default function BootstrapGate({ wsConnected, bootstrap }: Props) {
  const sfStatus: 'ok' | 'working' | 'waiting' = !wsConnected
    ? 'waiting'
    : bootstrap.stockfishOk
    ? 'ok'
    : 'working'

  const sfDetail = bootstrap.statusMessage?.startsWith('Stockfish:')
    ? bootstrap.statusMessage.replace('Stockfish: ', '')
    : undefined

  const extStatus: 'ok' | 'waiting' = bootstrap.extensionConnected ? 'ok' : 'waiting'

  return (
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        paddingBottom: 12, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: wsConnected ? 'var(--accent)' : 'var(--fg-dim)',
          boxShadow: wsConnected ? 'var(--accent-glow)' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: 'var(--fg)' }}>
          SETUP
        </span>
      </div>

      <Step label="Engine running" status={wsConnected ? 'ok' : 'waiting'} />
      <Step label="Stockfish" status={sfStatus} detail={sfDetail} />
      <Step label="Extension" status={extStatus} />

      {!bootstrap.extensionConnected && wsConnected && (
        <div style={{
          marginTop: 16, padding: '10px 12px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.6,
        }}>
          Load Chessist in <span style={{ color: 'var(--fg)', fontFamily: 'monospace' }}>chrome://extensions</span>
          {' '}then open a game on chess.com or lichess.org.
        </div>
      )}
    </div>
  )
}
