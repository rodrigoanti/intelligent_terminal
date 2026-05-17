import { dirname, normalize, resolve } from 'path'
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'
import type {
  FileExplorerEntry,
  FileExplorerFilePayload,
  FileExplorerListResult,
  FileExplorerWriteResult,
} from '../src/shared/fileExplorerTypes'
import { readProjectFile, resolveSafeProjectPath, writeProjectFile } from './agentFileOps'
import { isExistingDirectory } from './shellCwdSync'

const MAX_WRITE_BYTES = 600_000

function resolveWorkingDir(cwdRaw: string): string | null {
  const trimmed = String(cwdRaw).trim()
  if (!trimmed) return null
  try {
    const dir = resolve(normalize(trimmed))
    return isExistingDirectory(dir) ? dir : null
  } catch {
    return null
  }
}

function normalizeRelPath(relPath: string): string {
  return String(relPath).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

export function listDirChildren(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerListResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, entries: [], error: 'cwd inválido' }
  }

  const relPath = normalizeRelPath(relPathRaw)
  const abs = relPath ? resolveSafeProjectPath(projectRoot, relPath) : projectRoot
  if (!abs) {
    return { ok: false, entries: [], error: 'ruta inválida' }
  }

  try {
    const st = statSync(abs)
    if (!st.isDirectory()) {
      return { ok: false, entries: [], error: 'no es un directorio' }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, entries: [], error: msg }
  }

  let dirents: import('fs').Dirent[]
  try {
    dirents = readdirSync(abs, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, entries: [], error: msg }
  }

  const entries: FileExplorerEntry[] = []
  for (const d of dirents) {
    if (d.name === '.' || d.name === '..') continue

    const childRel = relPath ? `${relPath}/${d.name}` : d.name
    entries.push({
      name: d.name,
      relPath: childRel,
      isDirectory: d.isDirectory(),
    })
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return { ok: true, entries }
}

export function loadFileForExplorer(
  projectRootRaw: string,
  relPath: string,
): FileExplorerFilePayload {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, relPath, error: 'cwd inválido' }
  }

  const r = readProjectFile(projectRoot, relPath)
  if (!r.ok) {
    return { ok: false, relPath, error: r.error }
  }
  return { ok: true, relPath, content: r.content }
}

export function saveFileForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
  content: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía' }
  }
  const bytes = Buffer.byteLength(content, 'utf-8')
  if (bytes > MAX_WRITE_BYTES) {
    return { ok: false, error: 'archivo demasiado grande para guardar' }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }
  return writeProjectFile(projectRoot, relPath, content)
}

export function createFileForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía' }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto' }
  }
  try {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, '', { encoding: 'utf-8', flag: 'wx' })
    return { ok: true }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EEXIST') {
      return { ok: false, error: 'el archivo ya existe' }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export function createDirForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía' }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto' }
  }
  try {
    mkdirSync(abs, { recursive: true })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('EEXIST')) {
      return { ok: false, error: 'la carpeta ya existe' }
    }
    return { ok: false, error: msg }
  }
}

export function deletePathForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía' }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto' }
  }
  try {
    rmSync(abs, { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export function renamePathForExplorer(
  projectRootRaw: string,
  oldRelPathRaw: string,
  newRelPathRaw: string,
): FileExplorerWriteResult {
  const oldRel = normalizeRelPath(oldRelPathRaw)
  const newRel = normalizeRelPath(newRelPathRaw)
  if (!oldRel || !newRel) {
    return { ok: false, error: 'ruta vacía' }
  }
  if (oldRel === newRel) {
    return { ok: true }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido' }
  }
  const oldAbs = resolveSafeProjectPath(projectRoot, oldRel)
  const newAbs = resolveSafeProjectPath(projectRoot, newRel)
  if (!oldAbs || !newAbs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto' }
  }
  try {
    statSync(oldAbs)
  } catch {
    return { ok: false, error: 'el elemento no existe' }
  }
  try {
    statSync(newAbs)
    return { ok: false, error: 'ya existe un elemento con ese nombre' }
  } catch {
    // destino libre
  }
  try {
    mkdirSync(dirname(newAbs), { recursive: true })
    renameSync(oldAbs, newAbs)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
