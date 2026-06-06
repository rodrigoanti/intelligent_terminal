import type { GitPathEntry } from '@shared/gitSessionTypes'

const RENAME_ARROW = ' -> '

/** Ruta en el worktree (destino en renombres de porcelana). */
export function gitWorktreePath(entry: GitPathEntry): string {
  const idx = entry.path.indexOf(RENAME_ARROW)
  return idx >= 0 ? entry.path.slice(idx + RENAME_ARROW.length).trim() : entry.path
}

/** Archivo completamente en staging (sin cambios pendientes en worktree). */
export function isGitEntryFullyStaged(entry: GitPathEntry): boolean {
  if (entry.status === '??') return false
  const index = entry.status[0] ?? ' '
  const worktree = entry.status[1] ?? ' '
  return index !== ' ' && index !== '?' && worktree === ' '
}

/** Se puede quitar del staging. */
export function canGitUnstageEntry(entry: GitPathEntry): boolean {
  return hasGitStagedChanges(entry)
}

/** Se puede añadir al staging (untracked o con cambios sin stage). */
export function canGitStageEntry(entry: GitPathEntry): boolean {
  if (entry.status === '??') return true
  const index = entry.status[0] ?? ' '
  const worktree = entry.status[1] ?? ' '
  return worktree !== ' ' || index === ' '
}

/** Tiene cambios en el índice (staging). */
export function hasGitStagedChanges(entry: GitPathEntry): boolean {
  if (entry.status === '??') return false
  const index = entry.status[0] ?? ' '
  return index !== ' ' && index !== '?'
}

/** Tiene cambios en el worktree (sin stage o untracked). */
export function hasGitUnstagedChanges(entry: GitPathEntry): boolean {
  if (entry.status === '??') return true
  const worktree = entry.status[1] ?? ' '
  return worktree !== ' '
}

export function splitGitFilesByArea(files: GitPathEntry[]): {
  unstaged: GitPathEntry[]
  staged: GitPathEntry[]
} {
  const unstaged: GitPathEntry[] = []
  const staged: GitPathEntry[] = []
  for (const entry of files) {
    if (hasGitUnstagedChanges(entry)) unstaged.push(entry)
    if (hasGitStagedChanges(entry)) staged.push(entry)
  }
  return { unstaged, staged }
}

/** Nombre corto para la fila (basename del path en worktree). */
export function gitDisplayFileName(entry: GitPathEntry): string {
  const path = gitWorktreePath(entry)
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return slash >= 0 ? path.slice(slash + 1) : path
}
