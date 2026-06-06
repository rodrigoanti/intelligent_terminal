import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_PERCENT = 20
const MAX_PERCENT = 50

export function useExplorerResize(
  initialPercent: number,
  onWidthChange: (percent: number) => void,
): {
  treeWidthPercent: number
  onResizePointerDown: (e: React.PointerEvent) => void
} {
  const [treeWidthPercent, setTreeWidthPercent] = useState(initialPercent)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!draggingRef.current) setTreeWidthPercent(initialPercent)
  }, [initialPercent])

  const onResizePointerDown = useCallback((e: React.PointerEvent): void => {
    e.preventDefault()
    draggingRef.current = true
    const startX = e.clientX
    const startPercent = treeWidthPercent
    const container = (e.currentTarget as HTMLElement).closest('.terminal-file-explorer')
    if (!container) return
    const containerWidth = container.getBoundingClientRect().width

    const onMove = (ev: PointerEvent): void => {
      if (!draggingRef.current) return
      const delta = ev.clientX - startX
      const deltaPercent = (delta / containerWidth) * 100
      const next = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, startPercent + deltaPercent))
      setTreeWidthPercent(next)
    }

    const onUp = (): void => {
      draggingRef.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setTreeWidthPercent(prev => {
        onWidthChange(prev)
        return prev
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [treeWidthPercent, onWidthChange])

  return { treeWidthPercent, onResizePointerDown }
}
