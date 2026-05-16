import { spawn } from 'child_process'
import { normalize, relative, resolve } from 'path'
import { readdirSync, statSync } from 'fs'
import type {
  FileExplorerChangeKind,
  FileExplorerEntry,
  FileExplorerFilePayload,
  FileExplorerGitMapResult,
  FileExplorerListResult,
} from '../src/shared/fileExplorerTypes'
import { readProjectFile, resolveSafeProjectPath } from './agentFileOps'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.vite',
  'coverage',
  'target',
  '__pycache__',
  '.turbo',
  '.cache',
  'vendor',
  'Pods',
  '.gradle',
])

const TIMEOUT_MS = 60_000
const MAX_DIFF_BYTES = 200_000

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(normalize(String(cwdRaw).trim()))
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

function runGit(
  cwd: string,
  args: string[],
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise(resolvePromise => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const cap = (prev: string, chunk: string): string => {
      const space = MAX_DIFF_BYTES - prev.length
      if (chunk.length <= space) return prev + chunk
      return prev + chunk.slice(0, Math.max(0, space)) + '\n[…truncado…]'
    }
    child.stdout?.on('data', (buf: Buffer) => {
      stdout = cap(stdout, buf.toString('utf-8'))
    })
    child.stderr?.on('data', (buf: Buffer) => {
      stderr = cap(stderr, buf.toString('utf-8'))
    })
    child.on('error', (e: Error) => {
      resolvePromise({ exitCode: null, stdout, stderr: e.message })
    })
    child.on('close', code => {
      resolvePromise({ exitCode: code, stdout, stderr })
    })
  })
}

async function getRepoRoot(sessionCwd: string): Promise<string | null> {
  const r = await runGit(sessionCwd, ['rev-parse', '--show-toplevel'])
  if (r.exitCode !== 0) return null
  return r.stdout.trim().split('\n')[0]?.trim() || null
}

function sessionRelFromRepoPath(
  repoRoot: string,
  sessionCwd: string,
  gitPath: string,
): string | null {
  const abs = resolve(repoRoot, gitPath.replace(/\\/g, '/'))
  const rel = relative(sessionCwd, abs).replace(/\\/g, '/')
  if (!rel || rel.startsWith('..')) return null
  return rel
}

function porcelainToChangeKind(xy: string): FileExplorerChangeKind {
  if (xy === '??') return 'untracked'
  if (xy[0] === 'D' || xy[1] === 'D') return 'deleted'
  const staged = xy[0] !== ' ' && xy[0] !== '?'
  const unstaged = xy[1] !== ' '
  if (staged && unstaged) return 'modified'
  if (staged) return 'staged'
  if (unstaged) return 'modified'
  return 'clean'
}

function parsePorcelainPath(pathPart: string): string {
  const arrow = pathPart.indexOf(' -> ')
  return (arrow >= 0 ? pathPart.slice(arrow + 4) : pathPart).trim()
}

export async function getGitStatusMapForExplorer(
  projectRootRaw: string,
): Promise<FileExplorerGitMapResult> {
  const sessionCwd = resolveWorkingDir(projectRootRaw)
  if (!sessionCwd) {
    return { ok: false, statuses: {}, error: 'cwd inválido' }
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return { ok: true, statuses: {} }
  }

  const status = await runGit(repoRoot, ['status', '--porcelain=v1'])
  if (status.exitCode !== 0) {
    return { ok: false, statuses: {}, error: status.stderr.trim() || 'git status falló' }
  }

  const statuses: Record<string, FileExplorerChangeKind> = {}
  for (const line of status.stdout.split('\n')) {
    if (!line || line.length < 4) continue
    const xy = line.slice(0, 2)
    const gitPath = parsePorcelainPath(line.slice(3))
    if (!gitPath) continue
    const sessionRel = sessionRelFromRepoPath(repoRoot, sessionCwd, gitPath)
    if (!sessionRel) continue
    statuses[sessionRel] = porcelainToChangeKind(xy)
  }

  return { ok: true, statuses }
}

async function gitPathInRepo(
  repoRoot: string,
  sessionCwd: string,
  relPath: string,
): Promise<string | null> {
  const abs = resolveSafeProjectPath(sessionCwd, relPath)
  if (!abs) return null
  const gitPath = relative(repoRoot, abs).replace(/\\/g, '/')
  if (gitPath.startsWith('..')) return null
  return gitPath
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
    if (d.name.startsWith('.')) continue
    if (d.isDirectory() && SKIP_DIRS.has(d.name)) continue

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

export function readFileForExplorer(
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

export async function loadFileForExplorer(
  projectRootRaw: string,
  relPath: string,
): Promise<FileExplorerFilePayload> {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, relPath, error: 'cwd inválido' }
  }

  const read = readFileForExplorer(projectRootRaw, relPath)
  if (!read.ok) return read

  const diffResult = await diffFileForExplorer(projectRootRaw, relPath)
  return {
    ok: true,
    relPath,
    content: read.content,
    diff: diffResult.diff,
    changeKind: diffResult.changeKind,
  }
}

export async function diffFileForExplorer(
  projectRootRaw: string,
  relPath: string,
): Promise<Pick<FileExplorerFilePayload, 'diff' | 'changeKind'>> {
  const sessionCwd = resolveWorkingDir(projectRootRaw)
  if (!sessionCwd) {
    return { changeKind: 'clean' }
  }

  const repoRoot = await getRepoRoot(sessionCwd)
  if (!repoRoot) {
    return { changeKind: 'clean', diff: '' }
  }

  const gitPath = await gitPathInRepo(repoRoot, sessionCwd, relPath)
  if (!gitPath) {
    return { changeKind: 'clean', diff: '' }
  }

  const abs = resolveSafeProjectPath(sessionCwd, relPath)
  if (!abs) {
    return { changeKind: 'clean', diff: '' }
  }

  let exists = false
  try {
    exists = statSync(abs).isFile()
  } catch {
    exists = false
  }

  const status = await runGit(repoRoot, ['status', '--porcelain=v1', '--', gitPath])
  const line = status.stdout.split('\n').find(l => l.length >= 4)

  if (!exists && line) {
    return {
      changeKind: 'deleted',
      diff: await buildDiff(repoRoot, gitPath),
    }
  }

  if (!line) {
    return { changeKind: 'clean', diff: '' }
  }

  const xy = line.slice(0, 2)
  const changeKind = porcelainToChangeKind(xy)

  if (changeKind === 'untracked') {
    return {
      changeKind: 'untracked',
      diff: await buildUntrackedDiff(repoRoot, gitPath),
    }
  }

  const diff = await buildDiff(repoRoot, gitPath)
  return { changeKind, diff }
}

async function buildUntrackedDiff(repoRoot: string, gitPath: string): Promise<string> {
  const r = await runGit(repoRoot, ['diff', '--no-index', '--', '/dev/null', gitPath])
  if (r.stdout.trim()) return r.stdout.trim()
  return ''
}

async function buildDiff(repoRoot: string, gitPath: string): Promise<string> {
  const unstaged = await runGit(repoRoot, ['diff', '--', gitPath])
  const staged = await runGit(repoRoot, ['diff', '--cached', '--', gitPath])
  const parts: string[] = []
  if (staged.stdout.trim()) {
    parts.push('--- staged (git diff --cached) ---\n', staged.stdout.trim())
  }
  if (unstaged.stdout.trim()) {
    if (parts.length) parts.push('\n\n')
    parts.push('--- unstaged (git diff) ---\n', unstaged.stdout.trim())
  }
  return parts.join('')
}
