import { describe, expect, it } from 'vitest'
import { isPathInside } from '../fileExplorerClipboardOps'

describe('isPathInside', () => {
  it('detects child paths', () => {
    expect(isPathInside('/tmp/parent', '/tmp/parent/child')).toBe(true)
  })

  it('rejects siblings and parents', () => {
    expect(isPathInside('/tmp/parent/child', '/tmp/parent')).toBe(false)
    expect(isPathInside('/tmp/a', '/tmp/b')).toBe(false)
  })
})
