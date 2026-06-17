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

  it('scheduleAfterWrite repaints after two animation frames', async () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      getSelection: () => '',
      buffer: { active: { type: 'normal' as const, viewportY: 10, baseY: 10 } },
      element: document.createElement('div'),
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    const scheduler = createTerminalRepaintScheduler(() => term)
    scheduler.scheduleAfterWrite()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(refresh).not.toHaveBeenCalled()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(refresh).toHaveBeenCalledWith(0, 23)
  })

  it('scheduleAfterWrite never syncs viewport, even when buffer lags and DOM is not at bottom', async () => {
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const viewportEl = document.createElement('div')
    viewportEl.className = 'xterm-viewport'
    // DOM no está abajo (scrollHeight creció antes del sync interno de xterm):
    // antes este estado disparaba syncScrollArea → salto hacia arriba por chunk.
    Object.defineProperty(viewportEl, 'scrollTop', { value: 0, writable: true })
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
    scheduler.scheduleAfterWrite()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    expect(viewport.syncScrollArea).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith(0, 23)
  })

  it('scheduleAfterWrite throttles clearTextureAtlas during streaming', async () => {
    let nowValue = 1000
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
    const refresh = vi.fn()
    const clearTextureAtlas = vi.fn()
    const viewport = { syncScrollArea: vi.fn() }
    const term = {
      rows: 24,
      refresh,
      clearTextureAtlas,
      getSelection: () => '',
      buffer: { active: { type: 'normal' as const, viewportY: 10, baseY: 10 } },
      element: document.createElement('div'),
      _core: { viewport },
    } as unknown as Terminal & { clearTextureAtlas: () => void }

    const scheduler = createTerminalRepaintScheduler(() => term)
    const runAfterWrite = async (): Promise<void> => {
      scheduler.scheduleAfterWrite()
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }

    await runAfterWrite()
    expect(clearTextureAtlas).toHaveBeenCalledTimes(1)

    nowValue = 1200
    await runAfterWrite()
    expect(clearTextureAtlas).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(2)

    nowValue = 1700
    await runAfterWrite()
    expect(clearTextureAtlas).toHaveBeenCalledTimes(2)

    nowSpy.mockRestore()
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
