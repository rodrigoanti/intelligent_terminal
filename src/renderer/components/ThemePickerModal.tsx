import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getTheme, getThemesForPicker } from '@themes/presets'
import { TerminalModal } from './TerminalModal'
import { ThemePreview } from './ThemePreview'
import { ThemeChip } from './ThemeChip'
import { Input } from './ui/Input'
import './ThemePickerModal.css'

function themeMatchesQuery(theme: { name: string; id: string }, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return theme.name.toLowerCase().includes(s) || theme.id.toLowerCase().includes(s)
}

interface Props {
  open: boolean
  currentThemeId: string
  onSelectTheme: (themeId: string) => void
  onClose: () => void
}

export const ThemePickerModal: React.FC<Props> = ({
  open,
  currentThemeId,
  onSelectTheme,
  onClose,
}) => {
  const pickerThemes = useMemo(() => getThemesForPicker(), [])
  const [filter, setFilter] = useState('')
  const filteredThemes = useMemo(
    () => pickerThemes.filter(t => themeMatchesQuery(t, filter)),
    [pickerThemes, filter],
  )

  const firstLightInFiltered = useMemo(
    () => filteredThemes.findIndex(t => t.appearance === 'light'),
    [filteredThemes],
  )

  const [focusedId, setFocusedId] = useState(currentThemeId)

  useEffect(() => {
    if (open) { setFocusedId(currentThemeId); setFilter('') }
  }, [open, currentThemeId])

  useEffect(() => {
    if (!open) return
    if (filteredThemes.some(t => t.id === focusedId)) return
    const preferred = filteredThemes.find(t => t.id === currentThemeId)?.id ?? filteredThemes[0]?.id
    if (preferred) setFocusedId(preferred)
  }, [open, filteredThemes, focusedId, currentThemeId])

  const focusedTheme = useMemo(() => getTheme(focusedId), [focusedId])

  const applyThemeId = useCallback((id: string) => { onSelectTheme(id) }, [onSelectTheme])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target
      if (el instanceof HTMLElement && el.closest('.theme-picker-filter')) return
      if (e.key === 'Enter' && focusedId && filteredThemes.length > 0) {
        e.preventDefault(); e.stopPropagation(); applyThemeId(focusedId); return
      }
      if (e.key === 'ArrowRight' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? -1 : i
        setFocusedId(filteredThemes[(from + 1 + filteredThemes.length) % filteredThemes.length].id)
      }
      if (e.key === 'ArrowLeft' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? 0 : i
        setFocusedId(filteredThemes[(from - 1 + filteredThemes.length) % filteredThemes.length].id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, focusedId, applyThemeId, filteredThemes])

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title="tema"
      titleId="theme-picker-title"
      size="xl"
      panelClassName="theme-picker-modal-panel"
      zIndex={660}
      bodyClassName="terminal-modal-body theme-picker-body"
      footer={
        <span className="theme-picker-footer-hint">
          filtro por nombre · clic o [enter] · ← → · esc cerrar
        </span>
      }
    >
      <div className="theme-picker-scroll">
        <div className="theme-picker-preview-wrap">
          <ThemePreview theme={focusedTheme} currentThemeId={currentThemeId} />
        </div>
        <div className="theme-picker-spacer" aria-hidden="true" />
        <div className="theme-picker-sticky-stack">
          <div className="theme-picker-rail-label theme-picker-rail-label--path">
            título · pestañas · terminal · barra IA
          </div>
          <Input
            type="search"
            size="md"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="filtrar tema… (p. ej. interstellar)"
            aria-label="Filtrar lista de temas"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="theme-picker-theme-grid" role="listbox" aria-label="Elegir tema">
            {filteredThemes.length === 0 && (
              <div className="theme-picker-empty" role="status">
                ningún tema coincide con «{filter.trim()}»
              </div>
            )}
            {filteredThemes.map((t, i) => {
              const showSep = firstLightInFiltered > 0 && i === firstLightInFiltered
              return (
                <React.Fragment key={t.id}>
                  {showSep && <div className="theme-picker-grid-break" aria-hidden="true" />}
                  <ThemeChip
                    theme={t}
                    isActive={t.id === currentThemeId}
                    isFocused={t.id === focusedId}
                    onSelect={() => applyThemeId(t.id)}
                    onHover={() => setFocusedId(t.id)}
                  />
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>
    </TerminalModal>
  )
}
