import { useEffect, useState } from 'react'
import BootstrapGate from '../components/BootstrapGate'

const btn = {
  padding: '7px 12px', fontSize: 12, fontWeight: 600,
  background: 'rgb(var(--surface))', color: 'rgb(var(--fg))',
  border: '1px solid rgb(var(--border))', cursor: 'pointer',
}

function ExtensionCard({ connected }) {
  const [extPath, setExtPath] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => { window.chessist.getExtensionPath().then(setExtPath) }, [])

  const copy = (text, tag) => {
    window.chessist.copyText(text)
    setCopied(tag)
    setTimeout(() => setCopied(''), 1500)
  }

  if (connected) {
    return (
      <div style={{ margin: '4px 16px 16px', padding: '12px 14px', border: '1px solid rgb(var(--border))', background: 'rgb(var(--surface))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--status-green))', boxShadow: '0 0 6px rgba(34,197,94,0.7)' }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Extension connected</span>
        </div>
        <p style={{ marginTop: 6, fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
          You're all set — open a game on chess.com or lichess.org.
        </p>
      </div>
    )
  }

  const Step = ({ n, children }) => (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12, color: 'rgb(var(--fg-muted))', lineHeight: 1.6 }}>
      <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: '1px solid rgb(var(--border))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'rgb(var(--fg))' }}>{n}</span>
      <span>{children}</span>
    </div>
  )

  return (
    <div style={{ margin: '4px 16px 16px', padding: '14px', border: '1px solid rgb(var(--border))', background: 'rgb(var(--surface))' }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', marginBottom: 10 }}>BROWSER EXTENSION</div>

      <Step n={1}>Open <code style={{ color: 'rgb(var(--fg))' }}>chrome://extensions</code> in Chrome, Brave, or Edge.</Step>
      <Step n={2}>Turn on <strong style={{ color: 'rgb(var(--fg))' }}>Developer mode</strong> (top-right toggle).</Step>
      <Step n={3}>Click <strong style={{ color: 'rgb(var(--fg))' }}>Load unpacked</strong> and select the extension folder below.</Step>

      {extPath && (
        <div style={{ margin: '10px 0', padding: '8px 10px', background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))', fontFamily: 'monospace', fontSize: 11, color: 'rgb(var(--fg-muted))', wordBreak: 'break-all' }}>
          {extPath}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <button style={btn} onClick={() => window.chessist.revealExtensionFolder()}>Open extension folder</button>
        <button style={btn} onClick={() => copy(extPath, 'path')}>{copied === 'path' ? 'Copied ✓' : 'Copy folder path'}</button>
        <button style={btn} onClick={() => copy('chrome://extensions', 'url')}>{copied === 'url' ? 'Copied ✓' : 'Copy chrome://extensions'}</button>
      </div>

      <p style={{ marginTop: 10, fontSize: 11, color: 'rgb(var(--fg-dim))' }}>
        Browsers block opening <code>chrome://</code> links from outside — copy it and paste into the address bar.
      </p>
    </div>
  )
}

export default function SetupPage({ status }) {
  const [busy, setBusy] = useState(false)

  const redownload = async () => {
    setBusy(true)
    try { await window.chessist.redownloadStockfish() } finally { setBusy(false) }
  }

  return (
    <div>
      <BootstrapGate status={status} />
      <ExtensionCard connected={status.extensionConnected} />
      <div style={{ padding: '0 16px 16px' }}>
        <button onClick={redownload} disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? 'Re-downloading…' : 'Re-download Stockfish'}
        </button>
      </div>
    </div>
  )
}
