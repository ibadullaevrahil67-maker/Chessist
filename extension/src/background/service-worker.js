// Chessist - Service Worker
// Coordinates content script ↔ ChessistEngine.exe (native Stockfish over WebSocket)

let lastEvaluation = null;

// === NATIVE BRIDGE ===
let nativePort = null;

function connectNative() {
  if (nativePort) return;
  try {
    nativePort = chrome.runtime.connectNative('com.chessist.engine');
    nativePort.onMessage.addListener((msg) => {
      // launch_result etc. — no-op for now
    });
    nativePort.onDisconnect.addListener(() => { nativePort = null; });
  } catch (e) {
    console.log('Chessist SW: native host not available:', e.message);
  }
}

function launchEngine(debug = false) {
  connectNative();
  nativePort?.postMessage({ type: 'launch', debug });
}

// === TAB CACHE ===
let cachedContentTabIds = null;
let tabCacheTimer = null;
function invalidateTabCache() {
  cachedContentTabIds = null;
  if (tabCacheTimer) { clearTimeout(tabCacheTimer); tabCacheTimer = null; }
}
chrome.tabs.onCreated.addListener(invalidateTabCache);
chrome.tabs.onRemoved.addListener(invalidateTabCache);
chrome.tabs.onUpdated.addListener((id, info) => { if (info.url) invalidateTabCache(); });

// === AUTO-LAUNCH ===
chrome.runtime.onStartup.addListener(() => launchEngine());
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.sync.get(['enabled', 'showBestMove', 'engineDepth']);
  await chrome.storage.sync.set({
    enabled:      existing.enabled      ?? true,
    showBestMove: existing.showBestMove ?? false,
    engineDepth:  existing.engineDepth  ?? 18,
  });
  launchEngine();
});

// Content scripts open a persistent port to keep the service worker alive.
// Also triggers engine launch when a chess tab opens.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'content-alive') return;
  launchEngine();
});

// === MESSAGE HANDLER ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LAUNCH_ENGINE') {
    launchEngine(message.debug || false);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'RESTART_OVERLAY') {
    connectNative();
    nativePort?.postMessage({ type: 'restart', debug: message.debug || false });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'KILL_ENGINE') {
    connectNative();
    nativePort?.postMessage({ type: 'kill' });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'EXECUTE_MOVE') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ success: false, error: 'No tabId' }); return true; }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (from, to, promo) => {
        const files = 'abcdefgh';
        const cgWrap = document.querySelector('cg-wrap') || document.querySelector('.cg-wrap');
        const chessComBoard = document.querySelector('wc-chess-board') || document.querySelector('chess-board');
        const isLichess = !!cgWrap;
        let isFlipped, surface;
        if (isLichess) {
          isFlipped = cgWrap.classList.contains('orientation-black');
          surface = cgWrap.querySelector('cg-board') || cgWrap;
        } else {
          if (!chessComBoard) return false;
          isFlipped = chessComBoard.classList.contains('flipped') || chessComBoard.getAttribute('board-orientation') === 'black';
          surface = chessComBoard.querySelector('.board') || chessComBoard.shadowRoot?.querySelector('.board') || chessComBoard;
        }
        const rect = surface.getBoundingClientRect();
        const sz = rect.width / 8;
        function sqPx(sq) {
          const f = files.indexOf(sq[0]), r = parseInt(sq[1]) - 1;
          const x = isFlipped ? rect.left + (7 - f + 0.5) * sz : rect.left + (f + 0.5) * sz;
          const y = isFlipped ? rect.top + (r + 0.5) * sz      : rect.top + (7 - r + 0.5) * sz;
          return { x, y };
        }
        const fp = sqPx(from), tp = sqPx(to);
        if (isLichess) {
          function fire(el, type, x, y, btns) {
            el.dispatchEvent(new PointerEvent(type, { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:btns!=null?btns:1 }));
          }
          let pieceEl = null;
          const pieces = surface.querySelectorAll('piece');
          let bestDist = sz;
          for (const p of pieces) {
            const m = p.style.transform.match(/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/);
            if (!m) continue;
            const px = parseFloat(m[1]), py = parseFloat(m[2]);
            const ef = files.indexOf(from[0]), er = parseInt(from[1]) - 1;
            const ex = isFlipped ? (7-ef)*sz : ef*sz;
            const ey = isFlipped ? er*sz : (7-er)*sz;
            const d = Math.hypot(px-ex, py-ey);
            if (d < bestDist) { bestDist = d; pieceEl = p; }
          }
          const fromEl = pieceEl || document.elementFromPoint(fp.x, fp.y) || surface;
          fire(fromEl, 'pointerdown', fp.x, fp.y, 1);
          fromEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:fp.x, clientY:fp.y, button:0, buttons:1 }));
          setTimeout(() => {
            document.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true, composed:true, clientX:tp.x, clientY:tp.y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }));
            setTimeout(() => {
              const toEl = document.elementFromPoint(tp.x, tp.y) || surface;
              fire(toEl, 'pointerup', tp.x, tp.y, 0);
              toEl.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:tp.x, clientY:tp.y, button:0 }));
            }, 50);
          }, 50);
        } else {
          function fireClick(x, y) {
            const el = document.elementFromPoint(x, y) || chessComBoard;
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:1 }));
            el.dispatchEvent(new MouseEvent('mousedown',   { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, buttons:1 }));
            el.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, composed:true, clientX:x, clientY:y, pointerId:1, pointerType:'mouse', isPrimary:true, button:0, buttons:0 }));
            el.dispatchEvent(new MouseEvent('mouseup',     { bubbles:true, clientX:x, clientY:y, button:0, buttons:0 }));
            el.dispatchEvent(new MouseEvent('click',       { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 }));
          }
          fireClick(fp.x, fp.y);
          setTimeout(() => fireClick(tp.x, tp.y), 100);
        }
        return true;
      },
      args: [message.from, message.to, message.promotion || null]
    }).then(() => sendResponse({ success: true }))
      .catch(e => { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // Eval arrived in content script via WS — relay to popup
  if (message.type === 'WS_EVAL_UPDATE') {
    lastEvaluation = message.evaluation;
    chrome.runtime.sendMessage({ type: 'EVAL_RESULT', evaluation: message.evaluation }).catch(() => {});
    return;
  }

  if (message.type === 'GET_LAST_EVAL') {
    sendResponse({ evaluation: lastEvaluation });
    return true;
  }

  if (message.type === 'SET_DEPTH') {
    broadcastToContentScripts({ type: 'SET_DEPTH', depth: message.depth });
    sendResponse({ success: true });
    return true;
  }

  // These are forwarded to content scripts, which relay over WebSocket to the engine
  if (['SET_SKILL_LEVEL', 'SET_ELO', 'SET_MULTIPV', 'STOP_ANALYSIS', 'RESET_ENGINE'].includes(message.type)) {
    broadcastToContentScripts(message);
    sendResponse({ success: true });
    return true;
  }

  return false;
});

async function broadcastToContentScripts(message) {
  try {
    if (!cachedContentTabIds) {
      const [chessTabs, lichessTabs] = await Promise.all([
        chrome.tabs.query({ url: 'https://www.chess.com/*' }),
        chrome.tabs.query({ url: 'https://lichess.org/*' })
      ]);
      cachedContentTabIds = [...chessTabs, ...lichessTabs].map(t => t.id);
      tabCacheTimer = setTimeout(invalidateTabCache, 10000);
    }
    await Promise.all(
      cachedContentTabIds.map(id =>
        chrome.tabs.sendMessage(id, message).catch(() => {
          cachedContentTabIds = cachedContentTabIds?.filter(t => t !== id) ?? null;
        })
      )
    );
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (e) {
    console.error('Chessist SW: broadcast error:', e);
  }
}
