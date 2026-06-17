import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import {
  clearFollowDetached,
  followTerminalOutput,
  type TerminalFollowState,
  updateFollowDetachedState,
  FOLLOW_SLACK_LINES,
  shouldStickTerminalToBottom,
} from './terminalFollowScroll'
import { repaintTerminalCanvas, repaintTerminalCanvasForFollowState } from './terminalCanvasRepaint'

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
    const stickToBottom = followState != null
      ? shouldStickTerminalToBottom(term, followState)
      : savedTop >= maxScrollBefore - FOLLOW_SLACK_LINES
    fit.fit()
    if (term.cols === colsBefore && term.rows === rowsBefore) {
      // Sin cambio de filas/cols: aún hay que refrescar el canvas (p. ej. tab oculto con display:none).
      repaintTerminalCanvasForFollowState(term, followState)
      return
    }
    const b = term.buffer.active
    if (b.type !== 'normal') return
    if (stickToBottom) {
      // Tras fit() el viewport puede quedar en Y=0; no usar isNearBottom aquí.
      followTerminalOutput(term)
      if (followState) clearFollowDetached(followState)
      repaintTerminalCanvas(term, { skipViewportSync: true })
      return
    }
    const target = Math.min(Math.max(0, savedTop), Math.max(0, b.baseY))
    term.scrollToLine(target)
    if (followState) updateFollowDetachedState(term, followState)
    repaintTerminalCanvas(term)
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

/**
 * Coalescencia de ráfagas de resize: el dock IA colapsado crece a cada token
 * del agente y el ResizeObserver del contenedor dispararía un fit por frame
 * (reflow del buffer + `ptyResize` → SIGWINCH → redibujado completo del TUI).
 * Un fit como mucho cada FIT_BURST_COALESCE_MS durante la ráfaga.
 */
export const FIT_BURST_COALESCE_MS = 100

export function createTerminalFitScheduler(
  getTerm: () => Terminal | null,
  getFit: () => FitAddon | null,
  getContainer: () => HTMLElement | null,
  followState: TerminalFollowState,
  onDimensionsChange: (cols: number, rows: number) => void,
): TerminalFitScheduler {
  let raf = 0
  let burstTimer: ReturnType<typeof setTimeout> | null = null
  let lastFitAt = 0
  let lastCols = -1
  let lastRows = -1
  let lastContainerW = -1
  let lastContainerH = -1

  const runFit = (): void => {
    raf = 0
    lastFitAt = Date.now()
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

  const cancelPending = (): void => {
    if (burstTimer != null) {
      clearTimeout(burstTimer)
      burstTimer = null
    }
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  return {
    schedule: () => {
      if (raf !== 0 || burstTimer != null) return
      const elapsed = Date.now() - lastFitAt
      if (elapsed >= FIT_BURST_COALESCE_MS) {
        raf = requestAnimationFrame(runFit)
        return
      }
      burstTimer = setTimeout(() => {
        burstTimer = null
        raf = requestAnimationFrame(runFit)
      }, FIT_BURST_COALESCE_MS - elapsed)
    },
    cancel: cancelPending,
    runNow: () => {
      cancelPending()
      runFit()
    },
  }
}
