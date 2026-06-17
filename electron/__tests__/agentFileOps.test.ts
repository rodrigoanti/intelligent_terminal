import { afterAll, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(() => ''),
  },
}))

import { resolveSafeProjectPath } from '../agentFileOps'
import { createDirForExplorer, createFileForExplorer } from '../fileExplorerOps'
import { copyPathsForExplorer, pasteIntoExplorer } from '../fileExplorerClipboardOps'

function expectResolved(root: string, relPath: string): void {
  const resolved = resolveSafeProjectPath(root, relPath)
  expect(resolved).not.toBeNull()
  const tail = relPath.split('/')
  expect(resolved!.split('/').slice(-tail.length).join('/')).toBe(relPath)
}

describe('resolveSafeProjectPath', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-path-'))

  mkdirSync(join(root, 'landing'), { recursive: true })
  writeFileSync(join(root, 'readme.md'), '')

  it('resolves existing files', () => {
    expectResolved(root, 'readme.md')
    expectResolved(root, 'landing/readme.md')
  })

  it('resolves not-yet-created files under existing dirs', () => {
    expectResolved(root, 'landing/hola.ts')
  })

  it('resolves not-yet-created nested paths from project root', () => {
    expectResolved(root, 'new/nested/file.ts')
  })

  it('resolves not-yet-created files at project root', () => {
    expectResolved(root, 'hola.ts')
  })

  it('rejects paths outside project', () => {
    expect(resolveSafeProjectPath(root, '../escape.ts')).toBeNull()
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })
})

describe('file explorer create + clipboard', () => {
  const root = mkdtempSync(join(tmpdir(), 'fe-clip-'))
  const sessionId = 'test-session'

  mkdirSync(join(root, 'landing'), { recursive: true })

  it('creates files and directories', () => {
    expect(createFileForExplorer(root, 'landing/hola.ts').ok).toBe(true)
    expect(existsSync(join(root, 'landing', 'hola.ts'))).toBe(true)

    expect(createDirForExplorer(root, 'nested/dir').ok).toBe(true)
    expect(existsSync(join(root, 'nested', 'dir'))).toBe(true)
  })

  it('creates files at project root', () => {
    expect(createFileForExplorer(root, 'root-file.ts').ok).toBe(true)
    expect(existsSync(join(root, 'root-file.ts'))).toBe(true)
  })

  it('copies and pastes inside project', () => {
    writeFileSync(join(root, 'copy-me.txt'), 'hello')
    const copy = copyPathsForExplorer(sessionId, root, ['copy-me.txt'])
    expect(copy.ok).toBe(true)

    mkdirSync(join(root, 'paste-target'), { recursive: true })
    const paste = pasteIntoExplorer(sessionId, root, 'paste-target')
    expect(paste.ok).toBe(true)
    expect(existsSync(join(root, 'paste-target', 'copy-me.txt'))).toBe(true)
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })
})
