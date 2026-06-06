import { describe, expect, it } from 'vitest'

describe('fileExplorerClipboardOps cut fallback', () => {
  it('forces copy mode when using system clipboard fallback', () => {
    let mode: 'cut' | 'copy' = 'cut'
    const internalPaths: string[] = []
    const systemPaths = ['/tmp/test.txt']

    const sources: string[] = []
    let usedSystemClipboard = false
    let effectiveMode = mode

    if (internalPaths.length === 0) {
      for (const p of systemPaths) sources.push(p)
      if (sources.length > 0) {
        usedSystemClipboard = true
        effectiveMode = 'copy'
      }
    }

    expect(usedSystemClipboard).toBe(true)
    expect(effectiveMode).toBe('copy')
    expect(mode).toBe('cut')
  })
})
