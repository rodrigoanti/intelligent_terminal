import { describe, expect, it } from 'vitest'
import { isDestructiveShellCommand, requiresShellConfirmation } from '../agentShellGuard'

describe('agentShellGuard', () => {
  it('detects destructive commands', () => {
    expect(isDestructiveShellCommand('rm -rf /tmp/foo')).toBe(true)
    expect(isDestructiveShellCommand('ls -la')).toBe(false)
  })

  it('requires confirmation for destructive even with always policy', () => {
    expect(requiresShellConfirmation('rm -rf node_modules', 'always')).toBe(true)
  })

  it('requires confirmation for ask policy', () => {
    expect(requiresShellConfirmation('npm test', 'ask')).toBe(true)
  })
})
