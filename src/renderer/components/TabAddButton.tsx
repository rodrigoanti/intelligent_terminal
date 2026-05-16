import React from 'react'
import { Icon } from './ui/Icon'

interface TabAddButtonProps {
  onClick: () => void
}

export const TabAddButton: React.FC<TabAddButtonProps> = ({ onClick }) => (
  <button
    className="tab-add"
    type="button"
    onClick={onClick}
    title="Nueva pestaña (⌘T)"
    aria-label="Nueva pestaña"
    tabIndex={-1}
  >
    <Icon name="plus" size={13} />
  </button>
)
