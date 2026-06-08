// Renders a chess position from FEN with best-move arrows. White's perspective.
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
const ARROW_COLORS = ['rgb(var(--accent))', 'rgb(var(--status-yellow))', 'rgb(var(--status-red))']

function parseFen(fen) {
  const rows = (fen || '').split(' ')[0].split('/')
  const grid = []
  for (const row of rows) {
    const r = []
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) r.push(null)
      else r.push(ch)
    }
    while (r.length < 8) r.push(null)
    grid.push(r.slice(0, 8))
  }
  while (grid.length < 8) grid.push(Array(8).fill(null))
  return grid // grid[0] = rank 8 (top), grid[7] = rank 1
}

// square "e4" → center in an 8x8 viewBox (white's perspective)
function center(sq) {
  const file = sq.charCodeAt(0) - 97       // a=0..h=7
  const rank = parseInt(sq[1], 10) - 1      // 1=0..8=7
  return { x: file + 0.5, y: (7 - rank) + 0.5 }
}

function Arrow({ from, to, idx }) {
  const a = center(from), b = center(to)
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 0.01) return null
  const ux = dx / len, uy = dy / len
  const head = 0.34, hw = 0.16
  const shaftEnd = { x: b.x - ux * head * 0.8, y: b.y - uy * head * 0.8 }
  const px = -uy, py = ux
  const p1 = `${b.x},${b.y}`
  const p2 = `${b.x - ux * head + px * hw},${b.y - uy * head + py * hw}`
  const p3 = `${b.x - ux * head - px * hw},${b.y - uy * head - py * hw}`
  const c = ARROW_COLORS[idx] || ARROW_COLORS[0]
  return (
    <g style={{ opacity: idx === 0 ? 0.95 : 0.6 }}>
      <line x1={a.x} y1={a.y} x2={shaftEnd.x} y2={shaftEnd.y} stroke={c} strokeWidth={0.13} strokeLinecap="round" />
      <polygon points={`${p1} ${p2} ${p3}`} fill={c} />
    </g>
  )
}

export default function Board({ fen, arrows = [] }) {
  if (!fen) return null
  const grid = parseFen(fen)
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 320, margin: '0 auto', aspectRatio: '1 / 1' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gridTemplateRows: 'repeat(8,1fr)', width: '100%', height: '100%', border: '1px solid rgb(var(--border))' }}>
        {grid.flatMap((row, r) => row.map((piece, f) => {
          const dark = (r + f) % 2 === 1
          const isWhite = piece && piece === piece.toUpperCase()
          return (
            <div key={`${r}-${f}`} style={{ background: dark ? '#26262e' : '#3a3a44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {piece && (
                <span style={{
                  fontSize: 'min(5.2vw, 28px)', lineHeight: 1,
                  color: isWhite ? '#f4f4f6' : '#0e0e12',
                  textShadow: isWhite ? '0 1px 1px rgba(0,0,0,0.5)' : '0 0 1px rgba(255,255,255,0.4)',
                }}>{GLYPH[piece.toLowerCase()]}</span>
              )}
            </div>
          )
        }))}
      </div>
      <svg viewBox="0 0 8 8" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {arrows.map((a, i) => <Arrow key={i} from={a.from} to={a.to} idx={a.idx ?? i} />)}
      </svg>
    </div>
  )
}
