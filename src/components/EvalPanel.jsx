// Stockfish reports scores from the side-to-move's perspective. Convert to
// White's perspective (positive = good for White) so the bar doesn't flip each move.
function whiteRelative(ev) {
  const sign = ev.turn === 'b' ? -1 : 1
  return {
    cp: ev.cp !== undefined ? ev.cp * sign : undefined,
    mate: ev.mate !== undefined ? ev.mate * sign : undefined,
  }
}

function fmt(cp, mate) {
  if (mate !== undefined) return `M${mate}`
  if (cp !== undefined) { const p = cp / 100; return (p >= 0 ? '+' : '') + p.toFixed(2) }
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
  // Game over: the engine reported no legal move for the side to move.
  if (ev.gameOver) {
    const mate = ev.gameOver === 'checkmate'
    const fill = !mate ? 50 : (ev.winner === 'w' ? 100 : 0)
    return (
      <div>
        <div style={{ height: 6, background: 'rgb(var(--surface))', position: 'relative', overflow: 'hidden', borderRadius: 999 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, background: 'rgb(var(--accent))', transition: 'width 0.25s' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 2px' }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>{mate ? 'Checkmate' : 'Stalemate'}</span>
          <span style={{ fontSize: 13, color: 'rgb(var(--fg-muted))' }}>
            {mate ? `${ev.winner === 'w' ? 'White' : 'Black'} wins` : 'Draw'}
          </span>
        </div>
      </div>
    )
  }

  const { cp, mate } = whiteRelative(ev)
  let fill = 50
  if (mate !== undefined) fill = mate > 0 ? 95 : 5
  else if (cp !== undefined) fill = 50 + Math.max(-45, Math.min(45, cp / 50))

  return (
    <div>
      {/* eval bar */}
      <div style={{ height: 6, background: 'rgb(var(--surface))', position: 'relative', overflow: 'hidden', borderRadius: 999 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`,
          background: 'rgb(var(--accent))', boxShadow: '0 0 8px rgba(var(--accent-rgb),0.55)', transition: 'width 0.25s',
        }} />
      </div>

      {/* score */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 2px 12px' }}>
        <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(cp, mate)}</span>
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
