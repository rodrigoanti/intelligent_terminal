import React from 'react'
import './Toggle.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  title?: string
  tabIndex?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled,
  title,
  tabIndex,
  onKeyDown,
  onClick,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    title={title}
    tabIndex={tabIndex}
    className={`toggle${checked ? ' toggle--on' : ''}`}
    onClick={e => {
      onClick?.(e)
      if (!e.defaultPrevented) onChange(!checked)
    }}
    onKeyDown={onKeyDown}
  >
    <span className="toggle__track" aria-hidden="true">
      <span className="toggle__thumb" />
    </span>
    <span className="toggle__label">{label}</span>
  </button>
)
