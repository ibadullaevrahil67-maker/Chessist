interface EvalData {
  depth: number
  cp?: number
  mate?: number
  bestMove?: string
  nps?: number
}

function formatScore(data: EvalData): string {
  if (data.mate !== undefined) return `M${data.mate}`
  if (data.cp !== undefined) {
    const p = data.cp / 100
    return (p >= 0 ? '+' : '') + p.toFixed(2)
  }
  return '—'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace', color: 'var(--fg)' }}>
        {value}
      </div>
    </div>
  )
}

export default function EvalPanel({ evalData }: { evalData: EvalData }) {
  const cp = evalData.cp
  const mate = evalData.mate
  let fillPct = 50
  if (mate !== undefined) fillPct = mate > 0 ? 95 : 5
  else if (cp !== undefined) fillPct = 50 + Math.max(-45, Math.min(45, cp / 50))

  return (
    <div>
      <div style={{
        margin: '0 0 1px 0',
        height: 6,
        background: 'var(--surface)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${fillPct}%`,
          background: 'var(--accent)',
          boxShadow: 'var(--accent-glow)',
          transition: 'width 0.25s ease',
        }} />
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: 'var(--fg)',
        }}>
          {formatScore(evalData)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'monospace' }}>
          depth {evalData.depth}
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderLeft: '1px solid var(--border)',
        borderTop: '1px solid var(--border)',
      }}>
        <Stat label="Best Move" value={evalData.bestMove ?? '—'} />
        <Stat label="Depth"     value={String(evalData.depth)} />
        <Stat label="Score"     value={formatScore(evalData)} />
        <Stat label="kNPS"      value={evalData.nps ? String(Math.round(evalData.nps / 1000)) : '—'} />
      </div>
    </div>
  )
}
