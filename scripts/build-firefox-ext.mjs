// Produces a Firefox-flavored copy of the extension in firefox/.
// Same content scripts/background/popup as Chrome; only the manifest differs
// (Firefox MV3 uses a background event page via `scripts`, needs a gecko id,
// and doesn't enforce Chrome's loopback Private-Network-Access block).
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'extension')
const out = join(root, 'firefox')
const ffManifest = join(root, 'manifest.firefox.json')

if (!existsSync(src)) { console.error('extension/ not found'); process.exit(1) }
if (!existsSync(ffManifest)) { console.error('manifest.firefox.json not found'); process.exit(1) }

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(src, out, { recursive: true })
copyFileSync(ffManifest, join(out, 'manifest.json'))

console.log('Firefox extension written to firefox/ (load via about:debugging → Load Temporary Add-on → manifest.json)')
