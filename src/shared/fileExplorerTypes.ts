import type { FileExplorerErrorCode } from './fileExplorerErrorCodes'

export interface FileExplorerEntry {
  name: string
  /** Ruta relativa al cwd de la sesión, separador `/` */
  relPath: string
  isDirectory: boolean
}

export interface FileExplorerErrorPayload {
  error: string
  code?: FileExplorerErrorCode
}

export interface FileExplorerListResult {
  ok: boolean
  entries: FileExplorerEntry[]
  error?: string
  code?: FileExplorerErrorCode
}

export interface FileExplorerFilePayload {
  ok: boolean
  relPath: string
  content?: string
  error?: string
  code?: FileExplorerErrorCode
  binary?: boolean
  sizeBytes?: number
  maxBytes?: number
}

export type FileExplorerWriteResult =
  | { ok: true }
  | ({ ok: false } & FileExplorerErrorPayload)

export type FileExplorerCreateFileResult = FileExplorerWriteResult

export type FileExplorerClipboardResult =
  | { ok: true; count?: number }
  | ({ ok: false } & FileExplorerErrorPayload)

export interface FileExplorerSearchResult {
  ok: boolean
  /** Rutas relativas al cwd de la sesión */
  paths: string[]
  truncated?: boolean
  error?: string
  code?: FileExplorerErrorCode
}
