import React from 'react'
import { Icon } from './ui/Icon'
import { Button } from './ui/Button'
import { getTheme } from '@themes/presets'

interface ThemePickerTriggerProps {
  themeId: string
  themeName: string
  isOpen: boolean
  onClick: () => void
}

export const ThemePickerTrigger: React.FC<ThemePickerTriggerProps> = ({
  themeId,
  themeName,
  isOpen,
  onClick,
}) => {
  const theme = getTheme(themeId)
  const bg = theme.vars['--bg'] ?? theme.xterm.background
  const accent = theme.vars['--accent'] ?? theme.xterm.cursor

  return (
    <button
      type="button"
      tabIndex={-1}
      className="theme-picker-trigger"
      onClick={onClick}
      title="Elegir tema"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <span className="theme-picker-trigger-palette" aria-hidden="true">
        <span className="theme-picker-trigger-swatch-bg" style={{ background: bg }} />
        <span className="theme-picker-trigger-swatch-accent" style={{ background: accent }} />
      </span>
      <span className="theme-picker-trigger-label">{themeName}</span>
    </button>
  )
}
