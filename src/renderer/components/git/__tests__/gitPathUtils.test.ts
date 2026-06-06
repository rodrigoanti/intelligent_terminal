import { describe, expect, it } from 'vitest'
import {
  canGitStageEntry,
  canGitUnstageEntry,
  gitDisplayFileName,
  gitWorktreePath,
  hasGitStagedChanges,
  hasGitUnstagedChanges,
  isGitEntryFullyStaged,
  splitGitFilesByArea,
} from '../gitPathUtils'

describe('gitPathUtils', () => {
  it('gitWorktreePath uses destination on rename', () => {
    expect(gitWorktreePath({ status: 'R ', path: 'old.ts -> new.ts' })).toBe('new.ts')
  })

  it('isGitEntryFullyStaged detects staged-only entries', () => {
    expect(isGitEntryFullyStaged({ status: 'M ', path: 'a.ts' })).toBe(true)
    expect(isGitEntryFullyStaged({ status: 'MM', path: 'a.ts' })).toBe(false)
    expect(isGitEntryFullyStaged({ status: '??', path: 'a.ts' })).toBe(false)
  })

  it('canGitStageEntry allows untracked and unstaged', () => {
    expect(canGitStageEntry({ status: '??', path: 'a.ts' })).toBe(true)
    expect(canGitStageEntry({ status: ' M', path: 'a.ts' })).toBe(true)
    expect(canGitStageEntry({ status: 'M ', path: 'a.ts' })).toBe(false)
  })

  it('splitGitFilesByArea separates staged and unstaged', () => {
    const files = [
      { status: ' M', path: 'unstaged.ts' },
      { status: 'M ', path: 'staged.ts' },
      { status: 'MM', path: 'both.ts' },
      { status: '??', path: 'new.ts' },
    ]
    const { unstaged, staged } = splitGitFilesByArea(files)
    expect(unstaged.map(f => f.path)).toEqual(['unstaged.ts', 'both.ts', 'new.ts'])
    expect(staged.map(f => f.path)).toEqual(['staged.ts', 'both.ts'])
  })

  it('gitDisplayFileName shows basename', () => {
    expect(gitDisplayFileName({ status: 'M ', path: 'src/foo/bar.ts' })).toBe('bar.ts')
  })

  it('hasGitStagedChanges and hasGitUnstagedChanges', () => {
    expect(hasGitStagedChanges({ status: 'M ', path: 'a' })).toBe(true)
    expect(hasGitUnstagedChanges({ status: ' M', path: 'a' })).toBe(true)
    expect(hasGitStagedChanges({ status: '??', path: 'a' })).toBe(false)
    expect(hasGitUnstagedChanges({ status: '??', path: 'a' })).toBe(true)
  })

  it('canGitUnstageEntry mirrors staged index changes', () => {
    expect(canGitUnstageEntry({ status: 'M ', path: 'a' })).toBe(true)
    expect(canGitUnstageEntry({ status: '??', path: 'a' })).toBe(false)
    expect(canGitUnstageEntry({ status: ' M', path: 'a' })).toBe(false)
  })
})
