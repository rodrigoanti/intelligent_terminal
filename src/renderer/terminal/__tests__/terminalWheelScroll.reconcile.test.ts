/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { reconcileTerminalScrollIfDomAtBottom } from '../terminalWheelScroll'
import type { TerminalFollowState } from '../terminalFollowScroll'

function makeTerm(viewportY: number, baseY: number): Terminal {
  const scrollToBottom = vi.fn()
  const viewport = document.createElement('div')
  viewport.className = 'xterm-viewport'
  Object.defineProperty(viewport, 'scrollTop', { value: 1000, writable: true })
  Object.defineProperty(viewport, 'scrollHeight', { value: 1100, writable: true })
  Object.defineProperty(viewport, 'clientHeight', { value: 100, writable: true })
  const root = document.createElement('div')
  root.appendChild(viewport)
  return {
    buffer: { active: { type: 'normal' as const, viewportY, baseY } },
    getSelection: () => '',
    scrollToBottom,
    element: root,
    _core: { _bufferService: { isUserScrolling: false } },
  } as unknown as Terminal
}

describe('reconcileTerminalScrollIfDomAtBottom', () => {
  it('skips reconcile during auto-follow near bottom', () => {
    const term = makeTerm(8, 10)
    const state: TerminalFollowState = { userDetached: false }
    reconcileTerminalScrollIfDomAtBottom(term, state)
    expect(term.scrollToBottom).not.toHaveBeenCalled()
  })

  it('reconciles when user scrolled up intentionally', () => {
    const term = makeTerm(0, 10)
    const state: TerminalFollowState = { userDetached: true }
    reconcileTerminalScrollIfDomAtBottom(term, state)
    expect(term.scrollToBottom).not.toHaveBeenCalled()
  })

  it('skips reconcile when DOM is at bottom but buffer lagged during stream', () => {
    const term = makeTerm(0, 120)
    const state: TerminalFollowState = { userDetached: false }
    reconcileTerminalScrollIfDomAtBottom(term, state)
    expect(term.scrollToBottom).not.toHaveBeenCalled()
  })
})
