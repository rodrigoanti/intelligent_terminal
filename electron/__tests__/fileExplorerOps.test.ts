import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createDirForExplorer, createFileForExplorer, listDirChildren } from '../fileExplorerOps'

describe('fileExplorerOps', () => {
  const root = mkdtempSync(join(tmpdir(), 'fe-test-'))

  it('lists directory children', () => {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'readme.md'), '')
    const result = listDirChildren(root, '')
    expect(result.ok).toBe(true)
    expect(result.entries.some(e => e.name === 'src' && e.isDirectory)).toBe(true)
    expect(result.entries.some(e => e.name === 'readme.md')).toBe(true)
  })

  it('hides heavy dirs when showHiddenDirs is false', () => {
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    const hidden = listDirChildren(root, '', false)
    expect(hidden.entries.every(e => e.name !== 'node_modules')).toBe(true)
    const shown = listDirChildren(root, '', true)
    expect(shown.entries.some(e => e.name === 'node_modules')).toBe(true)
  })

  it('rejects duplicate directory creation', () => {
    const dir = join(root, 'dup-dir')
    mkdirSync(dir)
    const result = createDirForExplorer(root, 'dup-dir')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DIR_EXISTS')
  })

  it('rejects duplicate file creation', () => {
    writeFileSync(join(root, 'exists.txt'), '')
    const result = createFileForExplorer(root, 'exists.txt')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_EXISTS')
  })

  rmSync(root, { recursive: true, force: true })
})
