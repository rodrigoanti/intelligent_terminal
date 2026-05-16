import React from 'react'
import { Icon } from '../components/ui/Icon'

interface TerminalScrollDownProps {
  visible: boolean
  onPointerDown: (e: React.MouseEvent) => void
  onClick: () => void
}

export const TerminalScrollDown: React.FC<TerminalScrollDownProps> = ({
  visible,
  onPointerDown,
  onClick,
}) => {
  if (!visible) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      className="terminal-scroll-down-btn terminal-chrome-btn"
      title="Ir a la salida más reciente"
      aria-label="Ir a la salida más reciente"
      onMouseDown={onPointerDown}
      onClick={onClick}
    >
      <Icon name="chevron-down" size={12} />
    </button>
  )
}
