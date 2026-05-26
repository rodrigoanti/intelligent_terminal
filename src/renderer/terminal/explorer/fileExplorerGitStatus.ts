import type { GitPathEntry, GitRepoStatus } from '@shared/gitSessionTypes'

export type ExplorerGitStatus = 'new' | 'modified'

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Prefijo de rutas del repo relativas al cwd de la sesión (raíz del árbol). */
export function repoPrefixFromStatus(status: GitRepoStatus): string {
  if (!status.isRepo || !status.repoRoot) return ''
  const repoRoot = normalizePath(status.repoRoot)
  const sessionCwd = normalizePath(status.sessionCwd)
  if (sessionCwd === repoRoot) return ''
  if (!sessionCwd.startsWith(`${repoRoot}/`)) return ''
  return sessionCwd.slice(repoRoot.length + 1)
}

function porcelainPath(path: string): string {
  const arrow = path.indexOf(' -> ')
  return arrow >= 0 ? path.slice(arrow + 4) : path
}

function porcelainToStatus(status: string): ExplorerGitStatus {
  if (status === '??' || status[0] === 'A') return 'new'
  return 'modified'
}

function mergeStatus(
  current: ExplorerGitStatus | undefined,
  next: ExplorerGitStatus,
): ExplorerGitStatus {
  if (current === 'modified' || next === 'modified') return 'modified'
  return 'new'
}

function repoPathToExplorerPath(repoPath: string, prefix: string): string | null {
  if (!prefix) return repoPath
  if (repoPath === prefix) return ''
  if (repoPath.startsWith(`${prefix}/`)) return repoPath.slice(prefix.length + 1)
  return null
}

/** Mapa relPath del explorador → estado git (incluye carpetas con cambios en descendientes). */
export function buildGitStatusMap(status: GitRepoStatus): Map<string, ExplorerGitStatus> {
  if (!status.isRepo) return new Map()

  const prefix = repoPrefixFromStatus(status)
  const result = new Map<string, ExplorerGitStatus>()

  for (const entry of status.files) {
    const repoPath = porcelainPath(entry.path)
    const explorerPath = repoPathToExplorerPath(repoPath, prefix)
    if (explorerPath === null) continue

    const gitStatus = porcelainToStatus(entry.status)
    result.set(explorerPath, mergeStatus(result.get(explorerPath), gitStatus))

    let dir = explorerPath
    while (dir.includes('/')) {
      dir = dir.slice(0, dir.lastIndexOf('/'))
      result.set(dir, mergeStatus(result.get(dir), gitStatus))
    }
  }

  return result
}

export function gitStatusFromMap(
  map: Map<string, ExplorerGitStatus>,
  relPath: string,
): ExplorerGitStatus | null {
  return map.get(relPath) ?? null
}
