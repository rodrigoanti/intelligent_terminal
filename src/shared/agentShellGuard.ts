const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-[a-z]*r[a-z]*f/i,
  /\brm\s+-[a-z]*f[a-z]*r/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b>\s*\/dev\/[sh]d[a-z]/i,
  /\bchmod\s+-R\s+777\b/i,
  /\bcurl\b[^\n|]*\|\s*(ba)?sh\b/i,
  /\bwget\b[^\n|]*\|\s*(ba)?sh\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
]

export function isDestructiveShellCommand(cmd: string): boolean {
  const trimmed = cmd.trim()
  if (!trimmed) return false
  return DESTRUCTIVE_PATTERNS.some(r => r.test(trimmed))
}

export function requiresShellConfirmation(
  cmd: string,
  policy: 'off' | 'ask' | 'always',
): boolean {
  if (policy === 'off') return false
  if (policy === 'ask') return true
  return isDestructiveShellCommand(cmd)
}
