import React from 'react'
import { Icon } from './ui/Icon'

interface FontSizeControlProps {
  fontSize: number
  min: number
  max: number
  onIncrease: () => void
  onDecrease: () => void
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({
  fontSize,
  min,
  max,
  onIncrease,
  onDecrease,
}) => (
  <>
    <button
      type="button"
      tabIndex={-1}
      className="icon-btn font-size-btn"
      onClick={onDecrease}
      disabled={fontSize <= min}
      title="Reducir tamaño de letra"
    >
      <Icon name="zoom-out" size={14} />
    </button>
    <button
      type="button"
      tabIndex={-1}
      className="icon-btn font-size-btn"
      onClick={onIncrease}
      disabled={fontSize >= max}
      title="Aumentar tamaño de letra"
    >
      <Icon name="zoom-in" size={14} />
    </button>
  </>
)
