/** Contexto del proyecto en el cwd de una sesión PTY (para prompts de IA). */
export interface ProjectAiContextForAi {
  cwd: string
  /** Nombres en la raíz del cwd, una por línea; directorios terminan en `/`. */
  listing: string
  packageJson: string | null
  readmeMd: string | null
}
