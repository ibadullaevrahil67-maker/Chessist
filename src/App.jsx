import { useEffect, useState, useRef } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import SettingsModal from './components/SettingsModal'
import EvaluationPage from './pages/EvaluationPage'
import SetupPage from './pages/SetupPage'
import AboutPage from './pages/AboutPage'

const piecesKey = (fen) => (fen ? fen.split(' ')[0] : '')

export default function App() {
  const [status, setStatus] = useState({ stockfishOk: false, overlayOk: false, extensionConnected: false, chessConnected: false, chessSite: null, message: '' })
  const [ev, setEv] = useState(null)
  const [pos, setPos] = useState(null)        // { fen, flipped } — authoritative current position
  const [page, setPage] = useState('evaluation')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const posRef = useRef(null)

  useEffect(() => {
    window.chessist.getStatus().then(setStatus)
    const offS = window.chessist.onStatus(setStatus)
    const offP = window.chessist.onPosition?.((p) => { posRef.current = p; setPos(p) })
    const offE = window.chessist.onEval((e) => {
      // Ignore speculative / stale evals — only show ones for the current board.
      const cur = posRef.current?.fen
      if (cur && e.fen && piecesKey(e.fen) !== piecesKey(cur)) return
      setEv(e)
    })
    return () => { offS(); offE(); offP && offP() }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'rgb(var(--bg))' }}>
      <TitleBar onSettings={() => setSettingsOpen(true)} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar page={page} setPage={setPage} status={status} onSettings={() => setSettingsOpen(true)} />
        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {status.message && page !== 'setup' && (
            <div style={{ flexShrink: 0, padding: '6px 16px', fontSize: 11, color: 'rgb(var(--fg-muted))', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid rgb(var(--border))' }}>
              {status.message}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: page === 'evaluation' ? 'hidden' : 'auto' }}>
            {page === 'evaluation' && <EvaluationPage ev={ev} pos={pos} status={status} />}
            {page === 'setup' && <SetupPage status={status} />}
            {page === 'about' && <AboutPage />}
          </div>
        </main>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
