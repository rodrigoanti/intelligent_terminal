import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getTheme,
  getThemesForPicker,
  themePreviewGradient,
  type AppTheme,
} from '@themes/presets'
import { TerminalModal } from './TerminalModal'
import './ThemePickerModal.css'

interface Props {
  open: boolean
  currentThemeId: string
  onSelect: (themeId: string) => void
  onClose: () => void
}

function ThemePreview({ theme, currentThemeId }: { theme: AppTheme; currentThemeId: string }): React.ReactElement {
  const v = theme.vars
  const bg = v['--bg'] ?? theme.xterm.background
  const fg = v['--text'] ?? theme.xterm.foreground
  const muted = v['--text-muted'] ?? theme.xterm.brightBlack
  const border = v['--border'] ?? theme.xterm.black
  const accent = v['--accent'] ?? theme.xterm.cursor
  const surface = v['--surface'] ?? theme.xterm.black
  const danger = v['--danger'] ?? theme.xterm.red
  const green = theme.xterm.green
  const active = theme.id === currentThemeId

  return (
    <div
      className="theme-picker-preview"
      style={{
        background: bg,
        borderColor: border,
        color: fg,
      }}
    >
      <div
        className="theme-picker-preview-chrome"
        style={{ background: surface, borderBottomColor: border }}
      >
        <span className="theme-picker-preview-chrome-accent" style={{ background: accent }} aria-hidden="true" />
        <span className="theme-picker-preview-chrome-dots" aria-hidden="true">
          <span style={{ background: danger }} />
          <span style={{ background: theme.xterm.yellow }} />
          <span style={{ background: green }} />
        </span>
      </div>
      <div className="theme-picker-preview-body">
        <div className="theme-picker-preview-title-row">
          <span className="theme-picker-preview-name" style={{ color: fg }}>{theme.name}</span>
          {active && <span className="theme-picker-preview-active" style={{ color: accent }}>activo</span>}
        </div>
        <div className="theme-picker-preview-lines">
          <span style={{ color: muted }}>user@project</span>
          <span style={{ color: accent }}> %</span>
          <span style={{ color: fg }}> ls</span>
        </div>
        <div className="theme-picker-preview-lines">
          <span style={{ color: green }}>src/</span>
          <span style={{ color: muted }}>  package.json</span>
        </div>
      </div>
    </div>
  )
}

export const ThemePickerModal: React.FC<Props> = ({
  open, currentThemeId, onSelect, onClose,
}) => {
  const pickerThemes = useMemo(() => getThemesForPicker(), [])
  const darkThemeCount = useMemo(
    () => pickerThemes.filter(t => t.appearance !== 'light').length,
    [pickerThemes],
  )
  const [focusedId, setFocusedId] = useState(currentThemeId)

  useEffect(() => {
    if (open) setFocusedId(currentThemeId)
  }, [open, currentThemeId])

  const focusedTheme = useMemo(() => getTheme(focusedId), [focusedId])

  const applyThemeId = useCallback((id: string) => {
    onSelect(id)
  }, [onSelect])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && focusedId) {
        e.preventDefault()
        e.stopPropagation()
        applyThemeId(focusedId)
        return
      }
      if (e.key === 'ArrowRight' && pickerThemes.length > 0) {
        e.preventDefault()
        const i = pickerThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? -1 : i
        const next = (from + 1 + pickerThemes.length) % pickerThemes.length
        setFocusedId(pickerThemes[next].id)
      }
      if (e.key === 'ArrowLeft' && pickerThemes.length > 0) {
        e.preventDefault()
        const i = pickerThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? 0 : i
        const prev = (from - 1 + pickerThemes.length) % pickerThemes.length
        setFocusedId(pickerThemes[prev].id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, focusedId, applyThemeId, pickerThemes])

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title="tema"
      titleId="theme-picker-title"
      size="md"
      zIndex={660}
      bodyClassName="terminal-modal-body theme-picker-body"
      footer={
        <span className="theme-picker-footer-hint">clic o [enter] aplica · ← → navegar · esc cerrar</span>
      }
    >
      <div className="theme-picker-scroll">
        <div className="theme-picker-preview-wrap">
          <ThemePreview theme={focusedTheme} currentThemeId={currentThemeId} />
        </div>
        <div className="theme-picker-spacer" aria-hidden="true" />
        <div className="theme-picker-rail">
          <div className="theme-picker-rail-scroll" role="listbox" aria-label="Elegir tema">
            {pickerThemes.map((t, i) => {
              const active = t.id === currentThemeId
              const focused = t.id === focusedId
              const showSep = darkThemeCount > 0 && i === darkThemeCount && i < pickerThemes.length
              return (
                <React.Fragment key={t.id}>
                  {showSep && <span className="theme-picker-rail-sep" aria-hidden="true" />}
                  <button
                    type="button"
                    className={[
                      'theme-picker-chip',
                      active ? 'theme-picker-chip--active' : '',
                      focused ? 'theme-picker-chip--focus' : '',
                    ].filter(Boolean).join(' ')}
                    role="option"
                    aria-selected={active}
                    title={t.name}
                    onClick={() => applyThemeId(t.id)}
                    onMouseEnter={() => setFocusedId(t.id)}
                    onFocus={() => setFocusedId(t.id)}
                  >
                    <span
                      className="theme-picker-chip-swatch"
                      style={{ background: themePreviewGradient(t) }}
                      aria-hidden="true"
                    />
                    <span className="theme-picker-chip-label">{t.name}</span>
                  </button>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>
    </TerminalModal>
  )
}
