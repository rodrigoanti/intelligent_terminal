/** Estado del explorador de archivos por panel (sessionId / paneId). */
export interface FileExplorerPersistedState {
  open: boolean
  selectedRelPath: string | null
  selectedIsDirectory: boolean
  expandedRelPaths: string[]
}

const DEFAULT_EXPANDED: string[] = ['']

export const DEFAULT_FILE_EXPLORER_STATE: FileExplorerPersistedState = {
  open: false,
  selectedRelPath: null,
  selectedIsDirectory: false,
  expandedRelPaths: DEFAULT_EXPANDED,
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

  return {
    open: o.open === true,
    selectedRelPath: typeof o.selectedRelPath === 'string' ? o.selectedRelPath : null,
    selectedIsDirectory: o.selectedIsDirectory === true,
    expandedRelPaths,
  }
}
