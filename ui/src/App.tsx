import { useEffect, useState, useRef } from 'react'
import BootstrapGate from './components/BootstrapGate'
import EvalPanel from './components/EvalPanel'

interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
}

interface BootstrapStatus {
  stockfishOk: boolean
  extensionConnected: boolean
  statusMessage?: string
}

type ConnStatus = 'connecting' | 'connected' | 'error'

export default function App() {
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting')
  const [statusMsg, setStatusMsg]   = useState<string>('')
  const [bootstrap, setBootstrap]   = useState<BootstrapStatus>({
    stockfishOk: false, extensionConnected: false,
  })
  const [evalData, setEvalData]     = useState<EvalData | null>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const reconnRef  = useRef(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:27301')
      wsRef.current = ws

      ws.onopen = () => {
        setConnStatus('connected')
        reconnRef.current = 0
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'eval' && msg.data) {
            setEvalData(msg.data)
          } else if (msg.type === 'engine_status') {
            setStatusMsg(msg.message ?? '')
            if (msg.status === 'error') setConnStatus('error')
            if (msg.status === 'ready') {
              setBootstrap(b => ({ ...b, stockfishOk: true }))
            }
          } else if (msg.type === 'bootstrap_status') {
            setBootstrap(b => ({
              stockfishOk: !!msg.stockfishOk,
              extensionConnected: !!msg.extensionConnected,
              statusMessage: b.statusMessage,
            }))
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => {
        setConnStatus('connecting')
        setBootstrap({ stockfishOk: false, extensionConnected: false })
        const delay = Math.min(3000, 500 * Math.pow(2, reconnRef.current))
        reconnRef.current++
        setTimeout(connect, delay)
      }
      ws.onerror = () => {}
    }
    connect()
    return () => wsRef.current?.close()
  }, [])

  // Keep statusMessage in bootstrap in sync with latest engine_status message
  useEffect(() => {
    setBootstrap(b => ({ ...b, statusMessage: statusMsg }))
  }, [statusMsg])

  const wsConnected = connStatus === 'connected'
  const bootstrapDone = bootstrap.stockfishOk && bootstrap.extensionConnected
  const statusLabel = { connecting: 'Connecting…', connected: evalData ? 'Analyzing' : 'Ready', error: 'Error' }[connStatus]

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh', fontSize: 13 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: wsConnected ? 'var(--accent)' : 'var(--fg-dim)',
          boxShadow: wsConnected ? 'var(--accent-glow)' : 'none',
        }} />
        <span style={{ fontWeight: 700, letterSpacing: '0.08em', fontSize: 12 }}>CHESSIST</span>
        <span style={{ marginLeft: 'auto', color: 'var(--fg-muted)', fontSize: 11 }}>{statusLabel}</span>
      </div>

      {statusMsg && (
        <div style={{
          padding: '6px 16px', fontSize: 11,
          color: connStatus === 'error' ? 'var(--status-red)' : 'var(--fg-muted)',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'monospace',
        }}>
          {statusMsg}
        </div>
      )}

      {!bootstrapDone ? (
        <BootstrapGate wsConnected={wsConnected} bootstrap={bootstrap} />
      ) : evalData ? (
        <EvalPanel evalData={evalData} />
      ) : (
        <div style={{ padding: 20, color: 'var(--fg-dim)', textAlign: 'center', fontSize: 12 }}>
          No position yet — open a game on chess.com or lichess.org
        </div>
      )}
    </div>
  )
}
