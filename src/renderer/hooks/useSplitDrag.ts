import { useCallback, useEffect, useRef, useState } from 'react'
import { clampColumnRatio, clampRowRatio } from '../tabSplitSizes'

export type SplitDragAxis = 'column' | 'row'

interface UseSplitDragOptions {
  axis: SplitDragAxis
  enabled: boolean
  getContainer: () => HTMLElement | null
  onRatioChange: (ratio: number) => void
  onCommit?: () => void
}

export function useSplitDrag({
  axis,
  enabled,
  getContainer,
  onRatioChange,
  onCommit,
}: UseSplitDragOptions): {
  dragging: boolean
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
} {
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ pointerId: number } | null>(null)
  const onRatioChangeRef = useRef(onRatioChange)
  const onCommitRef = useRef(onCommit)
  const getContainerRef = useRef(getContainer)
  onRatioChangeRef.current = onRatioChange
  onCommitRef.current = onCommit
  getContainerRef.current = getContainer

  const endDrag = useCallback((pointerId: number, target: HTMLElement | null, commit: boolean) => {
    if (dragRef.current?.pointerId !== pointerId) return
    dragRef.current = null
    setDragging(false)
    document.body.classList.remove('body--split-dragging')
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    try {
      target?.releasePointerCapture(pointerId)
    } catch {
      /* already released */
    }
    if (commit) onCommitRef.current?.()
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent): void => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return
      const container = getContainerRef.current()
      if (!container) return
      const rect = container.getBoundingClientRect()
      let next: number
      if (axis === 'column') {
        if (rect.width <= 0) return
        next = (e.clientX - rect.left) / rect.width
        next = clampColumnRatio(next, rect.width)
      } else {
        if (rect.height <= 0) return
        next = (e.clientY - rect.top) / rect.height
        next = clampRowRatio(next, rect.height)
      }
      onRatioChangeRef.current(next)
    }
    const onUp = (e: PointerEvent): void => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return
      endDrag(e.pointerId, e.target as HTMLElement | null, true)
    }
    const onCancel = (e: PointerEvent): void => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return
      endDrag(e.pointerId, e.target as HTMLElement | null, false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [dragging, axis, endDrag])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      dragRef.current = { pointerId: e.pointerId }
      setDragging(true)
      document.body.classList.add('body--split-dragging')
      document.body.style.cursor = axis === 'column' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      const container = getContainerRef.current()
      if (!container) return
      const rect = container.getBoundingClientRect()
      let next: number
      if (axis === 'column') {
        next = clampColumnRatio((e.clientX - rect.left) / rect.width, rect.width)
      } else {
        next = clampRowRatio((e.clientY - rect.top) / rect.height, rect.height)
      }
      onRatioChangeRef.current(next)
    },
    [enabled, axis],
  )

  return { dragging, onPointerDown }
}
