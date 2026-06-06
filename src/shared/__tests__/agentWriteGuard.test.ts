import { describe, expect, it } from 'vitest'
import {
  filterWritesByUserIntent,
  isSensitiveWritePath,
  pathLikelyRequested,
  userWantsFileChanges,
} from '../agentWriteGuard'

describe('agentWriteGuard', () => {
  it('blocks writes when user did not request file changes', () => {
    const result = filterWritesByUserIntent('what is this file?', [
      { path: 'src/foo.ts', content: 'export const x = 1\n' },
    ])
    expect(result.allowed).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
  })

  it('allows writes for explicit edit requests', () => {
    const msg = 'update src/foo.ts with the fix'
    const result = filterWritesByUserIntent(msg, [
      { path: 'src/foo.ts', content: 'export const x = 2\n' },
    ])
    expect(result.allowed).toHaveLength(1)
  })

  it('blocks sensitive paths', () => {
    expect(isSensitiveWritePath('.env')).toBe(true)
    expect(isSensitiveWritePath('src/app.ts')).toBe(false)
  })

  it('detects path in user message', () => {
    expect(pathLikelyRequested('fix src/App.tsx please', 'src/App.tsx')).toBe(true)
  })

  it('userWantsFileChanges for edit verbs', () => {
    expect(userWantsFileChanges('create README.md')).toBe(true)
    expect(userWantsFileChanges('how does this work?')).toBe(false)
  })
})
