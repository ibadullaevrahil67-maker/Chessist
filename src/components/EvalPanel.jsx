function fmt(ev) {
  if (ev.mate !== undefined) return `M${ev.mate}`
  if (ev.cp !== undefined) { const p = ev.cp / 100; return (p >= 0 ? '+' : '') + p.toFixed(2) }
  return '—'
}

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9, color: 'rgb(var(--fg-dim))', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

export default function EvalPanel({ ev }) {
  let fill = 50
  if (ev.mate !== undefined) fill = ev.mate > 0 ? 95 : 5
  else if (ev.cp !== undefined) fill = 50 + Math.max(-45, Math.min(45, ev.cp / 50))

  return (
    <div>
      {/* eval bar */}
      <div style={{ height: 6, background: 'rgb(var(--surface))', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`,
          background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent-rgb),0.55)', transition: 'width 0.25s',
        }} />
      </div>

      {/* score */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 2px 12px' }}>
        <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(ev)}</span>
        <span style={{ fontSize: 12, color: 'rgb(var(--fg-muted))', fontVariantNumeric: 'tabular-nums' }}>depth {ev.depth}</span>
      </div>

      {/* stats — no table borders, app font */}
      <div style={{ display: 'flex', gap: 28, padding: '0 2px' }}>
        <Stat label="Best move" value={ev.bestMove ?? '—'} />
        <Stat label="Depth" value={String(ev.depth)} />
        <Stat label="kNPS" value={ev.nps ? Math.round(ev.nps / 1000) : '—'} />
      </div>
    </div>
  )
}
