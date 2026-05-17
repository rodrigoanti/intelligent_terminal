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

export interface FileExplorerFilePayload {
  ok: boolean
  relPath: string
  content?: string
  error?: string
}

export type FileExplorerWriteResult =
  | { ok: true }
  | { ok: false; error: string }

/** Resultado de crear archivo (no sobrescribe si ya existe). */
export type FileExplorerCreateFileResult = FileExplorerWriteResult

export type FileExplorerClipboardResult =
  | { ok: true; count?: number }
  | { ok: false; error: string }
