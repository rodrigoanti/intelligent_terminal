import React from 'react'
import type { SplitDragAxis } from '../hooks/useSplitDrag'

interface SplitGutterProps {
  axis: SplitDragAxis
  ratio: number
  enabled: boolean
  dragging: boolean
  ariaLabel: string
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
}

export const SplitGutter: React.FC<SplitGutterProps> = ({
  axis,
  ratio,
  enabled,
  dragging,
  ariaLabel,
  onPointerDown,
}) => (
  <div
    role="separator"
    aria-orientation={axis === 'column' ? 'vertical' : 'horizontal'}
    aria-label={ariaLabel}
    aria-valuemin={15}
    aria-valuemax={85}
    aria-valuenow={Math.round(ratio * 100)}
    aria-disabled={!enabled}
    tabIndex={enabled ? 0 : -1}
    className={[
      'split-gutter',
      axis === 'column' ? 'split-gutter--column' : 'split-gutter--row',
      dragging ? 'split-gutter--dragging' : '',
      !enabled ? 'split-gutter--disabled' : '',
    ].filter(Boolean).join(' ')}
    onPointerDown={enabled ? onPointerDown : undefined}
  />
)
