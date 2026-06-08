export default function TitleBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 36,
      WebkitAppRegion: 'drag', padding: '0 8px 0 14px',
      borderBottom: '1px solid rgb(var(--border))',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent),0.6)' }} />
      <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em' }}>CHESSIST</span>
      <div style={{ marginLeft: 'auto', display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => window.chessist.minimizeWindow()} style={btn}>—</button>
        <button onClick={() => window.chessist.closeWindow()} style={btn}>✕</button>
      </div>
    </div>
  )
}
const btn = { width: 36, height: 36, background: 'transparent', border: 'none', color: 'rgb(var(--fg-muted))', cursor: 'pointer', fontSize: 13 }
