import type { Terminal } from '@xterm/xterm'
import { syncTerminalViewport } from './terminalWheelScroll'

type TerminalWithAtlas = Terminal & { clearTextureAtlas?: () => void }

/**
 * Fuerza un frame del canvas xterm tras cambios de layout/scroll.
 * En Electron/macOS el bitmap puede quedar negro si no se refresca tras fit o
 * composición con el overlay del dock IA (KNOWN_ISSUES.md §1).
 */
export function repaintTerminalCanvas(term: Terminal | null | undefined): void {
  if (!term) return
  try {
    if (term.rows < 1) return
    syncTerminalViewport(term)
    term.refresh(0, term.rows - 1)
    ;(term as TerminalWithAtlas).clearTextureAtlas?.()
  } catch {
    /* dispose / dimensions */
  }
}

export function createTerminalRepaintScheduler(
  getTerm: () => Terminal | null,
): { schedule: () => void; cancel: () => void } {
  let raf = 0
  return {
    schedule: () => {
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        repaintTerminalCanvas(getTerm())
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
