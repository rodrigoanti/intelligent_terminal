/** Clave estable para comparar listas de carpetas expandidas sin depender de la referencia del array. */
export function expandedPathsKey(paths: string[]): string {
  return paths.filter(Boolean).sort().join('\0')
}

/** Normaliza cwd de sesión para comparar sin disparar refrescos duplicados. */
export function normalizeSessionCwd(cwd: string | null | undefined): string {
  if (!cwd) return ''
  return cwd.trim().replace(/\\/g, '/').replace(/\/+$/, '') || ''
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
