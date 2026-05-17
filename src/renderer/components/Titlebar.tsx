import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import { getTheme } from '@themes/presets'
import { TitlebarMusicControls } from './TitlebarMusicControls'
import { FontSizeControl } from './FontSizeControl'
import { ThemePickerTrigger } from './ThemePickerTrigger'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import './Titlebar.css'

interface TitlebarProps {
  config: AppConfig
  fontSize: number
  fontSizeMin: number
  fontSizeMax: number
  themePickerOpen: boolean
  onFontIncrease: () => void
  onFontDecrease: () => void
  onOpenThemePicker: () => void
  onOpenSettings: () => void
}

export const Titlebar: React.FC<TitlebarProps> = ({
  config,
  fontSize,
  fontSizeMin,
  fontSizeMax,
  themePickerOpen,
  onFontIncrease,
  onFontDecrease,
  onOpenThemePicker,
  onOpenSettings,
}) => {
  const theme = getTheme(config.themeId)

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-actions">
        <TitlebarMusicControls config={config} onOpenSettings={onOpenSettings} />

        <FontSizeControl
          fontSize={fontSize}
          min={fontSizeMin}
          max={fontSizeMax}
          onIncrease={onFontIncrease}
          onDecrease={onFontDecrease}
        />

        <ThemePickerTrigger
          themeId={config.themeId}
          themeName={theme.name}
          isOpen={themePickerOpen}
          onClick={onOpenThemePicker}
        />

        <Button
          variant="icon"
          tabIndex={-1}
          onClick={onOpenSettings}
          title="Ajustes"
          aria-label="Ajustes"
        >
          <Icon name="settings" size={15} />
        </Button>
      </div>
    </div>
  )
}
