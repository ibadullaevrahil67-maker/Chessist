import { describe, it, expect } from 'vitest'
import { pickWindowsAsset } from './stockfish.js'

describe('pickWindowsAsset', () => {
  it('prefers the avx2 windows build', () => {
    const assets = [
      { name: 'stockfish-ubuntu-x86-64-avx2.tar', browser_download_url: 'u' },
      { name: 'stockfish-windows-x86-64-sse41-popcnt.zip', browser_download_url: 'w-sse' },
      { name: 'stockfish-windows-x86-64-avx2.zip', browser_download_url: 'w-avx2' },
    ]
    expect(pickWindowsAsset(assets)).toBe('w-avx2')
  })

  it('falls back to any windows zip', () => {
    const assets = [
      { name: 'stockfish-windows-x86-64.zip', browser_download_url: 'w' },
      { name: 'stockfish-android.zip', browser_download_url: 'a' },
    ]
    expect(pickWindowsAsset(assets)).toBe('w')
  })

  it('returns null when no windows asset', () => {
    expect(pickWindowsAsset([{ name: 'stockfish-mac.tar', browser_download_url: 'm' }])).toBeNull()
  })
})
