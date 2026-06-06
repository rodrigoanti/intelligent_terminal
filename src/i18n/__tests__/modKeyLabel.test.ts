import { describe, expect, it, vi, afterEach } from 'vitest'
import { modKeyLabel, shortcutLabel } from '../modKeyLabel'

describe('modKeyLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ⌘ on macOS platform', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(modKeyLabel()).toBe('⌘')
    expect(shortcutLabel('F')).toBe('⌘F')
  })

  it('returns Ctrl on Windows platform', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(modKeyLabel()).toBe('Ctrl')
    expect(shortcutLabel('F')).toBe('Ctrl+F')
  })
})
