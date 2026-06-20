import { describe, expect, it } from 'vitest'
import { rankQuickOpenPaths, scoreQuickOpenPath, splitPathHighlight } from '../quickOpenScore'

describe('quickOpenScore', () => {
  it('prioriza coincidencia al inicio del nombre de archivo', () => {
    const a = scoreQuickOpenPath('src/renderer/App.tsx', 'app')
    const b = scoreQuickOpenPath('src/renderer/MapPanel.tsx', 'app')
    expect(a).toBeGreaterThan(b)
  })

  it('ordena rutas por relevancia', () => {
    const ranked = rankQuickOpenPaths(
      ['src/foo/bar.ts', 'src/bar.ts', 'package.json'],
      'bar',
    )
    expect(ranked[0]).toBe('src/bar.ts')
  })

  it('resalta caracteres en orden', () => {
    const segs = splitPathHighlight('TerminalPane.tsx', 'tp')
    expect(segs.filter(s => s.match).map(s => s.text).join('')).toBe('TP')
  })
})
