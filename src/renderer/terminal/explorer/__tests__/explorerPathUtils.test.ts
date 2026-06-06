import { describe, expect, it } from 'vitest'
import {
  buildNewRelPath,
  expandedPathsKey,
  isRelPathInside,
  pasteDestRelPath,
  remapChildRelPath,
  relPathFromCwd,
} from '../explorerPathUtils'

describe('remapChildRelPath', () => {
  it('remaps exact match', () => {
    expect(remapChildRelPath('src', 'src', 'lib')).toBe('lib')
  })

  it('remaps child paths', () => {
    expect(remapChildRelPath('src/foo.ts', 'src', 'lib')).toBe('lib/foo.ts')
    expect(remapChildRelPath('src/nested/bar.ts', 'src', 'lib')).toBe('lib/nested/bar.ts')
  })

  it('returns null when prefix does not apply', () => {
    expect(remapChildRelPath('other/foo.ts', 'src', 'lib')).toBeNull()
  })
})

describe('buildNewRelPath', () => {
  it('combines parent and name', () => {
    expect(buildNewRelPath('foo.ts', 'src')).toBe('src/foo.ts')
    expect(buildNewRelPath('dir', '')).toBe('dir')
  })

  it('rejects invalid names', () => {
    expect(buildNewRelPath('..', 'src')).toBeNull()
    expect(buildNewRelPath('', 'src')).toBeNull()
  })
})

describe('expandedPathsKey', () => {
  it('is order-independent', () => {
    expect(expandedPathsKey(['b', 'a'])).toBe(expandedPathsKey(['a', 'b']))
  })
})

describe('pasteDestRelPath', () => {
  it('uses directory selection', () => {
    expect(pasteDestRelPath({ relPath: 'src', isDirectory: true })).toBe('src')
  })

  it('uses parent for file selection', () => {
    expect(pasteDestRelPath({ relPath: 'src/foo.ts', isDirectory: false })).toBe('src')
  })
})

describe('isRelPathInside', () => {
  it('returns true for same path', () => {
    expect(isRelPathInside('src', 'src')).toBe(true)
  })

  it('returns true when child is nested under parent', () => {
    expect(isRelPathInside('src', 'src/foo.ts')).toBe(true)
    expect(isRelPathInside('src', 'src/nested/bar.ts')).toBe(true)
  })

  it('returns false for unrelated paths', () => {
    expect(isRelPathInside('src', 'lib/foo.ts')).toBe(false)
    expect(isRelPathInside('src', 'srcfoo')).toBe(false)
  })

  it('returns false when parent is empty', () => {
    expect(isRelPathInside('', 'foo.ts')).toBe(false)
  })
})

describe('relPathFromCwd', () => {
  it('returns empty for same cwd', () => {
    expect(relPathFromCwd('/proj', '/proj')).toBe('')
  })

  it('returns relative segment', () => {
    expect(relPathFromCwd('/proj', '/proj/src')).toBe('src')
  })

  it('returns null outside tree', () => {
    expect(relPathFromCwd('/proj', '/other')).toBeNull()
  })
})
