import { basename, dirname, normalize, relative, resolve } from 'path'
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'fs'

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

function isInsideRealRoot(realRoot: string, absPath: string): boolean {
  const realRel = relative(realRoot, absPath)
  if (realRel.startsWith('..')) return false
  return !realRel.split(/[/\\]/).some(s => s === '..')
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

  try {
    const realRoot = realpathSync.native(root)

    if (existsSync(abs)) {
      const realAbs = realpathSync.native(abs)
      if (!isInsideRealRoot(realRoot, realAbs)) return null
      return realAbs
    }

    const tail: string[] = []
    let probe = abs
    while (!existsSync(probe)) {
      tail.unshift(basename(probe))
      const parent = dirname(probe)
      if (parent === probe) break
      probe = parent
    }

    const realBase = realpathSync.native(probe)
    if (!isInsideRealRoot(realRoot, realBase)) return null

    const resolved = tail.length > 0 ? resolve(realBase, ...tail) : realBase
    if (!isInsideRealRoot(realRoot, resolved)) return null
    return resolved
  } catch {
    return null
  }
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

export interface ReadLineRange {
  startLine: number
  endLine: number
}

/** Lee líneas 1-indexed inclusive; el contenido incluye prefijo `N|`. */
export function readProjectFileLines(
  projectRoot: string,
  relPath: string,
  range: ReadLineRange,
): { ok: true; content: string; totalLines: number } | { ok: false; error: string } {
  const full = readProjectFile(projectRoot, relPath)
  if (!full.ok) return full
  const lines = full.content.split('\n')
  const totalLines = lines.length
  const start = Math.max(1, Math.min(range.startLine, totalLines))
  const end = Math.max(start, Math.min(range.endLine, totalLines))
  const slice = lines.slice(start - 1, end)
  const numbered = slice.map((line, i) => `${start + i}|${line}`).join('\n')
  return { ok: true, content: numbered, totalLines }
}

export interface PatchHunk {
  search: string
  replace: string
}

/** Aplica hunks en orden; cada `search` debe aparecer exactamente una vez. */
export function applyProjectPatch(
  projectRoot: string,
  relPath: string,
  hunks: PatchHunk[],
): { ok: true } | { ok: false; error: string } {
  const full = readProjectFile(projectRoot, relPath)
  if (!full.ok) return full
  let content = full.content
  for (let i = 0; i < hunks.length; i++) {
    const { search, replace } = hunks[i]
    if (!search) return { ok: false, error: `hunk ${i + 1}: empty search` }
    const count = content.split(search).length - 1
    if (count === 0) return { ok: false, error: `hunk ${i + 1}: search text not found` }
    if (count > 1) return { ok: false, error: `hunk ${i + 1}: search text is ambiguous (${count} matches)` }
    content = content.replace(search, replace)
  }
  return writeProjectFile(projectRoot, relPath, content)
}
