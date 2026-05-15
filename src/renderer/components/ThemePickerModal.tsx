import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getTheme, getThemesForPicker, type AppTheme } from '@themes/presets'
import { TerminalModal } from './TerminalModal'
import './ThemePickerModal.css'

interface Props {
  open: boolean
  currentThemeId: string
  onSelectTheme: (themeId: string) => void
  onClose: () => void
}

function ThemePreview({
  theme,
  currentThemeId,
}: {
  theme: AppTheme
  currentThemeId: string
}): React.ReactElement {
  const v = theme.vars
  const xt = theme.xterm
  const bg = v['--bg'] ?? xt.background
  const fg = v['--text'] ?? xt.foreground
  const muted = v['--text-muted'] ?? xt.brightBlack
  const border = v['--border'] ?? xt.black
  const accent = v['--accent'] ?? xt.cursor
  const surface = v['--surface'] ?? xt.black
  const tabActive = v['--tab-active-bg'] ?? bg
  const tabInactive = v['--tab-inactive-bg'] ?? surface
  const active = theme.id === currentThemeId

  const tpVars = {
    '--tp-bg': bg,
    '--tp-border': border,
    '--tp-accent': accent,
    '--tp-surface': surface,
    '--tp-muted': muted,
    '--tp-fg': fg,
    '--tp-tab-active': tabActive,
    '--tp-tab-inactive': tabInactive,
    '--tp-xterm-bg': xt.background,
    '--tp-xterm-fg': xt.foreground,
  } as React.CSSProperties

  return (
    <div
      className="theme-picker-preview theme-picker-preview--terminal-app"
      style={{
        background: bg,
        borderColor: border,
        color: fg,
        ...tpVars,
      }}
    >
      <div className="theme-picker-tp-shell" aria-hidden="true">
        {/* Misma franja que .titlebar (arrastre / espacio para semáforos del SO) */}
        <div className="theme-picker-tp-titlebar" />
        {/* Misma fila que .tabbar + pestañas Shell N */}
        <div className="theme-picker-tp-tabbar">
          <div className="theme-picker-tp-tabs">
            <div className="theme-picker-tp-tab theme-picker-tp-tab--active">Shell 1</div>
            <div className="theme-picker-tp-tab">Shell 2</div>
          </div>
          <div className="theme-picker-tp-tab-add">+</div>
        </div>
        {/* Área xterm (fondo y texto de la paleta del tema) */}
        <div className="theme-picker-tp-term">
          <div className="theme-picker-tp-line">
            <span style={{ color: xt.cyan }}>user</span>
            <span style={{ color: muted }}>@</span>
            <span style={{ color: xt.green }}>host</span>
            <span style={{ color: muted }}>:</span>
            <span style={{ color: xt.blue }}>~/proyecto</span>
            <span style={{ color: accent }}>$ </span>
            <span style={{ color: xt.foreground }}>ls -la</span>
          </div>
          <div className="theme-picker-tp-line" style={{ color: xt.brightBlack }}>
            total 24
          </div>
          <div className="theme-picker-tp-line">
            <span style={{ color: xt.blue }}>drwxr-xr-x</span>
            <span style={{ color: xt.brightBlack }}>  5 user  staff  160 Jan  2 10:00 .</span>
          </div>
          <div className="theme-picker-tp-line">
            <span style={{ color: xt.cyan }}>user</span>
            <span style={{ color: muted }}>@</span>
            <span style={{ color: xt.green }}>host</span>
            <span style={{ color: muted }}>:</span>
            <span style={{ color: xt.blue }}>~/proyecto</span>
            <span style={{ color: accent }}>$ </span>
            <span className="theme-picker-tp-cursor">▌</span>
          </div>
        </div>
        {/* Barra colapsada del dock IA (misma idea que .ai-dock-collapsed-bar) */}
        <div className="theme-picker-tp-ai-dock">
          <span className="theme-picker-tp-ai-hash" style={{ color: accent }}>#</span>
          <span className="theme-picker-tp-ai-label">ia</span>
          <span className="theme-picker-tp-ai-model">local</span>
          <span className="theme-picker-tp-ai-hint" style={{ color: accent }}>▲</span>
        </div>
      </div>
      <div
        className="theme-picker-preview-meta"
        style={{ borderTopColor: border, background: surface }}
      >
        <span className="theme-picker-preview-name" style={{ color: fg }}>{theme.name}</span>
        {active && <span className="theme-picker-preview-active" style={{ color: accent }}>*</span>}
      </div>
    </div>
  )
}

function themeMatchesQuery(theme: AppTheme, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const name = theme.name.toLowerCase()
  const id = theme.id.toLowerCase()
  return name.includes(s) || id.includes(s)
}

export const ThemePickerModal: React.FC<Props> = ({
  open,
  currentThemeId,
  onSelectTheme,
  onClose,
}) => {
  const pickerThemes = useMemo(() => getThemesForPicker(), [])
  const [filter, setFilter] = useState('')
  const filteredThemes = useMemo(() => {
    return pickerThemes.filter(t => themeMatchesQuery(t, filter))
  }, [pickerThemes, filter])

  const firstLightInFiltered = useMemo(
    () => filteredThemes.findIndex(t => t.appearance === 'light'),
    [filteredThemes],
  )

  const [focusedId, setFocusedId] = useState(currentThemeId)

  useEffect(() => {
    if (open) {
      setFocusedId(currentThemeId)
      setFilter('')
    }
  }, [open, currentThemeId])

  useEffect(() => {
    if (!open) return
    if (filteredThemes.some(t => t.id === focusedId)) return
    const preferred = filteredThemes.find(t => t.id === currentThemeId)?.id
      ?? filteredThemes[0]?.id
    if (preferred) setFocusedId(preferred)
  }, [open, filteredThemes, focusedId, currentThemeId])

  const focusedTheme = useMemo(() => getTheme(focusedId), [focusedId])

  const applyThemeId = useCallback((id: string) => {
    onSelectTheme(id)
  }, [onSelectTheme])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target
      if (el instanceof HTMLElement && el.closest('.theme-picker-filter')) {
        return
      }
      if (e.key === 'Enter' && focusedId && filteredThemes.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        applyThemeId(focusedId)
        return
      }
      if (e.key === 'ArrowRight' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? -1 : i
        const next = (from + 1 + filteredThemes.length) % filteredThemes.length
        setFocusedId(filteredThemes[next].id)
      }
      if (e.key === 'ArrowLeft' && filteredThemes.length > 0) {
        e.preventDefault()
        const i = filteredThemes.findIndex(t => t.id === focusedId)
        const from = i < 0 ? 0 : i
        const prev = (from - 1 + filteredThemes.length) % filteredThemes.length
        setFocusedId(filteredThemes[prev].id)
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
          <input
            type="search"
            className="theme-picker-filter"
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
              const active = t.id === currentThemeId
              const focused = t.id === focusedId
              const showSep = firstLightInFiltered > 0 && i === firstLightInFiltered
              const bg = t.vars['--bg'] ?? t.xterm.background
              const accent = t.vars['--accent'] ?? t.xterm.cursor
              return (
                <React.Fragment key={t.id}>
                  {showSep && <div className="theme-picker-grid-break" aria-hidden="true" />}
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
                    <span className="theme-picker-chip-palette" aria-hidden="true">
                      <span className="theme-picker-chip-swatch-bg" style={{ background: bg }} />
                      <span className="theme-picker-chip-swatch-accent" style={{ background: accent }} />
                    </span>
                    <span className="theme-picker-chip-name">{t.name}</span>
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
