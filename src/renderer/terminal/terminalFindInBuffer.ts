import type { Terminal } from '@xterm/xterm'

export interface TerminalBufferFindMatch {
  lineIndex: number
  col: number
  lineText: string
  matchLen: number
}

const MAX_BUFFER_MATCHES = 8000
const MAX_HISTORY_MATCHES = 400

/**
 * Busca todas las apariciones de `query` en el buffer activo (scrollback + visible).
 * Comparación sin distinguir mayúsculas (locale en-US para ASCII estable en paths).
 */
export function findMatchesInTerminalBuffer(term: Terminal, query: string): TerminalBufferFindMatch[] {
  const q = query.trim()
  if (!q) return []
  const ql = q.toLowerCase()
  const buf = term.buffer.active
  if (buf.type !== 'normal') return []
  const matches: TerminalBufferFindMatch[] = []
  for (let y = 0; y < buf.length && matches.length < MAX_BUFFER_MATCHES; y++) {
    const line = buf.getLine(y)
    if (!line) continue
    const text = line.translateToString(true)
    const tl = text.toLowerCase()
    let from = 0
    while (from < tl.length && matches.length < MAX_BUFFER_MATCHES) {
      const idx = tl.indexOf(ql, from)
      if (idx === -1) break
      matches.push({
        lineIndex: y,
        col: idx,
        lineText: text,
        matchLen: q.length,
      })
      from = idx + Math.max(1, ql.length)
    }
  }
  return matches
}

/** Líneas del MRU persistido que contienen la búsqueda (orden: más reciente primero). */
export function findMatchesInCommandHistory(recent: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return []
  const ql = q.toLowerCase()
  const out: string[] = []
  for (const line of recent) {
    if (line.toLowerCase().includes(ql)) out.push(line)
    if (out.length >= MAX_HISTORY_MATCHES) break
  }
  return out
}
