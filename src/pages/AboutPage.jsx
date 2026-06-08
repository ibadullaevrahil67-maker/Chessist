import logo from '../assets/logo.png'

const VERSION = '2.0.0'

function Link({ href, children }) {
  return (
    <button
      onClick={() => window.chessist.openExternal(href)}
      style={{ background: 'none', border: 'none', color: 'rgb(var(--accent))', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}
    >
      {children}
    </button>
  )
}

export default function AboutPage() {
  return (
    <div style={{ padding: 24, fontSize: 13, lineHeight: 1.9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <img src={logo} alt="" width={40} height={40} style={{ display: 'block', borderRadius: 8 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.08em' }}>CHESSIST</span>
          <span style={{ fontFamily: 'monospace', color: 'rgb(var(--fg-muted))' }}>v{VERSION}</span>
        </div>
      </div>
      <p style={{ color: 'rgb(var(--fg-muted))', marginBottom: 16 }}>
        Live Stockfish evaluation for Chess.com and Lichess — a desktop app with a transparent,
        screen-capture-invisible board overlay.
      </p>
      <div style={{ display: 'grid', gap: 4 }}>
        <Link href="https://github.com/imluri/Chessist">GitHub repository</Link>
        <Link href="https://stockfishchess.org/">Stockfish (GPL)</Link>
      </div>
      <p style={{ marginTop: 20, fontSize: 12, color: 'rgb(var(--fg-dim))' }}>
        Created by imluri · MIT licensed (app + extension) · Stockfish is GPL, downloaded at first run.
      </p>
    </div>
  )
}
