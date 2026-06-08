import { useState } from 'react'
import BootstrapGate from '../components/BootstrapGate'

export default function SetupPage({ status }) {
  const [busy, setBusy] = useState(false)

  const redownload = async () => {
    setBusy(true)
    try { await window.chessist.redownloadStockfish() } finally { setBusy(false) }
  }

  return (
    <div>
      <BootstrapGate status={status} />
      <div style={{ padding: '0 16px 16px' }}>
        <button
          onClick={redownload}
          disabled={busy}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            background: 'rgb(var(--surface))', color: 'rgb(var(--fg))',
            border: '1px solid rgb(var(--border))', cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Re-downloading…' : 'Re-download Stockfish'}
        </button>
      </div>
    </div>
  )
}
