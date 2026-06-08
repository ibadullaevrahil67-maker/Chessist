const dot = document.getElementById('dot')
const status = document.getElementById('status')

function check() {
  let settled = false
  let ws
  try { ws = new WebSocket('ws://127.0.0.1:27301') } catch { return fail() }
  const t = setTimeout(() => { if (!settled) { settled = true; try { ws.close() } catch {} ; fail() } }, 1500)
  ws.onopen = () => { if (settled) return; settled = true; clearTimeout(t); ok(); try { ws.close() } catch {} }
  ws.onerror = () => { if (settled) return; settled = true; clearTimeout(t); fail() }
}
function ok() { dot.className = 'dot ok'; status.textContent = 'Chessist app running' }
function fail() { dot.className = 'dot off'; status.textContent = 'Chessist app not running' }

check()
setInterval(check, 2000)
