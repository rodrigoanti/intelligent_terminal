import { dirname, normalize, relative, resolve } from 'path'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'

const MAX_READ_BYTES = 600_000

/**
 * Resuelve `relPath` bajo `projectRoot` sin salir del árbol del proyecto.
 */
/** Evita que el modelo cree `ia-terminal/` (sin punto); solo `.ai-terminal/`. */
function normalizeRelSegments(segments: string[]): string[] {
  const s = [...segments]
  if (s[0] === 'ia-terminal') {
    s[0] = '.ai-terminal'
    return s
  }
  if (s[0] === '.' && s[1] === 'ia-terminal') {
    s.splice(0, 2, '.ai-terminal')
    return s
  }
  return s
}

export function resolveSafeProjectPath(projectRoot: string, relPathRaw: string): string | null {
  const raw = String(relPathRaw).trim().replace(/\\/g, '/')
  if (!raw || raw.includes('\0')) return null
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) return null
  const segments = normalizeRelSegments(raw.split('/').filter(Boolean))
  if (segments.some(s => s === '..')) return null

  const root = resolve(normalize(String(projectRoot).trim()))
  const abs = resolve(root, ...segments)
  const rel = relative(root, abs)
  if (!rel || rel === '.' || rel.startsWith('..') || rel.split(/[/\\]/).some(s => s === '..')) {
    return null
  }
  return abs
}

export function readProjectFile(
  projectRoot: string,
  relPath: string,
): { ok: true; content: string } | { ok: false; error: string } {
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) return { ok: false, error: 'invalid path or outside project' }
  try {
    const st = statSync(abs)
    if (!st.isFile()) return { ok: false, error: 'not a regular file' }
    if (st.size > MAX_READ_BYTES) return { ok: false, error: 'file too large to read into context' }
    return { ok: true, content: readFileSync(abs, 'utf-8') }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export function writeProjectFile(
  projectRoot: string,
  relPath: string,
  content: string,
): { ok: true } | { ok: false; error: string } {
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) return { ok: false, error: 'invalid path or outside project' }
  try {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf-8')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
