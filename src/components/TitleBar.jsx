import logo from '../assets/logo.png'

export default function TitleBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 36,
      WebkitAppRegion: 'drag', padding: '0 8px 0 12px',
      borderBottom: '1px solid rgb(var(--border))',
    }}>
      <img src={logo} alt="" width={18} height={18} style={{ display: 'block', borderRadius: 3 }} />
      <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em' }}>CHESSIST</span>
      <div style={{ marginLeft: 'auto', display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <button onClick={() => window.chessist.minimizeWindow()} style={btn} aria-label="Minimize" title="Minimize">—</button>
        <button onClick={() => window.chessist.closeWindow()} style={{ ...btn }} aria-label="Close" title="Close"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--status-red))'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgb(var(--fg-muted))' }}>✕</button>
      </div>
    </div>
  )
}
const btn = { width: 36, height: 36, background: 'transparent', border: 'none', color: 'rgb(var(--fg-muted))', cursor: 'pointer', fontSize: 13 }
