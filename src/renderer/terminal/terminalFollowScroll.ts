import type { Terminal } from '@xterm/xterm'

/** Líneas por encima del fondo que aún cuentan como «siguiendo» (scroll accidental). */
export const FOLLOW_SLACK_LINES = 3

export interface TerminalFollowState {
  /** Usuario se alejó del fondo a propósito (más allá del slack). */
  userDetached: boolean
}

type BufferServiceCore = { isUserScrolling: boolean }
type TerminalWithCore = Terminal & { _core?: { _bufferService?: BufferServiceCore } }

function getBufferService(term: Terminal): BufferServiceCore | undefined {
  return (term as TerminalWithCore)._core?._bufferService
}

export function clearUserScrolling(term: Terminal): void {
  const bs = getBufferService(term)
  if (bs) bs.isUserScrolling = false
}

export function clearFollowDetached(state: TerminalFollowState): void {
  state.userDetached = false
}

/** Actualiza `userDetached` según la distancia al fondo del buffer. */
export function updateFollowDetachedState(
  term: Terminal,
  state: TerminalFollowState,
  slackLines = FOLLOW_SLACK_LINES,
): void {
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') return
    state.userDetached = buf.viewportY < buf.baseY - slackLines
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

/** Fuerza el viewport al fondo; xterm sincroniza el DOM vía `onScroll`. */
export function followTerminalOutput(term: Terminal): void {
  const run = (): void => {
    clearUserScrolling(term)
    term.scrollToBottom()
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
    clearUserScrolling(term)
    if (!isAtBufferBottom(term)) {
      term.scrollToBottom()
    }
    if (state) clearFollowDetached(state)
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
  let followAtStart = false
  try {
    followAtStart = shouldFollowTerminalOutput(term, followState)
  } catch {
    /* buffer inválido */
  }

  try {
    term.write(data, () => {
      try {
        if (followAtStart || shouldFollowTerminalOutput(term, followState)) {
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
