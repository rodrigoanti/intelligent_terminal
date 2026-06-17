/** Mueve un elemento a `insertAt` (índice en el array tras quitar el origen). */
export function moveItemToIndex<T>(items: readonly T[], fromIndex: number, insertAt: number): T[] {
  if (fromIndex === insertAt) return [...items]
  if (fromIndex < 0 || insertAt < 0 || fromIndex >= items.length) return [...items]
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  const clamped = Math.max(0, Math.min(insertAt, next.length))
  next.splice(clamped, 0, moved)
  return next
}

/** Intercambia dos posiciones (p. ej. casillas de una rejilla de terminales). */
export function swapItemsAtIndices<T>(items: readonly T[], aIndex: number, bIndex: number): T[] {
  if (aIndex === bIndex) return [...items]
  if (aIndex < 0 || bIndex < 0 || aIndex >= items.length || bIndex >= items.length) {
    return [...items]
  }
  const next = [...items]
  ;[next[aIndex], next[bIndex]] = [next[bIndex], next[aIndex]]
  return next
}

/** Índice de inserción al soltar una pestaña antes/después de otra. */
export function computeTabInsertIndex(
  length: number,
  fromIndex: number,
  dropIndex: number,
  place: 'before' | 'after',
): number {
  let insertAt = place === 'before' ? dropIndex : dropIndex + 1
  if (fromIndex < insertAt) insertAt -= 1
  return Math.max(0, Math.min(insertAt, length - 1))
}

export function dropPlaceFromPointer(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
): 'before' | 'after' {
  return clientX < rect.left + rect.width / 2 ? 'before' : 'after'
}

/** Ignora dragleave al pasar a un hijo del mismo contenedor. */
export function isDragLeaveForContainer(container: HTMLElement, relatedTarget: EventTarget | null): boolean {
  if (!(relatedTarget instanceof Node)) return true
  return !container.contains(relatedTarget)
}
