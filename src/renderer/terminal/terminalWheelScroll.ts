import type { Terminal } from '@xterm/xterm'

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
  '.theme-picker-scroll',
].join(', ')

/** ¿Debemos enviar la rueda al buffer de xterm en lugar del scroll nativo del DOM? */
export function shouldForwardWheelToTerminal(target: HTMLElement | null, deltaY: number): boolean {
  if (!target) return false
  if (target.closest('.xterm')) return false

  const scrollable = target.closest(SCROLLABLE_ANCESTOR_SELECTOR) as HTMLElement | null
  if (scrollable && elementCanConsumeWheelScroll(scrollable, deltaY)) return false

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

export function isTerminalScrolledUp(term: Terminal): boolean {
  try {
    const buf = term.buffer.active
    return buf.type === 'normal' && buf.viewportY < buf.baseY
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

/**
 * Si el viewport DOM quedó desfasado respecto al buffer, re-sincroniza o acerca al fondo
 * tras un gesto hacia abajo.
 */
export function repairTerminalViewportAfterWheel(term: Terminal, ev: WheelEvent): void {
  if (ev.deltaY <= 0) return
  try {
    syncTerminalViewport(term)
    const buf = term.buffer.active
    if (buf.type !== 'normal' || buf.viewportY >= buf.baseY) return
    const gap = buf.baseY - buf.viewportY
    if (gap <= 2) {
      term.scrollToBottom()
      return
    }
    const lines = wheelDeltaToTerminalLines(ev, term.rows)
    if (lines > 0) term.scrollLines(Math.min(gap, lines))
  } catch {
    /* ignore */
  }
}

export function handleForwardedTerminalWheel(
  term: Terminal,
  ev: WheelEvent,
  onAfterScroll?: () => void,
): boolean {
  if (!shouldForwardWheelToTerminal(ev.target as HTMLElement | null, ev.deltaY)) return false
  if (!applyTerminalWheelScroll(term, ev)) return false
  repairTerminalViewportAfterWheel(term, ev)
  syncTerminalViewport(term)
  if (ev.cancelable) ev.preventDefault()
  onAfterScroll?.()
  return true
}
