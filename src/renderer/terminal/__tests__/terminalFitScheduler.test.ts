/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTerminalFitScheduler,
  FIT_BURST_COALESCE_MS,
  fitTerminalPreserveScroll,
} from '../terminalFitScheduler'
import type { TerminalFollowState } from '../terminalFollowScroll'

afterEach(() => {
  vi.useRealTimers()
})

function makeTerm(opts: {
  viewportY: number
  baseY: number
  cols?: number
  rows?: number
  afterFit?: { cols: number; rows: number; viewportY: number; baseY: number }
}) {
  const scrollToBottom = vi.fn()
  const scrollToLine = vi.fn()
  const fit = {
    fit: vi.fn(() => {
      if (opts.afterFit) {
        buf.viewportY = opts.afterFit.viewportY
        buf.baseY = opts.afterFit.baseY
        term.cols = opts.afterFit.cols
        term.rows = opts.afterFit.rows
      }
    }),
  }

  const buf = {
    type: 'normal' as const,
    viewportY: opts.viewportY,
    baseY: opts.baseY,
  }

  const term = {
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    buffer: { active: buf },
    getSelection: () => '',
    scrollToBottom,
    scrollToLine,
    _core: { _bufferService: { isUserScrolling: false } },
  }

  return { term: term as never, fit: fit as never, scrollToBottom, scrollToLine, buf }
}

describe('fitTerminalPreserveScroll', () => {
  it('sticks to bottom when auto-following output after resize', () => {
    const followState: TerminalFollowState = { userDetached: false }
    const { term, fit, scrollToBottom } = makeTerm({
      viewportY: 8,
      baseY: 10,
      rows: 24,
      afterFit: { cols: 80, rows: 20, viewportY: 0, baseY: 14 },
    })

    fitTerminalPreserveScroll(term, fit, followState)
    expect(scrollToBottom).toHaveBeenCalled()
    expect(followState.userDetached).toBe(false)
  })

  it('sticks to bottom when DOM is at bottom but buffer lagged before resize', () => {
    const followState: TerminalFollowState = { userDetached: false }
    const viewport = document.createElement('div')
    viewport.className = 'xterm-viewport'
    Object.defineProperty(viewport, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(viewport, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: 100, writable: true })
    const root = document.createElement('div')
    root.appendChild(viewport)

    const scrollToBottom = vi.fn()
    const scrollToLine = vi.fn()
    const fit = {
      fit: vi.fn(() => {
        buf.viewportY = 0
        buf.baseY = 140
        term.rows = 20
      }),
    }
    const buf = { type: 'normal' as const, viewportY: 0, baseY: 120 }
    const term = {
      cols: 80,
      rows: 24,
      buffer: { active: buf },
      getSelection: () => '',
      scrollToBottom,
      scrollToLine,
      element: root,
      _core: { _bufferService: { isUserScrolling: false } },
    }

    fitTerminalPreserveScroll(term as never, fit as never, followState)
    expect(scrollToBottom).toHaveBeenCalled()
    expect(scrollToLine).not.toHaveBeenCalled()
  })

  it('sticks to bottom when DOM lagged but buffer has unconsumed output', () => {
    const followState: TerminalFollowState = { userDetached: false }
    const viewport = document.createElement('div')
    viewport.className = 'xterm-viewport'
    Object.defineProperty(viewport, 'scrollTop', { value: 0, writable: true })
    Object.defineProperty(viewport, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: 100, writable: true })
    const root = document.createElement('div')
    root.appendChild(viewport)

    const scrollToBottom = vi.fn()
    const scrollToLine = vi.fn()
    const fit = {
      fit: vi.fn(() => {
        buf.viewportY = 0
        buf.baseY = 140
        term.rows = 20
      }),
    }
    const buf = { type: 'normal' as const, viewportY: 0, baseY: 120 }
    const term = {
      cols: 80,
      rows: 24,
      buffer: { active: buf },
      getSelection: () => '',
      scrollToBottom,
      scrollToLine,
      element: root,
      _core: { _bufferService: { isUserScrolling: false } },
    }

    fitTerminalPreserveScroll(term as never, fit as never, followState)
    expect(scrollToBottom).toHaveBeenCalled()
    expect(scrollToLine).not.toHaveBeenCalled()
  })

  it('preserves scroll line when user detached intentionally', () => {
    const followState: TerminalFollowState = { userDetached: true }
    const { term, fit, scrollToBottom, scrollToLine } = makeTerm({
      viewportY: 2,
      baseY: 10,
      rows: 24,
      afterFit: { cols: 80, rows: 20, viewportY: 0, baseY: 14 },
    })

    fitTerminalPreserveScroll(term, fit, followState)
    expect(scrollToBottom).not.toHaveBeenCalled()
    expect(scrollToLine).toHaveBeenCalledWith(2)
  })

  it('no-ops scroll when dimensions unchanged', () => {
    const followState: TerminalFollowState = { userDetached: false }
    const { term, fit, scrollToBottom, scrollToLine } = makeTerm({
      viewportY: 10,
      baseY: 10,
      rows: 24,
    })

    fitTerminalPreserveScroll(term, fit, followState)
    expect(scrollToBottom).not.toHaveBeenCalled()
    expect(scrollToLine).not.toHaveBeenCalled()
  })

  it('coalesces resize bursts to at most one fit per window (AI dock token growth)', () => {
    vi.useFakeTimers({
      now: 100_000,
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    const { term, fit } = makeTerm({ viewportY: 10, baseY: 10, rows: 24 })
    const container = { clientWidth: 800, clientHeight: 600 } as HTMLElement
    const scheduler = createTerminalFitScheduler(
      () => term,
      () => fit,
      () => container,
      { userDetached: false },
      () => {},
    )
    const fitFn = (fit as unknown as { fit: ReturnType<typeof vi.fn> }).fit

    scheduler.schedule()
    vi.advanceTimersToNextFrame()
    expect(fitFn).toHaveBeenCalledTimes(1)

    // Ráfaga: el dock crece a cada token → schedule por frame. Debe coalescer.
    ;(container as { clientHeight: number }).clientHeight = 580
    scheduler.schedule()
    ;(container as { clientHeight: number }).clientHeight = 560
    scheduler.schedule()
    vi.advanceTimersToNextFrame()
    expect(fitFn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(FIT_BURST_COALESCE_MS)
    vi.advanceTimersToNextFrame()
    expect(fitFn).toHaveBeenCalledTimes(2)
  })

  it('runNow cancels a pending burst fit and runs immediately', () => {
    vi.useFakeTimers({
      now: 100_000,
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
    })
    const { term, fit } = makeTerm({ viewportY: 10, baseY: 10, rows: 24 })
    const container = { clientWidth: 800, clientHeight: 600 } as HTMLElement
    const scheduler = createTerminalFitScheduler(
      () => term,
      () => fit,
      () => container,
      { userDetached: false },
      () => {},
    )
    const fitFn = (fit as unknown as { fit: ReturnType<typeof vi.fn> }).fit

    scheduler.schedule()
    vi.advanceTimersToNextFrame()
    expect(fitFn).toHaveBeenCalledTimes(1)

    ;(container as { clientHeight: number }).clientHeight = 580
    scheduler.schedule()
    ;(container as { clientHeight: number }).clientHeight = 560
    scheduler.runNow()
    expect(fitFn).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(FIT_BURST_COALESCE_MS * 2)
    vi.advanceTimersToNextFrame()
    expect(fitFn).toHaveBeenCalledTimes(2)
  })

  it('still repaints canvas when dimensions unchanged (tab visibility)', () => {
    const followState: TerminalFollowState = { userDetached: false }
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const { term, fit } = makeTerm({
      viewportY: 10,
      baseY: 10,
      rows: 24,
    })
    Object.assign(term, {
      refresh,
      clearTextureAtlas,
      _core: { viewport, _bufferService: { isUserScrolling: false } },
    })

    fitTerminalPreserveScroll(term, fit, followState)
    expect(refresh).toHaveBeenCalledWith(0, 23)
    expect(clearTextureAtlas).toHaveBeenCalled()
  })
})
