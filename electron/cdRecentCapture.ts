import { normalize, resolve } from 'path'
import { appendCdRecentFolder } from './cdRecentMd'

const sessionCwd = new Map<string, string>()

/** cwd lógico por pestaña (se actualiza con cada `cd` detectado en la entrada del usuario). */
export function ensureSessionCdState(sessionId: string, home: string): void {
  if (!sessionCwd.has(sessionId)) sessionCwd.set(sessionId, home)
}

export function clearSessionCdState(sessionId: string): void {
  sessionCwd.delete(sessionId)
}

export function getSessionCwd(sessionId: string): string | null {
  return sessionCwd.get(sessionId) ?? null
}

/** Tras spawn con cwd inicial (p. ej. panel dividido con la misma carpeta). */
export function initSessionCwd(sessionId: string, cwd: string): void {
  sessionCwd.set(sessionId, normalize(cwd))
}

function stripOuterQuotes(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim()
  }
  return t
}

function expandTilde(arg: string, home: string): string {
  if (arg === '~') return home
  if (arg.startsWith('~/')) return resolve(home, arg.slice(2))
  return arg
}

/** Procesa una línea enviada al PTY (texto ya completo) y actualiza Markdown + cwd lógico. */
export function recordCdFromUserLine(sessionId: string, line: string, home: string): void {
  ensureSessionCdState(sessionId, home)
  let cwd = sessionCwd.get(sessionId) ?? home

  const segments = line.split(';').map(s => s.trim()).filter(Boolean)
  for (const seg of segments) {
    const t = seg.trim()
    if (!t) continue

    const cdOnly = /^\s*cd\s*$/i.exec(t)
    if (cdOnly) {
      appendCdRecentFolder(home)
      sessionCwd.set(sessionId, home)
      cwd = home
      continue
    }

    const cdArg = /^\s*(?:builtin\s+|command\s+)?cd\s+(.+)$/i.exec(t)
    if (cdArg) {
      let arg = stripOuterQuotes(cdArg[1].trim())
      arg = expandTilde(arg, home)
      if (arg === '-' || arg === '--') continue
      const resolved = arg.startsWith('/') ? normalize(arg) : normalize(resolve(cwd, arg))
      appendCdRecentFolder(resolved)
      sessionCwd.set(sessionId, resolved)
      cwd = resolved
    }
  }
}
