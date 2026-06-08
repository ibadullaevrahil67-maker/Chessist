function Step({ label, status, detail }) {
  const colors = { ok: 'var(--status-green)', working: 'var(--status-yellow)', waiting: 'var(--fg-dim)' }
  const c = `rgb(${colors[status]})`
  const glow = status === 'ok' ? '0 0 6px rgba(34,197,94,0.7)' : status === 'working' ? '0 0 6px rgba(234,179,8,0.7)' : 'none'
  const text = status === 'ok' ? 'ok' : status === 'working' ? (detail || 'working') : 'waiting'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgb(var(--border))' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: glow }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ color: c, fontSize: 12, fontFamily: 'monospace' }}>{text}</span>
    </div>
  )
}

export default function BootstrapGate({ status }) {
  const sf = status.stockfishOk ? 'ok' : 'working'
  const sfDetail = status.message?.startsWith('Stockfish:') ? status.message.replace('Stockfish: ', '') : undefined
  const ov = status.overlayOk ? 'ok' : 'waiting'
  const ext = status.extensionConnected ? 'ok' : 'waiting'
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', marginBottom: 12, color: 'rgb(var(--fg-muted))' }}>SETUP</div>
      <Step label="Stockfish engine" status={sf} detail={sfDetail} />
      <Step label="Overlay" status={ov} />
      <Step label="Extension" status={ext} />
    </div>
  )
}
