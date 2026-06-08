import logo from '../assets/logo.png'

const btn = { width: 40, height: 36, background: 'transparent', border: 'none', color: 'rgb(var(--fg-muted))', cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }

export default function TitleBar({ onSettings }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 36,
      WebkitAppRegion: 'drag', padding: '0 0 0 12px',
      borderBottom: '1px solid rgb(var(--border))',
    }}>
      <img src={logo} alt="" width={18} height={18} style={{ display: 'block', borderRadius: 3 }} />
      <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em' }}>CHESSIST</span>
      <div style={{ marginLeft: 'auto', display: 'flex', WebkitAppRegion: 'no-drag' }}>
        {onSettings && (
          <button onClick={onSettings} style={btn} aria-label="Settings" title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
        <button onClick={() => window.chessist.minimizeWindow()} style={btn} aria-label="Minimize" title="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.3" /></svg>
        </button>
        <button onClick={() => window.chessist.maximizeWindow()} style={btn} aria-label="Maximize" title="Maximize / Restore">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.2" y="2.2" width="7.6" height="7.6" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button onClick={() => window.chessist.closeWindow()} style={btn} aria-label="Close" title="Close"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgb(var(--status-red))'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgb(var(--fg-muted))' }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.3" /><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" strokeWidth="1.3" /></svg>
        </button>
      </div>
    </div>
  )
}
