/** Clave estable para comparar listas de carpetas expandidas sin depender de la referencia del array. */
export function expandedPathsKey(paths: string[]): string {
  return paths.filter(Boolean).sort().join('\0')
}

/** Normaliza cwd de sesión para comparar sin disparar refrescos duplicados. */
export function normalizeSessionCwd(cwd: string | null | undefined): string {
  if (!cwd) return ''
  return cwd.trim().replace(/\\/g, '/').replace(/\/+$/, '') || ''
}

/** Etiqueta corta para la barra del panel: últimos N segmentos (`padre / actual`). */
export function sessionCwdPaneLabel(cwd: string | null | undefined, levels = 2): string {
  const norm = normalizeSessionCwd(cwd)
  if (!norm) return '—'
  const parts = norm.split('/').filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0]!
  return parts.slice(-levels).join(' / ')
}

export interface ExplorerSelectedEntry {
  relPath: string
  isDirectory: boolean
}

/** Carpeta padre para crear entradas según la selección actual. */
export function parentDirForCreate(
  selectedPath: string | null,
  isDirectory?: boolean,
): string {
  if (!selectedPath) return ''
  if (isDirectory) return selectedPath
  const idx = selectedPath.lastIndexOf('/')
  return idx === -1 ? '' : selectedPath.slice(0, idx)
}

function isValidPathSegment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return false
  // Rechazar solo caracteres que el sistema de archivos no permite (nul, / en todos los SO; : en Windows)
  return !/[\x00/]/.test(segment)
}

/** Valida y combina nombre con carpeta padre; devuelve ruta relativa o null. */
export function buildNewRelPath(nameRaw: string, parentPath: string): string | null {
  const name = nameRaw.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!name || name.includes('..')) return null
  if (name.startsWith('/')) return null
  const segments = name.split('/').filter(Boolean)
  if (segments.some(s => !isValidPathSegment(s))) return null
  const rel = parentPath ? `${parentPath}/${name}` : name
  return rel.replace(/\/+/g, '/')
}

/** Directorio padre de una ruta relativa. */
export function parentRelPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

/** Carpeta destino al pegar: carpeta seleccionada o padre del archivo. */
export function pasteDestRelPath(selected: ExplorerSelectedEntry | null): string {
  if (!selected) return ''
  if (selected.isDirectory) return selected.relPath
  return parentDirForCreate(selected.relPath)
}

/** Remapea una ruta relativa tras renombrar un prefijo (carpeta o archivo). */
export function remapChildRelPath(
  relPath: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  if (relPath === oldPrefix) return newPrefix
  const childPrefix = `${oldPrefix}/`
  if (relPath.startsWith(childPrefix)) {
    return `${newPrefix}${relPath.slice(oldPrefix.length)}`
  }
  return null
}

/** Carpetas pesadas ocultas por defecto cuando showHiddenDirs es false. */
export const DEFAULT_COLLAPSED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
])

/** True si child está dentro de parent o es el mismo (rutas relativas). */
export function isRelPathInside(parent: string, child: string): boolean {
  if (parent === child) return true
  if (!parent) return false
  return child.startsWith(`${parent}/`)
}

/** Ruta relativa de cwd respecto a la raíz del árbol (cwd de sesión). */
export function relPathFromCwd(treeRootCwd: string, sessionCwd: string): string | null {
  const root = normalizeSessionCwd(treeRootCwd)
  const cwd = normalizeSessionCwd(sessionCwd)
  if (!root || !cwd) return null
  if (cwd === root) return ''
  const prefix = `${root}/`
  if (!cwd.startsWith(prefix)) return null
  return cwd.slice(prefix.length)
}
