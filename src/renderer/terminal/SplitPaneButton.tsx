import React from 'react'
import { Icon } from '../components/ui/Icon'

interface SplitPaneButtonProps {
  visible: boolean
  onPointerDown: (e: React.MouseEvent) => void
  onClick: () => void
}

export const SplitPaneButton: React.FC<SplitPaneButtonProps> = ({
  visible,
  onPointerDown,
  onClick,
}) => {
  if (!visible) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      className="terminal-split-corner-btn terminal-chrome-btn"
      title="Añadir terminal en esta pestaña (hasta 4) · ⌘Y"
      aria-label="Añadir terminal en esta pestaña"
      onMouseDown={onPointerDown}
      onClick={onClick}
    >
      <Icon name="plus" size={11} />
    </button>
  )
}
