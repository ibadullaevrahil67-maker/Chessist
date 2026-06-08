// Minimal inline stroke icons (no external dependency). Inherit currentColor.
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function IconEval(p) {
  return (<svg {...base} {...p}><line x1="4" y1="20" x2="4" y2="10" /><line x1="10" y1="20" x2="10" y2="4" /><line x1="16" y1="20" x2="16" y2="13" /><line x1="22" y1="20" x2="2" y2="20" /></svg>)
}
export function IconGame(p) {
  return (<svg {...base} {...p}><polygon points="12 2 19 6.5 19 17.5 12 22 5 17.5 5 6.5 12 2" /><line x1="12" y1="7" x2="12" y2="13" /><line x1="9" y1="10" x2="15" y2="10" /></svg>)
}
export function IconEngine(p) {
  return (<svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="1" /><line x1="9" y1="2" x2="9" y2="6" /><line x1="15" y1="2" x2="15" y2="6" /><line x1="9" y1="18" x2="9" y2="22" /><line x1="15" y1="18" x2="15" y2="22" /><line x1="2" y1="9" x2="6" y2="9" /><line x1="2" y1="15" x2="6" y2="15" /><line x1="18" y1="9" x2="22" y2="9" /><line x1="18" y1="15" x2="22" y2="15" /></svg>)
}
export function IconSetup(p) {
  return (<svg {...base} {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>)
}
export function IconAbout(p) {
  return (<svg {...base} {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>)
}
