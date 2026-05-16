export interface FileExplorerEntry {
  name: string
  /** Ruta relativa al cwd de la sesión, separador `/` */
  relPath: string
  isDirectory: boolean
}

export interface FileExplorerListResult {
  ok: boolean
  entries: FileExplorerEntry[]
  error?: string
}

export type FileExplorerChangeKind =
  | 'clean'
  | 'modified'
  | 'staged'
  | 'untracked'
  | 'deleted'

export interface FileExplorerFilePayload {
  ok: boolean
  relPath: string
  content?: string
  diff?: string
  changeKind?: FileExplorerChangeKind
  error?: string
}

/** Mapa relPath (cwd de sesión) → estado git del archivo */
export interface FileExplorerGitMapResult {
  ok: boolean
  /** Vacío si no hay repo git o no hay cambios */
  statuses: Record<string, FileExplorerChangeKind>
  error?: string
}
