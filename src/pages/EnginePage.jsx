import { useEffect, useState } from 'react'

function Row({ label, children, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgb(var(--border))' }}>
      <span style={{ width: 130, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {value !== undefined && (
        <span style={{ width: 56, textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: 'rgb(var(--fg-muted))' }}>{value}</span>
      )}
    </div>
  )
}

const slider = { width: '100%', accentColor: 'rgb(var(--accent))', cursor: 'pointer' }

export default function EnginePage() {
  const [s, setS] = useState(null)

  useEffect(() => { window.chessist.getEngineSettings().then(setS) }, [])

  if (!s) return <div style={{ padding: 24, color: 'rgb(var(--fg-dim))', fontSize: 13 }}>Loading…</div>

  const set = (key, value) => {
    setS(prev => ({ ...prev, [key]: value }))
    window.chessist.setEngineOption(key, value)
  }

  const maxThreads = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 8

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'rgb(var(--fg-muted))' }}>ENGINE</div>

      <Row label="Skill Level" value={s.skillLevel}>
        <input type="range" min={1} max={20} step={1} value={s.skillLevel} style={slider}
          onChange={e => set('skillLevel', Number(e.target.value))} />
      </Row>

      <Row label="Limit Strength">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
          <input type="checkbox" checked={s.limitStrength} style={{ accentColor: 'rgb(var(--accent))', cursor: 'pointer' }}
            onChange={e => set('limitStrength', e.target.checked)} />
          {s.limitStrength ? 'on — ELO governs strength' : 'off — full strength / skill level'}
        </label>
      </Row>

      <Row label="ELO" value={s.elo}>
        <input type="range" min={1320} max={3190} step={10} value={s.elo} disabled={!s.limitStrength}
          style={{ ...slider, opacity: s.limitStrength ? 1 : 0.4 }}
          onChange={e => set('elo', Number(e.target.value))} />
      </Row>

      <Row label="Threads" value={s.threads}>
        <input type="range" min={1} max={maxThreads} step={1} value={s.threads} style={slider}
          onChange={e => set('threads', Number(e.target.value))} />
      </Row>

      <Row label="Hash (MB)" value={s.hash}>
        <input type="range" min={128} max={2048} step={128} value={s.hash} style={slider}
          onChange={e => set('hash', Number(e.target.value))} />
      </Row>

      <p style={{ marginTop: 16, fontSize: 12, color: 'rgb(var(--fg-dim))', lineHeight: 1.6 }}>
        Depth, alternative arrows, auto-move and overlay/in-page rendering live in the
        <span style={{ color: 'rgb(var(--fg-muted))' }}> extension popup</span>.
      </p>
    </div>
  )
}
