import type { TFunction } from 'i18next'
import type { GitErrorCode } from '@shared/gitErrorCodes'
import type { GitCommandResult } from '@shared/gitSessionTypes'

export function gitErrorMessage(t: TFunction, code?: GitErrorCode, fallback?: string): string {
  if (!code) return fallback ?? ''
  const key = `git.errors.${code}` as const
  const translated = t(key)
  return translated !== key ? translated : (fallback ?? translated)
}

export function formatGitCommandResult(t: TFunction, label: string, r: GitCommandResult): string {
  const errLine = r.errorCode
    ? gitErrorMessage(t, r.errorCode, r.stderr.trim())
    : r.stderr.trim()
  const parts = [
    `— ${label} (exit ${r.exitCode ?? '?'}) —`,
    errLine && `stderr:\n${errLine}`,
    r.stdout.trim() && `stdout:\n${r.stdout.trim()}`,
  ].filter(Boolean)
  return parts.join('\n\n')
}
