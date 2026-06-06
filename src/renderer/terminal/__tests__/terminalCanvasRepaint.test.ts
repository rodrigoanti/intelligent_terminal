/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { repaintTerminalCanvas } from '../terminalCanvasRepaint'

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
})
