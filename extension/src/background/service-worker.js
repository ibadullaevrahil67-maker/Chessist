// Chessist - Service Worker (v2)
// The desktop app owns the engine. This worker keeps content scripts alive,
// executes auto-moves, and holds a presence connection to the desktop app so the
// app detects the extension on ANY page (not just chess.com / lichess.org).

// ── Presence connection to the desktop app ─────────────────────────────────────
// The content scripts only run on chess sites, so they can't signal presence
// everywhere. The service worker connects to the app's WebSocket and identifies,
// so the app shows "extension connected" regardless of which tab is open.
const APP_WS_URL = 'ws://127.0.0.1:27301'
let _swWs = null
let _swReconnect = null

function connectPresence() {
  // Already connecting/open?
  if (_swWs && (_swWs.readyState === 0 || _swWs.readyState === 1)) return
  try {
    _swWs = new WebSocket(APP_WS_URL)
    _swWs.onopen = () => {
      try { _swWs.send(JSON.stringify({ type: 'identify', role: 'extension' })) } catch (e) {}
    }
    // Incoming messages (heartbeat pings, eval broadcasts) keep the MV3 worker alive.
    _swWs.onmessage = () => {}
    _swWs.onclose = () => { _swWs = null; scheduleReconnect() }
    _swWs.onerror = () => { try { _swWs.close() } catch (e) {} }
  } catch (e) {
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (_swReconnect) return
  _swReconnect = setTimeout(() => { _swReconnect = null; connectPresence() }, 3000)
}

// Connect on every worker wake-up.
chrome.runtime.onStartup.addListener(connectPresence)
chrome.runtime.onInstalled.addListener(connectPresence)

// Backup wake: an alarm revives the worker periodically and reconnects if needed.
try {
  chrome.alarms.create('chessist-presence', { periodInMinutes: 0.5 })
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'chessist-presence') connectPresence() })
} catch (e) {}

// Also connect when this worker script first loads.
connectPresence()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'content-alive') return
  // keep-alive only
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_MOVE') {
    const tabId = sender.tab?.id
    if (!tabId) { sendResponse({ success: false, error: 'No tabId' }); return true }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (from, to, promo) => {
        const files = 'abcdefgh'
        const cgWrap = document.querySelector('cg-wrap') || document.querySelector('.cg-wrap')
        const chessComBoard = document.querySelector('wc-chess-board') || document.querySelector('chess-board')
        const isLichess = !!cgWrap
        let isFlipped, surface
        if (isLichess) {
          isFlipped = cgWrap.classList.contains('orientation-black')
          surface = cgWrap.querySelector('cg-board') || cgWrap
        } else {
          if (!chessComBoard) return false
          isFlipped = chessComBoard.classList.contains('flipped') || chessComBoard.getAttribute('board-orientation') === 'black'
          surface = chessComBoard.querySelector('.board') || chessComBoard.shadowRoot?.querySelector('.board') || chessComBoard
        }
        const rect = surface.getBoundingClientRect()
        const sz = rect.width / 8
        function sqPx(sq) {
          const f = files.indexOf(sq[0]), r = parseInt(sq[1]) - 1
          const x = isFlipped ? rect.left + (7 - f + 0.5) * sz : rect.left + (f + 0.5) * sz
          const y = isFlipped ? rect.top + (r + 0.5) * sz : rect.top + (7 - r + 0.5) * sz
          return { x, y }
        }
        const fp = sqPx(from), tp = sqPx(to)
        if (isLichess) {
          function fire(el, type, x, y, btns) {
            el.dispatchEvent(new PointerEvent(type, { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:btns!=null?btns:1 }))
          }
          let pieceEl = null
          const pieces = surface.querySelectorAll('piece')
          let bestDist = sz
          for (const p of pieces) {
            const m = p.style.transform.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/)
            if (!m) continue
            const px = parseFloat(m[1]), py = parseFloat(m[2])
            const ef = files.indexOf(from[0]), er = parseInt(from[1]) - 1
            const ex = isFlipped ? (7-ef)*sz : ef*sz
            const ey = isFlipped ? er*sz : (7-er)*sz
            const d = Math.hypot(px-ex, py-ey)
            if (d < bestDist) { bestDist = d; pieceEl = p }
          }
          const fromEl = pieceEl || document.elementFromPoint(fp.x, fp.y) || surface
          fire(fromEl, 'pointerdown', fp.x, fp.y, 1)
          fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:fp.x, clientY:fp.y, button:0, buttons:1 }))
          setTimeout(() => {
            document.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true, composed:true, clientX:tp.x, clientY:tp.y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }))
            setTimeout(() => {
              const toEl = document.elementFromPoint(tp.x, tp.y) || surface
              fire(toEl, 'pointerup', tp.x, tp.y, 0)
              toEl.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:tp.x, clientY:tp.y, button:0 }))
            }, 50)
          }, 50)
        } else {
          function fireClick(x, y) {
            const el = document.elementFromPoint(x, y) || chessComBoard
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }))
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:1 }))
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:0 }))
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles:true, clientX:x, clientY:y, button:0, buttons:0 }))
            el.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 }))
          }
          fireClick(fp.x, fp.y)
          setTimeout(() => fireClick(tp.x, tp.y), 100)
        }
        return true
      },
      args: [message.from, message.to, message.promotion || null]
    }).then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }))
    return true
  }
  return false
})
