/** Segmento de ruta resaltado en quick open. */
export interface QuickOpenHighlightSegment {
  text: string
  match: boolean
}

/**
 * Puntuación tipo fuzzy: caracteres de la query en orden en la ruta.
 * Mayor = mejor coincidencia. -1 = no coincide.
 */
export function scoreQuickOpenPath(path: string, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const lower = path.toLowerCase()
  const name = (path.split('/').pop() ?? path).toLowerCase()

  let pi = 0
  let score = 0
  let consecutive = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!
    const idx = lower.indexOf(ch, pi)
    if (idx === -1) return -1
    if (idx === pi) consecutive += 1
    else consecutive = 1
    score += consecutive * 3
    if (idx === 0 || lower[idx - 1] === '/') score += 8
    pi = idx + 1
  }

  if (name.startsWith(q)) score += 60
  else if (name.includes(q)) score += 25
  if (lower.includes(q)) score += 12
  score -= path.split('/').length * 2
  return score
}

export function rankQuickOpenPaths(paths: string[], query: string): string[] {
  const q = query.trim()
  if (!q) return []
  const scored = paths
    .map(path => ({ path, score: scoreQuickOpenPath(path, q) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path, undefined, { sensitivity: 'base' }))
  return scored.map(x => x.path)
}

/** Resalta caracteres de la query en orden sobre la ruta. */
export function splitPathHighlight(path: string, query: string): QuickOpenHighlightSegment[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text: path, match: false }]

  const lower = path.toLowerCase()
  const segments: QuickOpenHighlightSegment[] = []
  let pi = 0
  let qi = 0

  while (qi < q.length) {
    const idx = lower.indexOf(q[qi]!, pi)
    if (idx === -1) return [{ text: path, match: false }]
    if (idx > pi) segments.push({ text: path.slice(pi, idx), match: false })
    segments.push({ text: path.slice(idx, idx + 1), match: true })
    pi = idx + 1
    qi += 1
  }
  if (pi < path.length) segments.push({ text: path.slice(pi), match: false })
  return segments
}
