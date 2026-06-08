import { useEffect, useState } from 'react'

function Row({ label, children, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgb(var(--border))' }}>
      <span style={{ width: 150, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {value !== undefined && (
        <span style={{ width: 56, textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: 'rgb(var(--fg-muted))' }}>{value}</span>
      )}
    </div>
  )
}

const slider = { width: '100%', accentColor: 'rgb(var(--accent))', cursor: 'pointer' }
const checkbox = { accentColor: 'rgb(var(--accent))', cursor: 'pointer', width: 15, height: 15 }

function Toggle({ on, onChange }) {
  return <input type="checkbox" checked={on} style={checkbox} onChange={e => onChange(e.target.checked)} />
}

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid rgb(var(--border))' }}>
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
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'rgb(var(--fg-muted))' }}>GAME</div>

      <Row label="Enabled"><Toggle on={s.enabled} onChange={v => set('enabled', v)} /></Row>
      <Row label="Depth" value={s.depth}>
        <input type="range" min={10} max={30} step={1} value={s.depth} style={slider} onChange={e => set('depth', Number(e.target.value))} />
      </Row>
      <Row label="Render mode">
        <Seg value={s.renderMode} onChange={v => set('renderMode', v)}
          options={[{ value: 'overlay', label: 'Overlay' }, { value: 'browser', label: 'In-page' }, { value: 'electron', label: 'App' }]} />
      </Row>
      <Row label="Player color">
        <Seg value={s.playerColor} onChange={v => set('playerColor', v)}
          options={[{ value: 'auto', label: 'Auto' }, { value: 'white', label: 'White' }, { value: 'black', label: 'Black' }]} />
      </Row>

      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', margin: '20px 0 8px', color: 'rgb(var(--fg-muted))' }}>ARROWS</div>
      <Row label="Show best move"><Toggle on={s.showBestMove} onChange={v => set('showBestMove', v)} /></Row>
      <Row label="Opponent's best move"><Toggle on={s.showOpponentBestMove} onChange={v => set('showOpponentBestMove', v)} /></Row>
      <Row label="Alternative arrows"><Toggle on={s.showAltArrows} onChange={v => set('showAltArrows', v)} /></Row>

      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', margin: '20px 0 8px', color: 'rgb(var(--fg-muted))' }}>AUTO-MOVE</div>
      <Row label="Auto-move"><Toggle on={s.autoMove} onChange={v => set('autoMove', v)} /></Row>
      <Row label="Instant move"><Toggle on={s.instantMove} onChange={v => set('instantMove', v)} /></Row>
      <Row label="Delay min (s)" value={s.autoMoveDelayMin.toFixed(1)}>
        <input type="range" min={0} max={3} step={0.1} value={s.autoMoveDelayMin} disabled={s.instantMove}
          style={{ ...slider, opacity: s.instantMove ? 0.4 : 1 }} onChange={e => set('autoMoveDelayMin', Number(e.target.value))} />
      </Row>
      <Row label="Delay max (s)" value={s.autoMoveDelayMax.toFixed(1)}>
        <input type="range" min={0} max={5} step={0.1} value={s.autoMoveDelayMax} disabled={s.instantMove}
          style={{ ...slider, opacity: s.instantMove ? 0.4 : 1 }} onChange={e => set('autoMoveDelayMax', Number(e.target.value))} />
      </Row>
      <Row label="Smart timing"><Toggle on={s.smartTiming} onChange={v => set('smartTiming', v)} /></Row>

      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', margin: '20px 0 8px', color: 'rgb(var(--fg-muted))' }}>BEHAVIOR</div>
      <Row label="Move icons"><Toggle on={s.showMoveIcon} onChange={v => set('showMoveIcon', v)} /></Row>
      <Row label="Auto-rematch"><Toggle on={s.autoRematch} onChange={v => set('autoRematch', v)} /></Row>
      <Row label="Auto new game"><Toggle on={s.autoNewGame} onChange={v => set('autoNewGame', v)} /></Row>
      <Row label="Stealth mode"><Toggle on={s.stealthMode} onChange={v => set('stealthMode', v)} /></Row>
      <Row label="Target accuracy" value={`${s.targetAccuracy}%`}>
        <input type="range" min={50} max={100} step={1} value={s.targetAccuracy} style={slider} onChange={e => set('targetAccuracy', Number(e.target.value))} />
      </Row>

      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', margin: '20px 0 8px', color: 'rgb(var(--fg-muted))' }}>WIN / LOSS BALANCE</div>
      <Row label="Balance W/L"><Toggle on={s.wlBalance} onChange={v => set('wlBalance', v)} /></Row>
      <Row label="Max wins in a row" value={s.maxConsecutiveWins}>
        <input type="range" min={1} max={10} step={1} value={s.maxConsecutiveWins} disabled={!s.wlBalance}
          style={{ ...slider, opacity: s.wlBalance ? 1 : 0.4 }} onChange={e => set('maxConsecutiveWins', Number(e.target.value))} />
      </Row>
      <Row label="Max losses in a row" value={s.maxConsecutiveLosses}>
        <input type="range" min={1} max={10} step={1} value={s.maxConsecutiveLosses} disabled={!s.wlBalance}
          style={{ ...slider, opacity: s.wlBalance ? 1 : 0.4 }} onChange={e => set('maxConsecutiveLosses', Number(e.target.value))} />
      </Row>
      <Row label="Random throws"><Toggle on={s.throwRandom} onChange={v => set('throwRandom', v)} /></Row>
      <Row label="Random losses"><Toggle on={s.lossRandom} onChange={v => set('lossRandom', v)} /></Row>
    </div>
  )
}
