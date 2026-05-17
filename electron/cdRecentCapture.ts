import { normalize } from 'path'
import { appendCdRecentFolder } from './cdRecentMd'
import { resolveCdTarget } from './shellCwdSync'

const sessionCwd = new Map<string, string>()
/** cwd persistido entre reinicios; no se borra al recrear el PTY (solo al cerrar el panel). */
const persistedSessionCwd = new Map<string, string>()

/** cwd lógico por pestaña (se actualiza con cada `cd` detectado en la entrada del usuario). */
export function ensureSessionCdState(sessionId: string, home: string): void {
  if (!sessionCwd.has(sessionId)) sessionCwd.set(sessionId, home)
}

/** Limpia el cwd en memoria del PTY activo (p. ej. al matar el proceso). */
export function clearSessionCdState(sessionId: string): void {
  sessionCwd.delete(sessionId)
}

/** Elimina el cwd persistido al cerrar un panel de forma permanente. */
export function clearPersistedSessionCwd(sessionId: string): void {
  sessionCwd.delete(sessionId)
  persistedSessionCwd.delete(sessionId)
}

export function getSessionCwd(sessionId: string): string | null {
  return sessionCwd.get(sessionId) ?? persistedSessionCwd.get(sessionId) ?? null
}

/** Tras spawn con cwd inicial (p. ej. panel dividido con la misma carpeta). */
export function initSessionCwd(sessionId: string, cwd: string): void {
  const dir = normalize(cwd)
  sessionCwd.set(sessionId, dir)
  persistedSessionCwd.set(sessionId, dir)
}

/**
 * Procesa una línea enviada al PTY (texto ya completo) y actualiza Markdown + cwd lógico.
 * @returns El nuevo cwd si cambió tras un `cd` válido; si no, `null`.
 */
export function recordCdFromUserLine(sessionId: string, line: string, home: string): string | null {
  ensureSessionCdState(sessionId, home)
  const before = normalize(sessionCwd.get(sessionId) ?? persistedSessionCwd.get(sessionId) ?? home)
  let cwd = sessionCwd.get(sessionId) ?? home

  const segments = line.split(';').map(s => s.trim()).filter(Boolean)
  for (const seg of segments) {
    const t = seg.trim()
    if (!t) continue

    const cdOnly = /^\s*cd\s*$/i.exec(t)
    if (cdOnly) {
      appendCdRecentFolder(home)
      sessionCwd.set(sessionId, home)
      persistedSessionCwd.set(sessionId, home)
      cwd = home
      continue
    }

    const cdArg = /^\s*(?:builtin\s+|command\s+)?cd\s+(.+)$/i.exec(t)
    if (cdArg) {
      const resolved = resolveCdTarget(cwd, cdArg[1], home)
      if (!resolved) continue
      appendCdRecentFolder(resolved)
      sessionCwd.set(sessionId, resolved)
      persistedSessionCwd.set(sessionId, resolved)
      cwd = resolved
    }
  }

  const after = normalize(sessionCwd.get(sessionId) ?? persistedSessionCwd.get(sessionId) ?? home)
  return after !== before ? after : null
}
