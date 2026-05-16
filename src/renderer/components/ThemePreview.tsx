import React from 'react'
import type { AppTheme } from '@themes/presets'

interface ThemePreviewProps {
  theme: AppTheme
  currentThemeId: string
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, currentThemeId }) => {
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
    '--tp-bg': bg, '--tp-border': border, '--tp-accent': accent, '--tp-surface': surface,
    '--tp-muted': muted, '--tp-fg': fg, '--tp-tab-active': tabActive, '--tp-tab-inactive': tabInactive,
    '--tp-xterm-bg': xt.background, '--tp-xterm-fg': xt.foreground,
  } as React.CSSProperties

  return (
    <div
      className="theme-picker-preview theme-picker-preview--terminal-app"
      style={{ background: bg, borderColor: border, color: fg, ...tpVars }}
    >
      <div className="theme-picker-tp-shell" aria-hidden="true">
        <div className="theme-picker-tp-titlebar" />
        <div className="theme-picker-tp-tabbar">
          <div className="theme-picker-tp-tabs">
            <div className="theme-picker-tp-tab theme-picker-tp-tab--active">Shell 1</div>
            <div className="theme-picker-tp-tab">Shell 2</div>
          </div>
          <div className="theme-picker-tp-tab-add">+</div>
        </div>
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
          <div className="theme-picker-tp-line" style={{ color: xt.brightBlack }}>total 24</div>
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
        <div className="theme-picker-tp-ai-dock">
          <span className="theme-picker-tp-ai-hash" style={{ color: accent }}>#</span>
          <span className="theme-picker-tp-ai-label">ia</span>
          <span className="theme-picker-tp-ai-model">local</span>
          <span className="theme-picker-tp-ai-hint" style={{ color: accent }}>▲</span>
        </div>
      </div>
      <div className="theme-picker-preview-meta" style={{ borderTopColor: border, background: surface }}>
        <span className="theme-picker-preview-name" style={{ color: fg }}>{theme.name}</span>
        {active && <span className="theme-picker-preview-active" style={{ color: accent }}>*</span>}
      </div>
    </div>
  )
}
