import { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import BootstrapGate from './components/BootstrapGate'
import EvalPanel from './components/EvalPanel'

export default function App() {
  const [status, setStatus] = useState({ stockfishOk: false, overlayOk: false, extensionConnected: false, message: '' })
  const [ev, setEv] = useState(null)

  useEffect(() => {
    window.chessist.getStatus().then(setStatus)
    const offS = window.chessist.onStatus(setStatus)
    const offE = window.chessist.onEval(setEv)
    return () => { offS(); offE() }
  }, [])

  const ready = status.stockfishOk && status.extensionConnected

  return (
    <div style={{ minHeight: '100vh', background: 'rgb(var(--bg))' }}>
      <TitleBar />
      {status.message && (
        <div style={{ padding: '6px 16px', fontSize: 11, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace', borderBottom: '1px solid rgb(var(--border))' }}>
          {status.message}
        </div>
      )}
      {!ready ? <BootstrapGate status={status} /> : ev ? <EvalPanel ev={ev} /> : (
        <div style={{ padding: 20, textAlign: 'center', color: 'rgb(var(--fg-dim))', fontSize: 12 }}>
          Open a game on chess.com or lichess.org
        </div>
      )}
    </div>
  )
}
