/** Contexto del proyecto en el cwd de una sesión PTY (para prompts de IA). */
export interface ProjectAiContextForAi {
  cwd: string
  /** Nombres en la raíz del cwd, una por línea; directorios terminan en `/`. */
  listing: string
  packageJson: string | null
  /**
   * Árbol completo del proyecto (omite node_modules, .git, build artifacts).
   * Se obtiene via getAgentFolderTree (IPC.AGENT_MD_TREE) y se adjunta en el renderer
   * para evitar lecturas sincrónicas recursivas en el proceso principal.
   * null si aún no fue cargado.
   */
  folderTree: string | null
  /** Salida de `git status --short` si el cwd es un repositorio git, null si no lo es. */
  gitStatus: string | null
  /** Resumen de `git diff --stat HEAD` si hay cambios, null si no hay. */
  gitDiff: string | null
}
