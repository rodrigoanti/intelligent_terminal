/** Máximo de bytes devueltos para diff/stat en UI y para prompts de IA (truncado con sufijo). */
export const GIT_MAX_OUTPUT_BYTES = 200_000

/** Máximo de longitud del mensaje de `git commit -m`. */
export const GIT_MAX_COMMIT_MESSAGE_CHARS = 4096

export interface GitPathEntry {
  /** Ruta relativa al repo (puede incluir `->` en renombres en porcelana). */
  path: string
  /** Dos caracteres de estado índice/worktree (porcelana v1). */
  status: string
}

export interface GitRepoStatus {
  isRepo: boolean
  /** cwd de la sesión usado para resolver el repo */
  sessionCwd: string
  /** Raíz del repo (`git rev-parse --show-toplevel`) */
  repoRoot?: string
  /** Línea cruda `git status -sb` (primera línea, rama y tracking) */
  branchLine?: string
  branch?: string
  upstream?: string
  ahead?: number
  behind?: number
  files: GitPathEntry[]
  /** `git diff --stat` truncado */
  diffStat?: string
  /** `git diff --cached --stat` truncado */
  stagedDiffStat?: string
  hasStaged: boolean
  hasUnstaged: boolean
  /** Si no es repo o error al ejecutar git */
  error?: string
}

export interface GitCommandResult {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
}

export interface GitDiffForAiPayload {
  ok: boolean
  text: string
  error?: string
}
