// In-app git self-update: checks GitHub for newer commits on origin/main and,
// on request, pulls + reinstalls + rebuilds, then the app relaunches.
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')        // repo root (when run from source)
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function isGitRepo() {
  return fs.existsSync(path.join(ROOT, '.git'))
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
  if (!isGitRepo()) return { unsupported: true }
  if ((await run('git', ['rev-parse', 'HEAD'])).code !== 0) return { error: 'Not a git checkout.' }
  const fetch = await run('git', ['fetch', '--quiet', '--tags', 'origin', 'main'])
  if (fetch.code !== 0) return { error: 'Could not reach GitHub: ' + fetch.out.trim() }
  const head = (await run('git', ['rev-parse', 'HEAD'])).out.trim()

  if (beta) {
    const remote = (await run('git', ['rev-parse', 'origin/main'])).out.trim()
    const behind = parseInt(((await run('git', ['rev-list', '--count', 'HEAD..origin/main'])).out || '').trim() || '0', 10)
    return { channel: 'beta', available: !!remote && remote !== head, behind }
  }

  const tag = await latestTag()
  if (!tag) return { channel: 'stable', available: false, noReleases: true }
  const tagSha = (await run('git', ['rev-list', '-n', '1', tag])).out.trim()
  return { channel: 'stable', available: !!tagSha && tagSha !== head, tag }
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
