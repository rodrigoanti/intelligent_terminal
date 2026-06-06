/** Estado del explorador de archivos por panel (sessionId / paneId). */
export interface FileExplorerPersistedState {
  open: boolean
  selectedRelPath: string | null
  selectedIsDirectory: boolean
  expandedRelPaths: string[]
  /** Mostrar node_modules, .git, etc. */
  showHiddenDirs: boolean
  /** Ancho del panel árbol en % cuando hay editor abierto (20–50). */
  treeWidthPercent: number
  /** Abrir archivo con un solo clic (false = doble clic). */
  openOnSingleClick: boolean
}

const DEFAULT_EXPANDED: string[] = ['']

export const DEFAULT_FILE_EXPLORER_STATE: FileExplorerPersistedState = {
  open: false,
  selectedRelPath: null,
  selectedIsDirectory: false,
  expandedRelPaths: DEFAULT_EXPANDED,
  showHiddenDirs: false,
  treeWidthPercent: 30,
  openOnSingleClick: true,
}

export function normalizeFileExplorerState(raw: unknown): FileExplorerPersistedState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FILE_EXPLORER_STATE }
  const o = raw as Record<string, unknown>
  const expandedRaw = o.expandedRelPaths
  let expandedRelPaths = Array.isArray(expandedRaw)
    ? expandedRaw.filter((p): p is string => typeof p === 'string')
    : [...DEFAULT_EXPANDED]
  if (!expandedRelPaths.includes('')) expandedRelPaths.unshift('')
  if (expandedRelPaths.length === 1 && expandedRelPaths[0] === '') {
    expandedRelPaths = DEFAULT_EXPANDED
  }

  let treeWidthPercent = typeof o.treeWidthPercent === 'number' ? o.treeWidthPercent : 30
  if (treeWidthPercent < 20) treeWidthPercent = 20
  if (treeWidthPercent > 50) treeWidthPercent = 50

  return {
    open: o.open === true,
    selectedRelPath: typeof o.selectedRelPath === 'string' ? o.selectedRelPath : null,
    selectedIsDirectory: o.selectedIsDirectory === true,
    expandedRelPaths,
    showHiddenDirs: o.showHiddenDirs === true,
    treeWidthPercent,
    openOnSingleClick: o.openOnSingleClick !== false,
  }
}
