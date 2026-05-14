import { app } from 'electron'
import { join, normalize } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const MAX_ENTRIES = 15
const SUBDIR = 'user-history'
const FILENAME = 'cd-recent.md'

export function getCdRecentFilePath(): string {
  return join(app.getPath('userData'), SUBDIR, FILENAME)
}

function parseBulletPaths(md: string): string[] {
  const out: string[] = []
  for (const line of md.split('\n')) {
    const m = line.match(/^\s*-\s+(.+)$/)
    if (!m) continue
    let s = m[1].trim()
    if (s.startsWith('`') && s.endsWith('`')) s = s.slice(1, -1)
    out.push(s.trim())
  }
  return out
}

function formatMd(paths: string[]): string {
  return [
    '# Carpetas recientes',
    '',
    'Rutas absolutas usadas con `cd` (máximo 15, sin duplicar; la más reciente arriba).',
    '',
    '## Rutas',
    '',
    ...paths.map(p => `- ${p}`),
    '',
  ].join('\n')
}

export function readCdRecentFolders(): string[] {
  const file = getCdRecentFilePath()
  if (!existsSync(file)) return []
  try {
    return parseBulletPaths(readFileSync(file, 'utf-8'))
  } catch {
    return []
  }
}

/** Añade o reordena una ruta al principio del listado (sin duplicar). */
export function appendCdRecentFolder(resolvedAbsolute: string): void {
  const norm = normalize(resolvedAbsolute)
  const dir = join(app.getPath('userData'), SUBDIR)
  mkdirSync(dir, { recursive: true })
  const file = getCdRecentFilePath()
  let existing: string[] = []
  if (existsSync(file)) {
    try {
      existing = parseBulletPaths(readFileSync(file, 'utf-8'))
    } catch {
      /* ignore */
    }
  }
  const next = [norm, ...existing.filter(p => normalize(p) !== norm)].slice(0, MAX_ENTRIES)
  try {
    writeFileSync(file, formatMd(next), 'utf-8')
  } catch (err) {
    console.error('[cd-recent] no se pudo escribir', file, err)
  }
}
