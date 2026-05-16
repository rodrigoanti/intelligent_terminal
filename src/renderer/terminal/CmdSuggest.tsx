import React from 'react'
import { Icon } from '../components/ui/Icon'

export interface CmdSnippet {
  label: string
  cmd: string
}

interface CmdSuggestHighlightParts {
  before: string
  match: string
  after: string
}

function splitHighlight(display: string, draft: string): CmdSuggestHighlightParts | null {
  const d = draft.trim()
  if (!d) return null
  const dl = d.toLowerCase()
  const fl = display.toLowerCase()
  let n = 0
  while (n < display.length && n < d.length && display[n].toLowerCase() === d[n].toLowerCase()) n++
  if (n > 0) return { before: '', match: display.slice(0, n), after: display.slice(n) }
  const i = fl.indexOf(dl)
  if (i >= 0) {
    const end = i + d.length
    return { before: display.slice(0, i), match: display.slice(i, end), after: display.slice(end) }
  }
  return null
}

interface CmdHighlightLabelProps {
  display: string
  draft: string
}

const CmdHighlightLabel: React.FC<CmdHighlightLabelProps> = ({ display, draft }) => {
  const parts = splitHighlight(display, draft)
  if (!parts) return <span className="cmd-suggest-label">{display}</span>
  const { before, match, after } = parts
  return (
    <span className="cmd-suggest-label">
      {before !== '' && <span className="cmd-suggest-label__rest">{before}</span>}
      <span className="cmd-suggest-label__typed">{match}</span>
      {after !== '' && <span className="cmd-suggest-label__rest">{after}</span>}
    </span>
  )
}

interface CmdSuggestProps {
  visibleRecentMatches: string[]
  visibleSnippets: CmdSnippet[]
  cmdSuggestCmd: string | null
  cmdSuggestDraft: string
  onPickRecent: (cmd: string) => void
  onPickSnippet: (cmd: string) => void
  onClearHistory: () => void
}

export const CmdSuggest: React.FC<CmdSuggestProps> = ({
  visibleRecentMatches,
  visibleSnippets,
  cmdSuggestCmd,
  cmdSuggestDraft,
  onPickRecent,
  onPickSnippet,
  onClearHistory,
}) => {
  const label =
    visibleRecentMatches.length > 0 && visibleSnippets.length > 0
      ? `Comandos recientes y sugerencias${cmdSuggestCmd ? ` (${cmdSuggestCmd})` : ''}`
      : visibleRecentMatches.length > 0
        ? 'Comandos recientes'
        : cmdSuggestCmd
          ? `Sugerencias para ${cmdSuggestCmd}`
          : 'Sugerencias'

  return (
    <div className="cmd-suggest" role="listbox" aria-label={label}>
      {visibleRecentMatches.length > 0 && (
        <div className={['cmd-suggest-recent-block', visibleSnippets.length > 0 ? 'cmd-suggest-recent-block--sep' : ''].filter(Boolean).join(' ')}>
          <div className="cmd-suggest-section-header">
            <div className="cmd-suggest-section-title cmd-suggest-section-title--in-header">recientes</div>
            <button
              type="button"
              className="cmd-suggest-clear-history-btn"
              title="Borrar la lista de comandos recientes de esta terminal"
              onMouseDown={e => { e.preventDefault(); onClearHistory() }}
            >
              Vaciar historial
            </button>
          </div>
          {visibleRecentMatches.map(cmd => (
            <CmdSuggestItem
              key={`recent:${cmd}`}
              display={cmd}
              draft={cmdSuggestDraft}
              onPick={() => onPickRecent(cmd)}
            />
          ))}
        </div>
      )}
      {visibleSnippets.length > 0 && (
        <div className="cmd-suggest-static-block">
          <div className="cmd-suggest-section-title">{cmdSuggestCmd}</div>
          {visibleSnippets.map(s => (
            <CmdSuggestItem
              key={s.cmd}
              display={s.label}
              draft={cmdSuggestDraft}
              onPick={() => onPickSnippet(s.cmd)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CmdSuggestItemProps {
  display: string
  draft: string
  onPick: () => void
}

const CmdSuggestItem: React.FC<CmdSuggestItemProps> = ({ display, draft, onPick }) => (
  <button
    type="button"
    className="cmd-suggest-item"
    onMouseDown={e => { e.preventDefault(); onPick() }}
    role="option"
    title="Escribir en la terminal (sin ejecutar)"
  >
    <span className="cmd-suggest-script-icon" aria-hidden="true">
      <Icon name="terminal" size={12} />
    </span>
    <CmdHighlightLabel display={display} draft={draft} />
  </button>
)
