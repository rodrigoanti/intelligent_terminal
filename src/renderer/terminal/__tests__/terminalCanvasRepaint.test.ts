/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { createTerminalRepaintScheduler, repaintTerminalCanvas, repaintTerminalCanvasForFollowState } from '../terminalCanvasRepaint'

describe('repaintTerminalCanvas', () => {
  it('syncs viewport and refreshes all rows', () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      element: document.createElement('div'),
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    term.element!.innerHTML = '<div class="xterm-viewport"></div>'
    repaintTerminalCanvas(term)

    expect(viewport.syncScrollArea).toHaveBeenCalledWith(true)
    expect(refresh).toHaveBeenCalledWith(0, 23)
    expect(clearTextureAtlas).toHaveBeenCalled()
  })

  it('ignores null or zero-row terminals', () => {
    const refresh = vi.fn()
    repaintTerminalCanvas(null)
    repaintTerminalCanvas({ rows: 0, refresh } as unknown as Terminal)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('can skip viewport sync while auto-following output', () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      element: document.createElement('div'),
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    repaintTerminalCanvas(term, { skipViewportSync: true })
    expect(viewport.syncScrollArea).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(0, 23)
  })

  it('scheduler skips viewport sync when DOM is at bottom but buffer lagged', async () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const viewportEl = document.createElement('div')
    viewportEl.className = 'xterm-viewport'
    Object.defineProperty(viewportEl, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(viewportEl, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(viewportEl, 'clientHeight', { value: 100, writable: true })
    const root = document.createElement('div')
    root.appendChild(viewportEl)

    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      getSelection: () => '',
      buffer: { active: { type: 'normal' as const, viewportY: 0, baseY: 120 } },
      element: root,
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    const followState = { userDetached: false }
    const scheduler = createTerminalRepaintScheduler(() => term, () => followState)
    scheduler.schedule()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    expect(viewport.syncScrollArea).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(0, 23)
  })

  it('repaintTerminalCanvasForFollowState skips sync when sticking to bottom', () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const viewportEl = document.createElement('div')
    viewportEl.className = 'xterm-viewport'
    Object.defineProperty(viewportEl, 'scrollTop', { value: 900, writable: true })
    Object.defineProperty(viewportEl, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(viewportEl, 'clientHeight', { value: 100, writable: true })
    const root = document.createElement('div')
    root.appendChild(viewportEl)

    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      getSelection: () => '',
      buffer: { active: { type: 'normal' as const, viewportY: 0, baseY: 120 } },
      element: root,
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    repaintTerminalCanvasForFollowState(term, { userDetached: false })
    expect(viewport.syncScrollArea).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(0, 23)
  })
})
