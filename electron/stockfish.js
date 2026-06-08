const fs = require('fs')
const path = require('path')
const https = require('https')
const os = require('os')
const extract = require('extract-zip')

const RELEASES_API = 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest'

function pickWindowsAsset(assets) {
  const win = assets.filter(a => /windows/i.test(a.name) && /\.zip$/i.test(a.name))
  if (win.length === 0) return null
  const avx2 = win.find(a => /avx2/i.test(a.name))
  return (avx2 || win[0]).browser_download_url
}

function httpsJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Chessist/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsJson(res.headers.location))
      }
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Chessist/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, dest, onProgress))
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let got = 0
      const out = fs.createWriteStream(dest)
      res.on('data', d => {
        got += d.length
        if (total && onProgress) onProgress(Math.floor(got * 100 / total))
      })
      res.pipe(out)
      out.on('finish', () => out.close(resolve))
      out.on('error', reject)
    }).on('error', reject)
  })
}

// Resolve an existing stockfish path, or download one. userDataDir is app.getPath('userData').
async function ensureStockfish(userDataDir, onStatus) {
  const dest = path.join(userDataDir, 'stockfish.exe')
  if (fs.existsSync(dest)) return dest

  onStatus?.({ status: 'downloading', message: 'Stockfish: connecting...' })
  const release = await httpsJson(RELEASES_API)
  const url = pickWindowsAsset(release.assets || [])
  if (!url) { onStatus?.({ status: 'error', message: 'No Windows Stockfish asset' }); return null }

  const tmpZip = path.join(os.tmpdir(), 'stockfish_dl.zip')
  await download(url, tmpZip, pct => onStatus?.({ status: 'downloading', message: `Stockfish: ${pct}%` }))

  const tmpDir = path.join(os.tmpdir(), 'stockfish_extracted')
  fs.rmSync(tmpDir, { recursive: true, force: true })
  await extract(tmpZip, { dir: tmpDir })

  const exe = findExe(tmpDir)
  if (!exe) { onStatus?.({ status: 'error', message: 'Stockfish exe not found in zip' }); return null }
  fs.copyFileSync(exe, dest)
  fs.rmSync(tmpZip, { force: true })
  fs.rmSync(tmpDir, { recursive: true, force: true })

  onStatus?.({ status: 'ready', message: 'Stockfish ready' })
  return dest
}

function findExe(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { const r = findExe(full); if (r) return r }
    else if (/stockfish.*\.exe$/i.test(entry.name)) return full
  }
  return null
}

module.exports = { pickWindowsAsset, ensureStockfish }
