import type { Terminal } from '@xterm/xterm'
import { isProgrammaticScroll, shouldStickTerminalToBottom, type TerminalFollowState } from './terminalFollowScroll'
import { syncTerminalViewport } from './terminalWheelScroll'

type TerminalWithAtlas = Terminal & { clearTextureAtlas?: () => void }

export interface RepaintTerminalCanvasOptions {
  /** Evita `syncScrollArea` mientras el follow programático aún alinea buffer y DOM. */
  skipViewportSync?: boolean
}

/**
 * Fuerza un frame del canvas xterm tras cambios de layout/scroll.
 * En Electron/macOS el bitmap puede quedar negro si no se refresca tras fit o
 * composición con el overlay del dock IA (KNOWN_ISSUES.md §1).
 */
export function repaintTerminalCanvas(
  term: Terminal | null | undefined,
  opts?: RepaintTerminalCanvasOptions,
): void {
  if (!term) return
  try {
    if (term.rows < 1) return
    if (!opts?.skipViewportSync) syncTerminalViewport(term)
    term.refresh(0, term.rows - 1)
    ;(term as TerminalWithAtlas).clearTextureAtlas?.()
  } catch {
    /* dispose / dimensions */
  }
}

/** Repinta sin `syncScrollArea` cuando el usuario sigue la salida (evita saltos de scroll). */
export function repaintTerminalCanvasForFollowState(
  term: Terminal | null | undefined,
  followState?: TerminalFollowState,
): void {
  if (!term || !followState) {
    repaintTerminalCanvas(term)
    return
  }
  let skipViewportSync = false
  try {
    skipViewportSync = shouldStickTerminalToBottom(term, followState)
  } catch {
    /* buffer / dispose */
  }
  repaintTerminalCanvas(term, { skipViewportSync })
}

export function createTerminalRepaintScheduler(
  getTerm: () => Terminal | null,
  getFollowState?: () => TerminalFollowState | undefined,
): { schedule: () => void; cancel: () => void } {
  let raf = 0
  return {
    schedule: () => {
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const term = getTerm()
        const followState = getFollowState?.()
        const skipViewportSync = Boolean(
          term &&
          followState &&
          (isProgrammaticScroll() || shouldStickTerminalToBottom(term, followState)),
        )
        repaintTerminalCanvas(term, { skipViewportSync })
      })
    },
    cancel: () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    },
  }
}
