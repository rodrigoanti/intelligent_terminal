import type { Terminal } from '@xterm/xterm'
import { isProgrammaticScroll, shouldStickTerminalToBottom, type TerminalFollowState } from './terminalFollowScroll'
import { syncTerminalViewport } from './terminalWheelScroll'

type TerminalWithAtlas = Terminal & { clearTextureAtlas?: () => void }

export interface RepaintTerminalCanvasOptions {
  /** Evita `syncScrollArea` mientras el follow programático aún alinea buffer y DOM. */
  skipViewportSync?: boolean
  /** Omite `clearTextureAtlas` (re-rasteriza todos los glifos: caro por chunk PTY). */
  skipTextureAtlas?: boolean
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
    if (!opts?.skipTextureAtlas) (term as TerminalWithAtlas).clearTextureAtlas?.()
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

function shouldSkipViewportSyncOnRepaint(
  term: Terminal | null,
  followState: TerminalFollowState | undefined,
): boolean {
  return Boolean(
    term &&
    followState &&
    (isProgrammaticScroll() || shouldStickTerminalToBottom(term, followState)),
  )
}

export interface TerminalRepaintScheduler {
  /** Repintado inmediato en el próximo frame (fit, cambio de tema, tab visible). */
  schedule: () => void
  /**
   * Tras el callback de `term.write()`: doble rAF para ir detrás del render
   * diferido de xterm v5 (setTimeout). Un solo rAF puede dejar el canvas viejo
   * hasta que el usuario teclee (KNOWN_ISSUES.md §1).
   */
  scheduleAfterWrite: () => void
  cancel: () => void
}

/** Mínimo entre limpiezas del atlas en repintados post-write (streaming PTY). */
const ATLAS_CLEAR_MIN_INTERVAL_MS = 500

export function createTerminalRepaintScheduler(
  getTerm: () => Terminal | null,
  getFollowState?: () => TerminalFollowState | undefined,
): TerminalRepaintScheduler {
  let raf = 0
  let afterWriteRaf = 0
  let lastAtlasClearAt = 0

  const runRepaint = (afterWrite: boolean): void => {
    const term = getTerm()
    const followState = getFollowState?.()
    const now = Date.now()
    const skipTextureAtlas = afterWrite && now - lastAtlasClearAt < ATLAS_CLEAR_MIN_INTERVAL_MS
    if (!skipTextureAtlas) lastAtlasClearAt = now
    repaintTerminalCanvas(term, {
      // Post-write el scroll pertenece al follow del callback de `term.write` y
      // al sync interno de xterm; un `syncScrollArea` aquí con el buffer aún
      // retrasado tira del scrollTop hacia arriba y oscila contra el follow
      // (salto arriba/abajo por frame al streamear un agente).
      skipViewportSync: afterWrite || shouldSkipViewportSyncOnRepaint(term, followState),
      skipTextureAtlas,
    })
  }

  return {
    schedule: () => {
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        runRepaint(false)
      })
    },
    scheduleAfterWrite: () => {
      if (afterWriteRaf !== 0) return
      afterWriteRaf = requestAnimationFrame(() => {
        afterWriteRaf = requestAnimationFrame(() => {
          afterWriteRaf = 0
          runRepaint(true)
        })
      })
    },
    cancel: () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      if (afterWriteRaf !== 0) {
        cancelAnimationFrame(afterWriteRaf)
        afterWriteRaf = 0
      }
    },
  }
}
