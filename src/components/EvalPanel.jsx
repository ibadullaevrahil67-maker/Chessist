function fmt(ev) {
  if (ev.mate !== undefined) return `M${ev.mate}`
  if (ev.cp !== undefined) { const p = ev.cp / 100; return (p >= 0 ? '+' : '') + p.toFixed(2) }
  return '—'
}
function Stat({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', borderRight: '1px solid rgb(var(--border))', borderBottom: '1px solid rgb(var(--border))' }}>
      <div style={{ fontSize: 9, color: 'rgb(var(--fg-dim))', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
export default function EvalPanel({ ev }) {
  let fill = 50
  if (ev.mate !== undefined) fill = ev.mate > 0 ? 95 : 5
  else if (ev.cp !== undefined) fill = 50 + Math.max(-45, Math.min(45, ev.cp / 50))
  return (
    <div>
      <div style={{ height: 6, background: 'rgb(var(--surface))', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent),0.55)', transition: 'width 0.25s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgb(var(--border))' }}>
        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(ev)}</span>
        <span style={{ fontSize: 12, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace' }}>depth {ev.depth}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderLeft: '1px solid rgb(var(--border))', borderTop: '1px solid rgb(var(--border))' }}>
        <Stat label="Best Move" value={ev.bestMove ?? '—'} />
        <Stat label="Depth" value={String(ev.depth)} />
        <Stat label="Score" value={fmt(ev)} />
        <Stat label="kNPS" value={ev.nps ? String(Math.round(ev.nps / 1000)) : '—'} />
      </div>
    </div>
  )
}
