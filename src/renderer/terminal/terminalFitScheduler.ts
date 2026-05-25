import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import {
  clearFollowDetached,
  followTerminalOutput,
  type TerminalFollowState,
  updateFollowDetachedState,
  FOLLOW_SLACK_LINES,
} from './terminalFollowScroll'

/**
 * Ajusta columnas/filas al contenedor sin “saltar” el scroll: si el usuario estaba
 * abajo del todo (prompt), se mantiene abajo; si había subido en el historial,
 * conserva la posición relativa en el scrollback.
 */
export function fitTerminalPreserveScroll(
  term: Terminal,
  fit: FitAddon,
  followState?: TerminalFollowState,
): void {
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') {
      fit.fit()
      return
    }
    const colsBefore = term.cols
    const rowsBefore = term.rows
    const savedTop = buf.viewportY
    const maxScrollBefore = Math.max(0, buf.baseY)
    const wasAtBottom = savedTop >= maxScrollBefore - FOLLOW_SLACK_LINES
    fit.fit()
    if (term.cols === colsBefore && term.rows === rowsBefore) {
      return
    }
    const b = term.buffer.active
    if (b.type !== 'normal') return
    if (wasAtBottom) {
      // Tras fit() el viewport puede quedar en Y=0; no usar isNearBottom aquí.
      followTerminalOutput(term)
      if (followState) clearFollowDetached(followState)
      return
    }
    const target = Math.min(Math.max(0, savedTop), Math.max(0, b.baseY))
    term.scrollToLine(target)
    if (followState) updateFollowDetachedState(term, followState)
  } catch {
    /* syncScrollArea / dimensions */
  }
}

export interface TerminalFitScheduler {
  /** Encola un fit en el próximo frame (varios ResizeObserver → uno solo). */
  schedule: () => void
  /** Cancela un fit pendiente (p. ej. en cleanup del efecto). */
  cancel: () => void
  /** Ejecuta fit de inmediato (init, cambio de fuente, foco de panel). */
  runNow: () => void
}

export function createTerminalFitScheduler(
  getTerm: () => Terminal | null,
  getFit: () => FitAddon | null,
  getContainer: () => HTMLElement | null,
  followState: TerminalFollowState,
  onDimensionsChange: (cols: number, rows: number) => void,
): TerminalFitScheduler {
  let raf = 0
  let lastCols = -1
  let lastRows = -1
  let lastContainerW = -1
  let lastContainerH = -1

  const runFit = (): void => {
    raf = 0
    const term = getTerm()
    const fit = getFit()
    if (!term || !fit) return
    const host = getContainer()
    if (host) {
      const w = host.clientWidth
      const h = host.clientHeight
      if (
        w === lastContainerW &&
        h === lastContainerH &&
        term.cols === lastCols &&
        term.rows === lastRows
      ) {
        return
      }
      lastContainerW = w
      lastContainerH = h
    }
    try {
      const colsBefore = term.cols
      const rowsBefore = term.rows
      fitTerminalPreserveScroll(term, fit, followState)
      const cols = Math.max(1, term.cols)
      const rows = Math.max(1, term.rows)
      if (
        cols === lastCols &&
        rows === lastRows &&
        cols === colsBefore &&
        rows === rowsBefore
      ) {
        return
      }
      lastCols = cols
      lastRows = rows
      onDimensionsChange(cols, rows)
    } catch {
      /* syncScrollArea / dimensions durante resize o dispose */
    }
  }

  return {
    schedule: () => {
      if (raf !== 0) return
      raf = requestAnimationFrame(runFit)
    },
    cancel: () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
    runNow: () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      runFit()
    },
  }
}
