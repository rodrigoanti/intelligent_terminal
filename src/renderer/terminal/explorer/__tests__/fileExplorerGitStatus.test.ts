import { describe, expect, it } from 'vitest'
import { buildGitStatusMap } from '../fileExplorerGitStatus'
import type { GitRepoStatus } from '@shared/gitSessionTypes'

function status(files: GitRepoStatus['files']): GitRepoStatus {
  return {
    isRepo: true,
    sessionCwd: '/repo',
    repoRoot: '/repo',
    files,
    hasStaged: false,
    hasUnstaged: false,
  }
}

describe('buildGitStatusMap', () => {
  it('maps new and modified files', () => {
    const map = buildGitStatusMap(status([
      { path: 'new.ts', status: '??' },
      { path: 'edit.ts', status: ' M' },
    ]))
    expect(map.get('new.ts')).toBe('new')
    expect(map.get('edit.ts')).toBe('modified')
  })

  it('propagates status to parent directories', () => {
    const map = buildGitStatusMap(status([{ path: 'src/foo.ts', status: ' M' }]))
    expect(map.get('src/foo.ts')).toBe('modified')
    expect(map.get('src')).toBe('modified')
  })

  it('detects deleted and conflict states', () => {
    const map = buildGitStatusMap(status([
      { path: 'gone.ts', status: ' D' },
      { path: 'both.ts', status: 'UU' },
    ]))
    expect(map.get('gone.ts')).toBe('deleted')
    expect(map.get('both.ts')).toBe('conflict')
  })
})
