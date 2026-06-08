import { IconEval, IconGame, IconEngine, IconSetup, IconAbout } from './icons'

const ITEMS = [
  { id: 'evaluation', label: 'Evaluation', Icon: IconEval },
  { id: 'game',       label: 'Game',       Icon: IconGame },
  { id: 'engine',     label: 'Engine',     Icon: IconEngine },
  { id: 'setup',      label: 'Setup',      Icon: IconSetup },
  { id: 'about',      label: 'About',      Icon: IconAbout },
]

export default function Sidebar({ page, setPage, status }) {
  const ready = status.stockfishOk && status.extensionConnected
  const dotColor = ready ? 'rgb(var(--status-green))' : 'rgb(var(--status-yellow))'
  const dotGlow = ready ? '0 0 6px rgba(34,197,94,0.7)' : '0 0 6px rgba(234,179,8,0.7)'

  return (
    <div style={{
      width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgb(var(--border))', background: 'rgb(var(--bg))',
    }}>
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {ITEMS.map(({ id, label, Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 16px', background: active ? 'rgb(var(--surface))' : 'transparent',
                border: 'none', borderLeft: active ? '2px solid rgb(var(--accent))' : '2px solid transparent',
                color: active ? 'rgb(var(--fg))' : 'rgb(var(--fg-muted))',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, textAlign: 'left',
              }}
            >
              <Icon style={{ width: 16, height: 16, color: active ? 'rgb(var(--accent))' : 'rgb(var(--fg-dim))' }} />
              {label}
            </button>
          )
        })}
      </nav>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderTop: '1px solid rgb(var(--border))', fontSize: 11, color: 'rgb(var(--fg-muted))',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: dotGlow }} />
        {ready ? 'ready' : 'setup'}
      </div>
    </div>
  )
}
