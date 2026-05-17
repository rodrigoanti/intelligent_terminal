import { clipboard } from 'electron'
import { basename, extname, join, relative, resolve } from 'path'
import { cpSync, existsSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolveSafeProjectPath } from './agentFileOps'

export type FileExplorerClipboardResult =
  | { ok: true; count?: number }
  | { ok: false; error: string }

/** Rutas absolutas copiadas; compartido entre sesiones/pestañas. */
let explorerClipboardAbsPaths: string[] = []

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(String(cwdRaw).trim())
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

function normalizeRelPath(relPath: string): string {
  return String(relPath).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function parseClipboardPathLine(line: string): string {
  const s = line.trim()
  if (!s) return ''
  if (s.startsWith('file://')) {
    try {
      return fileURLToPath(s)
    } catch {
      return ''
    }
  }
  return s
}

function readSystemClipboardAbsPaths(): string[] {
  const text = clipboard.readText().trim()
  if (!text) return []
  const paths: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const p = parseClipboardPathLine(line)
    if (p && existsSync(p)) paths.push(p)
  }
  return paths
}

function uniqueDestAbs(destDir: string, name: string): string {
  const direct = join(destDir, name)
  if (!existsSync(direct)) return direct
  const ext = extname(name)
  const stem = ext ? basename(name, ext) : name
  for (let i = 1; i < 1000; i++) {
    const candidate = join(destDir, `${stem} (${i})${ext}`)
    if (!existsSync(candidate)) return candidate
  }
  throw new Error('demasiados archivos con el mismo nombre')
}

function isPathInside(parentAbs: string, childAbs: string): boolean {
  const rel = relative(parentAbs, childAbs)
  return rel !== '' && !rel.startsWith('..')
}

export function copyPathsForExplorer(
  _sessionId: string,
  projectRootRaw: string,
  relPathsRaw: string[],
): FileExplorerClipboardResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }

  const absPaths: string[] = []

  for (const raw of relPathsRaw) {
    const rel = normalizeRelPath(raw)
    if (!rel) continue
    const abs = resolveSafeProjectPath(projectRoot, rel)
    if (!abs || !existsSync(abs)) {
      return { ok: false, error: `no existe: ${raw}` }
    }
    absPaths.push(abs)
  }

  if (absPaths.length === 0) {
    return { ok: false, error: 'nada seleccionado para copiar' }
  }

  explorerClipboardAbsPaths = absPaths
  clipboard.writeText(absPaths.join('\n'))

  return { ok: true, count: absPaths.length }
}

export function pasteIntoExplorer(
  _sessionId: string,
  projectRootRaw: string,
  destRelPathRaw: string,
): FileExplorerClipboardResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }

  const destRel = normalizeRelPath(destRelPathRaw)
  const destDirAbs = destRel ? resolveSafeProjectPath(projectRoot, destRel) : projectRoot
  if (!destDirAbs) {
    return { ok: false, error: 'carpeta de destino inválida' }
  }

  try {
    const st = statSync(destDirAbs)
    if (!st.isDirectory()) {
      return { ok: false, error: 'el destino no es una carpeta' }
    }
  } catch {
    return { ok: false, error: 'carpeta de destino no encontrada' }
  }

  const sources: Array<{ srcAbs: string; name: string }> = []

  for (const abs of explorerClipboardAbsPaths) {
    if (existsSync(abs)) {
      sources.push({ srcAbs: abs, name: basename(abs) })
    }
  }

  if (sources.length === 0) {
    for (const abs of readSystemClipboardAbsPaths()) {
      sources.push({ srcAbs: abs, name: basename(abs) })
    }
  }

  if (sources.length === 0) {
    return { ok: false, error: 'no hay nada en el portapapeles para pegar' }
  }

  let pasted = 0
  for (const { srcAbs, name } of sources) {
    if (isPathInside(srcAbs, destDirAbs) || resolve(srcAbs) === resolve(destDirAbs)) {
      return { ok: false, error: 'no se puede pegar dentro de la propia selección' }
    }
    const targetAbs = uniqueDestAbs(destDirAbs, name)
    try {
      const srcStat = statSync(srcAbs)
      cpSync(srcAbs, targetAbs, srcStat.isDirectory() ? { recursive: true } : undefined)
      pasted++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  }

  return { ok: true, count: pasted }
}
