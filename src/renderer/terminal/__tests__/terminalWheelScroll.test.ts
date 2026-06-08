/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  elementCanConsumeWheelScroll,
  findWheelConsumingScrollableAncestor,
  isDomViewportAtBottom,
  shouldForwardWheelToTerminal,
  wheelDeltaToTerminalLines,
} from '../terminalWheelScroll'

describe('terminalWheelScroll', () => {
  it('wheelDeltaToTerminalLines converts pixel delta to lines', () => {
    const ev = { deltaY: 34, deltaMode: 0, shiftKey: false } as WheelEvent
    expect(wheelDeltaToTerminalLines(ev, 24)).toBe(2)
  })

  it('wheelDeltaToTerminalLines returns 0 for shift+wheel', () => {
    const ev = { deltaY: 100, deltaMode: 0, shiftKey: true } as WheelEvent
    expect(wheelDeltaToTerminalLines(ev, 24)).toBe(0)
  })

  it('elementCanConsumeWheelScroll detects scroll room', () => {
    const el = {
      scrollTop: 10,
      scrollHeight: 200,
      clientHeight: 100,
    } as HTMLElement
    expect(elementCanConsumeWheelScroll(el, -50)).toBe(true)
    expect(elementCanConsumeWheelScroll(el, 50)).toBe(true)
  })

  it('isDomViewportAtBottom detects bottom position', () => {
    const el = { scrollTop: 96, scrollHeight: 200, clientHeight: 100 } as HTMLElement
    expect(isDomViewportAtBottom(el)).toBe(true)
  })

  it('shouldForwardWheelToTerminal ignores xterm target', () => {
    const target = document.createElement('div')
    target.className = 'xterm'
    expect(shouldForwardWheelToTerminal(target, 10)).toBe(false)
  })

  it('shouldForwardWheelToTerminal ignores wheel inside terminal modals', () => {
    const backdrop = document.createElement('div')
    backdrop.className = 'terminal-modal-backdrop'
    const panel = document.createElement('div')
    panel.className = 'git-panel-files'
    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    expect(shouldForwardWheelToTerminal(panel, 10)).toBe(false)
    backdrop.remove()
  })

  it('shouldForwardWheelToTerminal ignores wheel inside file explorer overlay', () => {
    const explorer = document.createElement('aside')
    explorer.className = 'terminal-file-explorer'
    const tree = document.createElement('div')
    tree.className = 'file-explorer-tree'
    Object.defineProperty(tree, 'scrollTop', { value: 0, writable: true })
    Object.defineProperty(tree, 'scrollHeight', { value: 400, writable: true })
    Object.defineProperty(tree, 'clientHeight', { value: 120, writable: true })
    explorer.appendChild(tree)
    document.body.appendChild(explorer)
    // En el tope: elementCanConsumeWheelScroll sería false, pero el overlay bloquea igual.
    expect(shouldForwardWheelToTerminal(tree, -10)).toBe(false)
    // En el fondo: antes se reenviaba a xterm.
    Object.defineProperty(tree, 'scrollTop', { value: 280, writable: true })
    expect(shouldForwardWheelToTerminal(tree, 10)).toBe(false)
    explorer.remove()
  })

  it('findWheelConsumingScrollableAncestor prefers nested overflow containers', () => {
    const outer = document.createElement('div')
    const inner = document.createElement('ul')
    inner.className = 'git-panel-files'
    inner.style.overflowY = 'auto'
    Object.defineProperty(inner, 'scrollTop', { value: 0, writable: true })
    Object.defineProperty(inner, 'scrollHeight', { value: 400, writable: true })
    Object.defineProperty(inner, 'clientHeight', { value: 120, writable: true })
    outer.appendChild(inner)
    document.body.appendChild(outer)
    expect(findWheelConsumingScrollableAncestor(inner, 10)).toBe(inner)
    outer.remove()
  })
})
