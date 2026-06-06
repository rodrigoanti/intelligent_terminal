import type { Terminal } from '@xterm/xterm'
import {
  clearUserScrolling,
  FOLLOW_SLACK_LINES,
  isProgrammaticScroll,
  runWithProgrammaticScroll,
  shouldFollowTerminalOutput,
  type TerminalFollowState,
} from './terminalFollowScroll'

/** Margen en px para considerar el viewport DOM «abajo del todo». */
const DOM_VIEWPORT_BOTTOM_EPS_PX = 4

/** Número de líneas de scroll (signo: + hacia salida reciente, − hacia historial). */
export function wheelDeltaToTerminalLines(ev: WheelEvent, termRows: number): number {
  if (ev.deltaY === 0 || ev.shiftKey) return 0

  let amount = ev.deltaY
  if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    amount = ev.deltaY
  } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    amount = ev.deltaY * termRows
  } else {
    const lineHeight = 17
    amount = ev.deltaY / lineHeight
  }

  if (amount === 0) return 0
  const sign = amount > 0 ? 1 : -1
  return sign * Math.max(1, Math.round(Math.abs(amount)))
}

/** El elemento aún puede absorber scroll nativo en la dirección del gesto. */
export function elementCanConsumeWheelScroll(el: HTMLElement, deltaY: number): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el
  const eps = 2
  if (deltaY < 0) return scrollTop > eps
  if (deltaY > 0) return scrollTop + clientHeight < scrollHeight - eps
  return false
}

const SCROLLABLE_ANCESTOR_SELECTOR = [
  '.ai-messages',
  '.cd-suggest',
  '.cmd-suggest',
  '.file-explorer-tree',
  '.file-code-editor .cm-scroller',
  '.git-panel-scroll',
  '.git-panel-files',
  '.git-diff-blocks__pre',
  '.git-panel-log',
  '.gh-actions-panel__body',
  '.theme-picker-scroll',
].join(', ')

function overflowYAllowsScroll(overflowY: string): boolean {
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

/** Primer ancestro con overflow desplazable que aún puede absorber el gesto. */
export function findWheelConsumingScrollableAncestor(
  target: HTMLElement | null,
  deltaY: number,
): HTMLElement | null {
  let el: HTMLElement | null = target
  while (el) {
    const { overflowY } = getComputedStyle(el)
    if (overflowYAllowsScroll(overflowY) && elementCanConsumeWheelScroll(el, deltaY)) {
      return el
    }
    el = el.parentElement
  }
  return null
}

/** ¿Debemos enviar la rueda al buffer de xterm en lugar del scroll nativo del DOM? */
export function shouldForwardWheelToTerminal(target: HTMLElement | null, deltaY: number): boolean {
  if (!target) return false
  if (target.closest('.xterm')) return false
  // Modales dentro del pane (p. ej. Git): el scroll nativo no debe ir al buffer PTY.
  if (target.closest('.terminal-modal-backdrop')) return false

  const scrollable = target.closest(SCROLLABLE_ANCESTOR_SELECTOR) as HTMLElement | null
  if (scrollable && elementCanConsumeWheelScroll(scrollable, deltaY)) return false

  if (findWheelConsumingScrollableAncestor(target, deltaY)) return false

  return true
}

type ViewportCore = { syncScrollArea: (immediate?: boolean) => void }
type TerminalWithCore = Terminal & { _core?: { viewport?: ViewportCore } }

export function syncTerminalViewport(term: Terminal): void {
  try {
    const viewport = (term as TerminalWithCore)._core?.viewport
    viewport?.syncScrollArea(true)
  } catch {
    /* dispose / dimensions */
  }
}

export function getTerminalViewportElement(term: Terminal): HTMLElement | null {
  return term.element?.querySelector('.xterm-viewport') ?? null
}

export function isDomViewportAtBottom(viewportEl: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = viewportEl
  return scrollTop + clientHeight >= scrollHeight - DOM_VIEWPORT_BOTTOM_EPS_PX
}

export function isBufferAtBottom(term: Terminal): boolean {
  try {
    const buf = term.buffer.active
    return buf.type === 'normal' && buf.viewportY >= buf.baseY
  } catch {
    return false
  }
}

/**
 * xterm a veces deja el scrollbar del DOM al máximo mientras `viewportY < baseY`
 * (p. ej. salida nueva con el usuario scrolleado arriba). Solo el botón/scrollToBottom
 * realineaba buffer y viewport.
 *
 * Si `followState.userDetached` es true el usuario subió intencionalmente el scroll;
 * en ese caso no forzamos un scrollToBottom aunque el DOM esté al tope.
 */
export function reconcileTerminalScrollIfDomAtBottom(
  term: Terminal,
  followState?: TerminalFollowState,
): void {
  if (isProgrammaticScroll()) return
  if (followState?.userDetached) return
  // Durante auto-follow el callback de term.write ya ajusta el viewport;
  // reconcile aquí compite y produce saltos al streamear salida del PTY.
  if (followState && shouldFollowTerminalOutput(term, followState)) return
  const viewportEl = getTerminalViewportElement(term)
  if (!viewportEl || !isDomViewportAtBottom(viewportEl) || isBufferAtBottom(term)) return
  try {
    runWithProgrammaticScroll(() => {
      clearUserScrolling(term)
      term.scrollToBottom()
    })
  } catch {
    /* dispose / dimensions */
  }
}

/** Misma holgura que `userDetached` / auto-follow: evita parpadeo del botón ↓ al streamear. */
export function isTerminalScrolledUp(
  term: Terminal,
  slackLines = FOLLOW_SLACK_LINES,
): boolean {
  try {
    const buf = term.buffer.active
    return buf.type === 'normal' && buf.viewportY < buf.baseY - slackLines
  } catch {
    return false
  }
}

/** Desplaza el buffer de xterm; devuelve si se aplicó. */
export function applyTerminalWheelScroll(term: Terminal, ev: WheelEvent): boolean {
  const lines = wheelDeltaToTerminalLines(ev, term.rows)
  if (lines === 0) return false
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal') return false
    term.scrollLines(lines)
    return true
  } catch {
    return false
  }
}

/** Snap al fondo si el gesto dejó al viewport cerca del prompt o el DOM ya no puede bajar más. */
export function snapTerminalToBottomIfNear(term: Terminal, ev: WheelEvent): void {
  if (ev.deltaY <= 0) return
  try {
    const buf = term.buffer.active
    if (buf.type !== 'normal' || buf.viewportY >= buf.baseY) return
    const gap = buf.baseY - buf.viewportY
    const viewportEl = getTerminalViewportElement(term)
    const domStuckAtBottom = viewportEl ? isDomViewportAtBottom(viewportEl) : false
    if (gap <= 2 || domStuckAtBottom) {
      clearUserScrolling(term)
      term.scrollToBottom()
    }
  } catch {
    /* ignore */
  }
}

export function handleForwardedTerminalWheel(
  term: Terminal,
  ev: WheelEvent,
  followState?: TerminalFollowState,
  onAfterScroll?: () => void,
): boolean {
  if (!shouldForwardWheelToTerminal(ev.target as HTMLElement | null, ev.deltaY)) return false
  if (!applyTerminalWheelScroll(term, ev)) return false
  snapTerminalToBottomIfNear(term, ev)
  reconcileTerminalScrollIfDomAtBottom(term, followState)
  if (ev.cancelable) ev.preventDefault()
  onAfterScroll?.()
  return true
}
