import { useEffect, useState } from 'react'
import Check from '../components/controls/Check'
import Slider from '../components/controls/Slider'

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
        <Slider value={s.skillLevel} min={1} max={20} onChange={v => set('skillLevel', v)} />
      </Row>

      <Row label="Limit Strength">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
          <Check checked={s.limitStrength} onChange={v => set('limitStrength', v)} />
          {s.limitStrength ? 'on — ELO governs strength' : 'off — full strength / skill level'}
        </label>
      </Row>

      <Row label="ELO" value={s.elo}>
        <Slider value={s.elo} min={1320} max={3190} step={10} disabled={!s.limitStrength} onChange={v => set('elo', v)} />
      </Row>

      <Row label="Threads" value={s.threads}>
        <Slider value={s.threads} min={1} max={maxThreads} onChange={v => set('threads', v)} />
      </Row>

      <Row label="Hash (MB)" value={s.hash}>
        <Slider value={s.hash} min={128} max={2048} step={128} onChange={v => set('hash', v)} />
      </Row>

      <p style={{ marginTop: 16, fontSize: 12, color: 'rgb(var(--fg-dim))', lineHeight: 1.6 }}>
        Depth, alternative arrows, auto-move and overlay/in-page rendering live on the
        <span style={{ color: 'rgb(var(--fg-muted))' }}> Game tab</span>.
      </p>
    </div>
  )
}
