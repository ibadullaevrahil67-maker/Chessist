import { useEffect, useState, useRef } from 'react'

interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
}

interface EngineStatus {
  status: 'connecting' | 'ready' | 'searching' | 'error'
  message?: string
}

function formatScore(data: EvalData): string {
  if (data.mate !== undefined) return `M${data.mate}`
  if (data.cp !== undefined) {
    const pawns = data.cp / 100
    return (pawns >= 0 ? '+' : '') + pawns.toFixed(2)
  }
  return '—'
}

function EvalBar({ cp, mate }: { cp?: number; mate?: number }) {
  let fillPercent = 50
  if (mate !== undefined) fillPercent = mate > 0 ? 95 : 5
  else if (cp !== undefined) fillPercent = 50 + Math.max(-45, Math.min(45, cp / 50))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
      <div style={{ width: 12, height: 80, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', bottom: 0, width: '100%',
          height: `${fillPercent}%`, background: '#fff',
          transition: 'height 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>
        {mate !== undefined ? `M${mate}` : cp !== undefined ? ((cp >= 0 ? '+' : '') + (cp / 100).toFixed(2)) : '—'}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#2a2a2a', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
    </div>
  )
}

export default function App() {
  const [status, setStatus]     = useState<EngineStatus>({ status: 'connecting' })
  const [evalData, setEvalData] = useState<EvalData | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(0)

  useEffect(() => {
    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:27301')
      wsRef.current = ws

      ws.onopen = () => {
        setStatus({ status: 'ready' })
        reconnectRef.current = 0
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'eval' && msg.data) {
            setEvalData(msg.data)
            setStatus(s => ({ ...s, status: 'searching' }))
          } else if (msg.type === 'engine_status') {
            setStatus({ status: msg.status, message: msg.message })
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setStatus({ status: 'connecting' })
        const delay = Math.min(3000, 500 * Math.pow(2, reconnectRef.current))
        reconnectRef.current++
        setTimeout(connect, delay)
      }

      ws.onerror = () => {}
    }

    connect()
    return () => { wsRef.current?.close() }
  }, [])

  const statusColor = { connecting: '#888', ready: '#4caf50', searching: '#2196f3', error: '#f44336' }[status.status]
  const statusLabel = { connecting: 'Connecting…', ready: 'Ready', searching: 'Analyzing', error: 'Error' }[status.status]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, minHeight: '100vh', background: '#1e1e1e', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor }} />
        <span style={{ fontWeight: 600 }}>Chessist Engine</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{statusLabel}</span>
      </div>

      {status.message && (
        <div style={{ fontSize: 12, color: '#f44336', marginBottom: 8 }}>{status.message}</div>
      )}

      {evalData ? (
        <>
          <EvalBar cp={evalData.cp} mate={evalData.mate} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <Stat label="Score"    value={formatScore(evalData)} />
            <Stat label="Depth"    value={String(evalData.depth)} />
            <Stat label="Best"     value={evalData.bestMove ?? '—'} />
            <Stat label="kNPS"     value={evalData.nps ? String(Math.round(evalData.nps / 1000)) : '—'} />
          </div>
        </>
      ) : (
        <div style={{ color: '#666', marginTop: 20, textAlign: 'center' }}>
          {status.status === 'connecting' ? 'Waiting for engine…' : 'No position yet'}
        </div>
      )}
    </div>
  )
}
