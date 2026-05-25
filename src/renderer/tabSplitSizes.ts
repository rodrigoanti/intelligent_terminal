export interface TabSplitSizes {
  /** Fracción 0–1 del ancho de la columna izquierda (paneles con 2 columnas). */
  columnRatio: number
  /** Fracción 0–1 de la altura de la fila superior (3 y 4 paneles). */
  rowRatio?: number
}

export const DEFAULT_COLUMN_RATIO = 0.5
export const DEFAULT_ROW_RATIO = 0.5
export const SPLIT_GUTTER_PX = 6
export const MIN_PANE_WIDTH_PX = 120
export const MIN_PANE_HEIGHT_PX = 80

const STATIC_MIN = 0.15
const STATIC_MAX = 0.85

export function getDefaultSplitSizes(paneCount: number): TabSplitSizes | undefined {
  if (paneCount <= 1) return undefined
  return {
    columnRatio: DEFAULT_COLUMN_RATIO,
    rowRatio: paneCount >= 3 ? DEFAULT_ROW_RATIO : undefined,
  }
}

function clampRatioStatic(r: number, fallback: number): number {
  if (!Number.isFinite(r)) return fallback
  return Math.min(STATIC_MAX, Math.max(STATIC_MIN, r))
}

/** Normaliza ratios guardados; devuelve undefined si la pestaña tiene un solo panel. */
export function normalizeSplitSizes(tab: {
  paneIds: string[]
  splitSizes?: TabSplitSizes
}): TabSplitSizes | undefined {
  const n = tab.paneIds.length
  if (n <= 1) return undefined
  const defaults = getDefaultSplitSizes(n)!
  const s = tab.splitSizes
  const columnRatio = clampRatioStatic(s?.columnRatio ?? defaults.columnRatio, DEFAULT_COLUMN_RATIO)
  const rowRatio =
    n >= 3
      ? clampRatioStatic(s?.rowRatio ?? defaults.rowRatio ?? DEFAULT_ROW_RATIO, DEFAULT_ROW_RATIO)
      : undefined
  return { columnRatio, rowRatio }
}

export function normalizeTabSession<T extends { paneIds: string[]; splitSizes?: TabSplitSizes }>(
  tab: T,
): T {
  const splitSizes = normalizeSplitSizes(tab)
  if (!splitSizes) {
    const { splitSizes: _removed, ...rest } = tab
    return rest as T
  }
  return { ...tab, splitSizes }
}

export function clampColumnRatio(ratio: number, containerWidth: number): number {
  const available = containerWidth - SPLIT_GUTTER_PX
  if (available <= MIN_PANE_WIDTH_PX * 2) return DEFAULT_COLUMN_RATIO
  const minR = MIN_PANE_WIDTH_PX / available
  const maxR = 1 - minR
  return Math.min(maxR, Math.max(minR, ratio))
}

export function clampRowRatio(ratio: number, containerHeight: number): number {
  const available = containerHeight - SPLIT_GUTTER_PX
  if (available <= MIN_PANE_HEIGHT_PX * 2) return DEFAULT_ROW_RATIO
  const minR = MIN_PANE_HEIGHT_PX / available
  const maxR = 1 - minR
  return Math.min(maxR, Math.max(minR, ratio))
}

export function columnGridTemplate(ratio: number): string {
  const r = clampRatioStatic(ratio, DEFAULT_COLUMN_RATIO)
  const pct = (r * 100).toFixed(3)
  // Columna derecha siempre `1fr` para ocupar el resto tras el gutter (evita hueco negro).
  return `minmax(${MIN_PANE_WIDTH_PX}px, ${pct}%) ${SPLIT_GUTTER_PX}px minmax(${MIN_PANE_WIDTH_PX}px, 1fr)`
}

export function rowGridTemplate(ratio: number): string {
  const r = clampRatioStatic(ratio, DEFAULT_ROW_RATIO)
  const pct = (r * 100).toFixed(3)
  return `minmax(${MIN_PANE_HEIGHT_PX}px, ${pct}%) ${SPLIT_GUTTER_PX}px minmax(${MIN_PANE_HEIGHT_PX}px, 1fr)`
}
