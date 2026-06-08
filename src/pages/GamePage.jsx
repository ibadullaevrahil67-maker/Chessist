import { useEffect, useState } from 'react'
import Check from '../components/controls/Check'
import Slider from '../components/controls/Slider'

function Section({ title, children }) {
  return (
    <div className="scard">
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', color: 'rgb(var(--fg-muted))', padding: '10px 0 2px' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children, value }) {
  return (
    <div className="srow" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      <span style={{ width: 150, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {value !== undefined && (
        <span style={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'rgb(var(--fg-muted))' }}>{value}</span>
      )}
    </div>
  )
}

function Toggle({ on, onChange }) {
  return <Check checked={on} onChange={onChange} />
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid rgb(var(--border))', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{
            padding: '5px 12px', fontSize: 12, cursor: 'pointer', border: 'none',
            background: value === o.value ? 'rgb(var(--accent))' : 'transparent',
            color: value === o.value ? '#fff' : 'rgb(var(--fg-muted))',
          }}>{o.label}</button>
      ))}
    </div>
  )
}

export default function GamePage() {
  const [s, setS] = useState(null)
  useEffect(() => { window.chessist.getGameSettings().then(setS) }, [])
  if (!s) return <div style={{ padding: 24, color: 'rgb(var(--fg-dim))', fontSize: 13 }}>Loading…</div>

  const set = (key, value) => { setS(p => ({ ...p, [key]: value })); window.chessist.setGameOption(key, value) }

  return (
    <div style={{ padding: 16 }}>
      <Section title="GAME">
        <Row label="Enabled"><Toggle on={s.enabled} onChange={v => set('enabled', v)} /></Row>
        <Row label="Depth" value={s.depth}>
          <Slider value={s.depth} min={10} max={30} onChange={v => set('depth', v)} />
        </Row>
        <Row label="Render mode">
          <Seg value={s.renderMode} onChange={v => set('renderMode', v)}
            options={[{ value: 'overlay', label: 'Overlay' }, { value: 'browser', label: 'In-page' }, { value: 'electron', label: 'App' }]} />
        </Row>
        <Row label="Player color">
          <Seg value={s.playerColor} onChange={v => set('playerColor', v)}
            options={[{ value: 'auto', label: 'Auto' }, { value: 'white', label: 'White' }, { value: 'black', label: 'Black' }]} />
        </Row>
      </Section>

      <Section title="ARROWS">
        <Row label="Show best move"><Toggle on={s.showBestMove} onChange={v => set('showBestMove', v)} /></Row>
        <Row label="Opponent's best move"><Toggle on={s.showOpponentBestMove} onChange={v => set('showOpponentBestMove', v)} /></Row>
        <Row label="Alternative arrows"><Toggle on={s.showAltArrows} onChange={v => set('showAltArrows', v)} /></Row>
      </Section>

      <Section title="AUTO-MOVE">
        <Row label="Auto-move"><Toggle on={s.autoMove} onChange={v => set('autoMove', v)} /></Row>
        <Row label="Instant move"><Toggle on={s.instantMove} onChange={v => set('instantMove', v)} /></Row>
        <Row label="Delay min (s)" value={s.autoMoveDelayMin.toFixed(1)}>
          <Slider value={s.autoMoveDelayMin} min={0} max={3} step={0.1} disabled={s.instantMove} onChange={v => set('autoMoveDelayMin', v)} />
        </Row>
        <Row label="Delay max (s)" value={s.autoMoveDelayMax.toFixed(1)}>
          <Slider value={s.autoMoveDelayMax} min={0} max={5} step={0.1} disabled={s.instantMove} onChange={v => set('autoMoveDelayMax', v)} />
        </Row>
        <Row label="Smart timing"><Toggle on={s.smartTiming} onChange={v => set('smartTiming', v)} /></Row>
      </Section>

      <Section title="BEHAVIOR">
        <Row label="Move icons"><Toggle on={s.showMoveIcon} onChange={v => set('showMoveIcon', v)} /></Row>
        <Row label="Auto-rematch"><Toggle on={s.autoRematch} onChange={v => set('autoRematch', v)} /></Row>
        <Row label="Auto new game"><Toggle on={s.autoNewGame} onChange={v => set('autoNewGame', v)} /></Row>
        <Row label="Stealth mode"><Toggle on={s.stealthMode} onChange={v => set('stealthMode', v)} /></Row>
        <Row label="Target accuracy" value={`${s.targetAccuracy}%`}>
          <Slider value={s.targetAccuracy} min={50} max={100} onChange={v => set('targetAccuracy', v)} />
        </Row>
      </Section>

      <Section title="WIN / LOSS BALANCE">
        <Row label="Balance W/L"><Toggle on={s.wlBalance} onChange={v => set('wlBalance', v)} /></Row>
        <Row label="Max wins in a row" value={s.maxConsecutiveWins}>
          <Slider value={s.maxConsecutiveWins} min={1} max={10} disabled={!s.wlBalance} onChange={v => set('maxConsecutiveWins', v)} />
        </Row>
        <Row label="Max losses in a row" value={s.maxConsecutiveLosses}>
          <Slider value={s.maxConsecutiveLosses} min={1} max={10} disabled={!s.wlBalance} onChange={v => set('maxConsecutiveLosses', v)} />
        </Row>
        <Row label="Random throws"><Toggle on={s.throwRandom} onChange={v => set('throwRandom', v)} /></Row>
        <Row label="Random losses"><Toggle on={s.lossRandom} onChange={v => set('lossRandom', v)} /></Row>
      </Section>
    </div>
  )
}
