import type { Terminal } from '@xterm/xterm'
import { getTerminalViewportElement, isDomViewportAtBottom } from './terminalWheelScroll'

/** Líneas por encima del fondo que aún cuentan como «siguiendo» (scroll accidental). */
export const FOLLOW_SLACK_LINES = 3

export interface TerminalFollowState {
  /** Usuario se alejó del fondo a propósito (más allá del slack). */
  userDetached: boolean
}

/** Evita marcar `userDetached` durante scroll programático (follow/reconcile). */
let programmaticScrollDepth = 0

export function isProgrammaticScroll(): boolean {
  return programmaticScrollDepth > 0
}

export function runWithProgrammaticScroll(fn: () => void): void {
  programmaticScrollDepth++
  try {
    fn()
  } finally {
    programmaticScrollDepth--
  }
}

type BufferServiceCore = { isUserScrolling: boolean }
type TerminalWithCore = Terminal & { _core?: { _bufferService?: BufferServiceCore } }

function getBufferService(term: Terminal): BufferServiceCore | undefined {
  return (term as TerminalWithCore)._core?._bufferService
}

export function isUserScrolling(term: Terminal): boolean {
  return getBufferService(term)?.isUserScrolling ?? false
}

export function clearUserScrolling(term: Terminal): void {
  const bs = getBufferService(term)
  if (bs) bs.isUserScrolling = false
}

export function clearFollowDetached(state: TerminalFollowState): void {
  state.userDetached = false
}

function isViewportDetachedFromBottom(
  term: Terminal,
  slackLines = FOLLOW_SLACK_LINES,
): boolean {
  const buf = term.buffer.active
  if (buf.type !== 'normal') return false
  return buf.viewportY < buf.baseY - slackLines
}

/**
 * Actualiza `userDetached` solo tras scroll iniciado por el usuario.
 * Ignora el desfase transitorio buffer/DOM durante follow o reconcile programático.
 */
export function updateFollowDetachedState(
  term: Terminal,
  state: TerminalFollowState,
  slackLines = FOLLOW_SLACK_LINES,
): void {
  if (isProgrammaticScroll()) return
  if (!isUserScrolling(term)) return
  try {
    // Durante streaming el buffer puede ir retrasado mientras el DOM sigue abajo.
    const viewportEl = getTerminalViewportElement(term)
    if (viewportEl != null && isDomViewportAtBottom(viewportEl)) return
    state.userDetached = isViewportDetachedFromBottom(term, slackLines)
  } catch {
    /* dispose */
  }
}

export function shouldFollowTerminalOutput(
  term: Terminal,
  state: TerminalFollowState,
  slackLines = FOLLOW_SLACK_LINES,
): boolean {
  if (state.userDetached) return false
  if (term.getSelection().length > 0) return false
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') return false
    return buf.viewportY >= buf.baseY - slackLines
  } catch {
    return false
  }
}

/**
 * ¿Mantener el prompt visible tras un `fit()`?
 * Durante streaming del PTY el buffer puede ir por detrás del scrollbar DOM;
 * si el usuario no se desenganchó y el DOM sigue abajo, forzar fondo evita
 * `scrollToLine(0)` y saltos al inicio del scrollback.
 */
export function shouldStickTerminalToBottom(
  term: Terminal,
  state: TerminalFollowState,
  slackLines = FOLLOW_SLACK_LINES,
): boolean {
  if (state.userDetached) return false
  if (term.getSelection().length > 0) return false
  if (shouldFollowTerminalOutput(term, state, slackLines)) return true
  try {
    const viewportEl = getTerminalViewportElement(term)
    return viewportEl != null && isDomViewportAtBottom(viewportEl)
  } catch {
    return false
  }
}

/** Viewport en la última línea del buffer (no «cerca», sino ya abajo). */
function isAtBufferBottom(term: Terminal): boolean {
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') return false
    return buf.viewportY >= buf.baseY
  } catch {
    return false
  }
}

/** Desplaza solo las líneas necesarias para alcanzar el fondo del buffer. */
function scrollGapToBottom(term: Terminal): void {
  const buf = term.buffer.active
  if (buf.type !== 'normal') {
    term.scrollToBottom()
    return
  }
  const gap = buf.baseY - buf.viewportY
  if (gap > 0) term.scrollLines(gap)
}

/** Fuerza el viewport al fondo; xterm sincroniza el DOM vía `onScroll`. */
export function followTerminalOutput(term: Terminal): void {
  const run = (): void => {
    runWithProgrammaticScroll(() => {
      clearUserScrolling(term)
      term.scrollToBottom()
    })
  }
  try {
    run()
  } catch {
    requestAnimationFrame(() => {
      try {
        run()
      } catch {
        /* dimensions / dispose */
      }
    })
  }
}

/**
 * Sigue la salida sin `scrollToBottom` redundante si el viewport ya está en la
 * última línea. Evita saltos al teclear en la misma línea; si `baseY` creció
 * (nueva salida), `viewportY < baseY` y sí baja al fondo.
 */
export function followTerminalOutputSoft(term: Terminal, state?: TerminalFollowState): void {
  const run = (): void => {
    runWithProgrammaticScroll(() => {
      clearUserScrolling(term)
      if (!isAtBufferBottom(term)) {
        scrollGapToBottom(term)
      }
      if (state) clearFollowDetached(state)
    })
  }
  try {
    run()
  } catch {
    requestAnimationFrame(() => {
      try {
        run()
      } catch {
        /* dimensions / dispose */
      }
    })
  }
}

/**
 * Escribe salida del PTY y sigue el fondo si el usuario no se desenganchó
 * (evalúa de nuevo en el callback de `term.write` tras parsear el chunk).
 */
export function writePtyDataWithFollowScroll(
  term: Terminal,
  data: string,
  followState: TerminalFollowState,
  afterParsed?: () => void,
): void {
  if (!data) {
    try { afterParsed?.() } catch { /* ignore */ }
    return
  }

  let stickAtStart = false
  try {
    stickAtStart = shouldStickTerminalToBottom(term, followState)
  } catch {
    /* buffer inválido */
  }

  try {
    term.write(data, () => {
      try {
        if (stickAtStart || shouldStickTerminalToBottom(term, followState)) {
          followTerminalOutputSoft(term, followState)
        } else {
          updateFollowDetachedState(term, followState)
        }
      } catch {
        /* scroll / dispose */
      }
      try {
        afterParsed?.()
      } catch {
        /* ignore */
      }
    })
  } catch {
    /* write inválido (dispose en curso) */
  }
}

export interface PtyWriteBatcher {
  write: (data: string, afterParsed?: () => void) => void
  dispose: () => void
}

/**
 * Agrupa chunks IPC del PTY en un solo `term.write` por frame para reducir
 * carreras de scroll y repintados durante streaming.
 */
export function createPtyWriteBatcher(
  getTerm: () => Terminal | null,
  followState: TerminalFollowState,
): PtyWriteBatcher {
  let pending = ''
  const afterParsedCbs: Array<() => void> = []
  let raf = 0

  const flush = (): void => {
    raf = 0
    const term = getTerm()
    const chunk = pending
    pending = ''
    const cbs = afterParsedCbs.splice(0)
    if (!term || !chunk) {
      for (const cb of cbs) {
        try { cb() } catch { /* ignore */ }
      }
      return
    }
    writePtyDataWithFollowScroll(term, chunk, followState, () => {
      for (const cb of cbs) {
        try { cb() } catch { /* ignore */ }
      }
    })
  }

  const schedule = (): void => {
    if (raf !== 0) return
    raf = requestAnimationFrame(flush)
  }

  return {
    write(data, afterParsed) {
      if (!data) return
      pending += data
      if (afterParsed) afterParsedCbs.push(afterParsed)
      schedule()
    },
    dispose() {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      pending = ''
      afterParsedCbs.length = 0
    },
  }
}
