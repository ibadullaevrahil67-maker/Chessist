// In-app git self-update: checks GitHub for newer commits on origin/main and,
// on request, pulls + reinstalls + rebuilds, then the app relaunches.
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const https = require('https')

const ROOT = path.join(__dirname, '..')        // repo root (when run from source)
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const REPO = 'imluri/Chessist'

function isGitRepo() {
  return fs.existsSync(path.join(ROOT, '.git'))
}

function appVersion() {
  try { return require('electron').app.getVersion() }
  catch { try { return require('../package.json').version } catch { return '' } }
}

// GET a GitHub API endpoint as JSON (User-Agent is required by GitHub).
// Prefer Electron's net (Chromium stack → OS cert store + system proxy, so it
// works behind corporate TLS interception); fall back to node https off-Electron.
function httpJson(url) {
  return new Promise((resolve, reject) => {
    const headers = { 'User-Agent': 'Chessist', Accept: 'application/vnd.github+json' }
    const finish = (statusCode, body) => {
      if (statusCode < 200 || statusCode >= 300) return reject(new Error('HTTP ' + statusCode))
      try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
    }
    let net
    try { net = require('electron').net } catch (e) { net = null }
    if (net) {
      const req = net.request(url)
      for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)
      let body = ''
      req.on('response', (res) => {
        res.on('data', (d) => { body += d })
        res.on('end', () => finish(res.statusCode, body))
      })
      req.on('error', reject)
      req.end()
    } else {
      https.get(url, { headers }, (res) => {
        let body = ''
        res.on('data', (d) => { body += d })
        res.on('end', () => finish(res.statusCode, body))
      }).on('error', reject)
    }
  })
}

// Numeric semver compare; true when `remote` is strictly newer than `installed`.
function isNewer(remote, installed) {
  const norm = (s) => String(s || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const a = norm(remote), b = norm(installed)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}

// Non-git installs (ZIP / packaged) can't run git, so we query GitHub over HTTP
// like a normal release check. We can detect a newer version but can't auto-apply,
// so the result is flagged `manual` and the UI links to the Releases page.
//   stable → newest release tag vs installed version
//   beta   → tip-of-main commit SHA (UI compares to the baked build SHA)
async function checkRemote(beta) {
  const installed = appVersion()
  try {
    if (beta) {
      const c = await httpJson(`https://api.github.com/repos/${REPO}/commits/main`)
      return { channel: 'beta', manual: true, latestSha: String(c.sha || '').slice(0, 7), version: installed }
    }
    let tag
    try { tag = (await httpJson(`https://api.github.com/repos/${REPO}/releases/latest`)).tag_name }
    catch { const tags = await httpJson(`https://api.github.com/repos/${REPO}/tags`); tag = tags && tags[0] && tags[0].name }
    if (!tag) return { channel: 'stable', manual: true, noReleases: true, version: installed }
    return { channel: 'stable', manual: true, tag, available: isNewer(tag, installed), version: installed }
  } catch (e) {
    return { manual: true, error: 'Could not reach GitHub.' }
  }
}

function run(cmd, args, onLog) {
  return new Promise((resolve) => {
    let out = ''
    let proc
    try {
      proc = spawn(cmd, args, { cwd: ROOT, windowsHide: true })
    } catch (e) {
      onLog?.(String(e.message) + '\n')
      resolve({ code: -1, out: String(e.message) })
      return
    }
    const onData = (d) => { const s = d.toString(); out += s; onLog?.(s) }
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.on('error', (e) => { onLog?.(String(e.message) + '\n'); resolve({ code: -1, out: out + e.message }) })
    proc.on('close', (code) => resolve({ code: code ?? -1, out }))
  })
}

async function latestTag() {
  const tags = (await run('git', ['tag', '--list', 'v*', '--sort=-v:refname'])).out.trim()
  return tags ? tags.split(/\r?\n/)[0].trim() : ''
}

// beta  → track origin/main (any new commit is an update).
// stable→ track the newest release tag (v*); no tags yet = nothing to update to.
// Returns { unsupported } | { error } | { channel, available, behind?, tag?, noReleases? }.
async function checkForUpdate(beta = false) {
  if (!isGitRepo()) return checkRemote(beta)
  if ((await run('git', ['rev-parse', 'HEAD'])).code !== 0) return { error: 'Not a git checkout.' }
  const fetch = await run('git', ['fetch', '--quiet', '--tags', 'origin', 'main'])
  if (fetch.code !== 0) return { error: 'Could not reach GitHub: ' + fetch.out.trim() }
  const head = (await run('git', ['rev-parse', 'HEAD'])).out.trim()
  const headShort = (await run('git', ['rev-parse', '--short', 'HEAD'])).out.trim() || head.slice(0, 7)

  if (beta) {
    const remote = (await run('git', ['rev-parse', 'origin/main'])).out.trim()
    const behind = parseInt(((await run('git', ['rev-list', '--count', 'HEAD..origin/main'])).out || '').trim() || '0', 10)
    return { channel: 'beta', available: !!remote && remote !== head, behind, head: headShort }
  }

  const tag = await latestTag()
  if (!tag) return { channel: 'stable', available: false, noReleases: true, head: headShort }
  const tagSha = (await run('git', ['rev-list', '-n', '1', tag])).out.trim()
  return { channel: 'stable', available: !!tagSha && tagSha !== head, tag, head: headShort }
}

// Checks out the channel target, reinstalls, rebuilds. Returns { ok } | { ok:false, step, code }.
async function applyUpdate(beta, onLog) {
  onLog?.('\n$ git fetch --tags origin main\n')
  let r = await run('git', ['fetch', '--tags', 'origin', 'main'], onLog)
  if (r.code !== 0) return { ok: false, step: 'git fetch', code: r.code }

  // beta stays on the main branch; stable detaches at the release tag.
  let checkout
  if (beta) {
    checkout = ['checkout', '-B', 'main', 'origin/main']
  } else {
    const tag = await latestTag()
    if (!tag) { onLog?.('\nNo release tag to update to.\n'); return { ok: false, step: 'no release tag', code: -1 } }
    checkout = ['checkout', '--force', tag]
  }

  const steps = [
    ['git', checkout],
    [NPM, ['install']],
    [NPM, ['run', 'build:overlay']],
    [NPM, ['run', 'build']],
  ]
  for (const [cmd, args] of steps) {
    onLog?.(`\n$ ${cmd} ${args.join(' ')}\n`)
    r = await run(cmd, args, onLog)
    if (r.code !== 0) {
      onLog?.(`\nStep failed (exit ${r.code}).\n`)
      return { ok: false, step: `${cmd} ${args.join(' ')}`, code: r.code }
    }
  }
  onLog?.('\nUpdate complete — restarting…\n')
  return { ok: true }
}

module.exports = { isGitRepo, latestTag, checkForUpdate, applyUpdate }
