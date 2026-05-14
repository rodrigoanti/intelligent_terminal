import { join, normalize, resolve } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'

const MAX_DIR_ENTRIES = 320
const MAX_LISTING_CHARS = 12_000
const MAX_PACKAGE_JSON = 18_000
const MAX_README = 14_000

const README_NAMES = ['README.md', 'readme.md', 'Readme.md', 'README.MD']

/**
 * Lista el directorio (equivalente informativo a `ls` en la raíz del cwd),
 * y opcionalmente package.json y README.md de esa misma carpeta.
 */
export function gatherProjectAiContextForCwd(cwdRaw: string): ProjectAiContextForAi | null {
  let dir: string
  try {
    dir = normalize(resolve(String(cwdRaw).trim()))
  } catch {
    return null
  }

  let st: ReturnType<typeof statSync>
  try {
    st = statSync(dir)
  } catch {
    return null
  }
  if (!st.isDirectory()) return null

  let dirents: import('fs').Dirent[]
  try {
    dirents = readdirSync(dir, { withFileTypes: true })
  } catch {
    return {
      cwd: dir,
      listing: '(no se pudo leer el directorio)',
      packageJson: null,
      readmeMd: null,
    }
  }

  dirents.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )

  const lines: string[] = []
  for (const e of dirents) {
    if (lines.length >= MAX_DIR_ENTRIES) {
      lines.push('… (más entradas omitidas)')
      break
    }
    const suffix = e.isDirectory() ? '/' : ''
    lines.push(`${e.name}${suffix}`)
  }

  let listing = lines.join('\n')
  if (listing.length > MAX_LISTING_CHARS) {
    listing = `${listing.slice(0, MAX_LISTING_CHARS)}\n… (listado truncado)`
  }

  let packageJson: string | null = null
  const pkgPath = join(dir, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, 'utf-8')
      packageJson =
        raw.length > MAX_PACKAGE_JSON
          ? `${raw.slice(0, MAX_PACKAGE_JSON)}\n… (package.json truncado)`
          : raw
    } catch {
      packageJson = null
    }
  }

  let readmeMd: string | null = null
  for (const name of README_NAMES) {
    const p = join(dir, name)
    if (!existsSync(p)) continue
    try {
      const raw = readFileSync(p, 'utf-8')
      readmeMd =
        raw.length > MAX_README
          ? `${raw.slice(0, MAX_README)}\n… (README truncado)`
          : raw
      break
    } catch {
      /* siguiente nombre */
    }
  }

  return { cwd: dir, listing, packageJson, readmeMd }
}
