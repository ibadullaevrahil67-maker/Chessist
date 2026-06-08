import { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import EvaluationPage from './pages/EvaluationPage'
import EnginePage from './pages/EnginePage'
import SetupPage from './pages/SetupPage'
import AboutPage from './pages/AboutPage'

export default function App() {
  const [status, setStatus] = useState({ stockfishOk: false, overlayOk: false, extensionConnected: false, message: '' })
  const [ev, setEv] = useState(null)
  const [page, setPage] = useState('evaluation')

  useEffect(() => {
    window.chessist.getStatus().then(setStatus)
    const offS = window.chessist.onStatus(setStatus)
    const offE = window.chessist.onEval(setEv)
    return () => { offS(); offE() }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'rgb(var(--bg))' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar page={page} setPage={setPage} status={status} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {status.message && page !== 'setup' && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace', borderBottom: '1px solid rgb(var(--border))' }}>
              {status.message}
            </div>
          )}
          {page === 'evaluation' && <EvaluationPage ev={ev} status={status} />}
          {page === 'engine' && <EnginePage />}
          {page === 'setup' && <SetupPage status={status} />}
          {page === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  )
}
