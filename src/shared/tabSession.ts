/**
 * Forma persistida de una pestaña (session.json). Vive en `src/shared` porque
 * la usan tanto el renderer (`App.tsx`) como el main process
 * (`electron/persistence.ts`); un import renderer ↔ main cruzaría los grafos
 * de tsconfig.web / tsconfig.node.
 */

export interface TabSplitSizes {
  /** Fracción 0–1 del ancho de la columna izquierda (paneles con 2 columnas). */
  columnRatio: number
  /** Fracción 0–1 de la altura de la fila superior (3 y 4 paneles). */
  rowRatio?: number
}

export interface TabSession {
  id: string
  title: string
  /** Tras renombrar a mano: el título del PTY no sustituye `title` */
  titleLocked?: boolean
  /** Cada panel = una sesión PTY (UUID); como máximo `MAX_PANES_PER_TAB` por pestaña */
  paneIds: string[]
  activePaneId: string
  /** Proporciones de divisores entre paneles (persistido en session.json). */
  splitSizes?: TabSplitSizes
}
