import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TerminalModal } from './TerminalModal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { TerminalBufferFindMatch } from '@renderer/terminal/terminalFindInBuffer'
import './TerminalFindModal.css'

interface Props {
  open: boolean
  onClose: () => void
  bufferMatches: TerminalBufferFindMatch[]
  historyMatches: string[]
  onSearch: (query: string) => void
  onGoToBufferMatch: (m: TerminalBufferFindMatch) => void
  onApplyHistoryLine: (line: string) => void
}

function MatchLinePreview({ text, col, len }: { text: string; col: number; len: number }): React.ReactElement {
  const a = text.slice(0, col)
  const b = text.slice(col, col + len)
  const c = text.slice(col + len)
  return (
    <span className="terminal-find-preview">
      {a}
      <mark className="terminal-find-mark">{b}</mark>
      {c}
    </span>
  )
}

export const TerminalFindModal: React.FC<Props> = ({
  open,
  onClose,
  bufferMatches,
  historyMatches,
  onSearch,
  onGoToBufferMatch,
  onApplyHistoryLine,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHasSearched(false)
    queueMicrotask(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open])

  const submit = useCallback((): void => {
    const t = query.trim()
    if (!t) return
    setHasSearched(true)
    onSearch(query)
  }, [onSearch, query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.target === inputRef.current || inputRef.current?.contains(e.target as Node))) {
        e.preventDefault()
        e.stopPropagation()
        submit()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, submit])

  const total = bufferMatches.length + historyMatches.length
  const noMatchesAfterSearch = hasSearched && total === 0

  return (
    <TerminalModal
      open={open}
      onClose={onClose}
      title="buscar en terminal"
      titleId="terminal-find-title"
      size="lg"
      zIndex={680}
      footer={
        <>
          <span className="terminal-find-footer-note">
            {hasSearched ? `${bufferMatches.length} en buffer · ${historyMatches.length} en historial` : '⌘F / Ctrl+F'}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            cerrar
          </Button>
        </>
      }
    >
      <p className="terminal-find-intro" id="terminal-find-desc">
        ¿Qué quieres buscar?
      </p>
      <div className="terminal-find-field">
        <label className="terminal-find-label" htmlFor="terminal-find-input">
          texto (salida, scrollback e historial de comandos de esta terminal)
        </label>
        <div className="terminal-find-input-row">
          <Input
            ref={inputRef}
            id="terminal-find-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ej. npm error, ruta, comando…"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="terminal-find-desc"
          />
          <Button variant="primary" size="sm" onClick={submit}>
            buscar
          </Button>
        </div>
      </div>
      <p className="terminal-find-hint">
        {!hasSearched ? 'Escribe un texto y pulsa buscar. ' : null}
        No distingue mayúsculas. Pulsa Enter o «buscar».
      </p>

      {noMatchesAfterSearch && <p className="terminal-find-empty">Sin coincidencias.</p>}

      {bufferMatches.length > 0 && (
        <section className="terminal-find-section" aria-label="Coincidencias en la salida">
          <h3 className="terminal-find-section-title">
            salida y scrollback ({bufferMatches.length})
          </h3>
          <div className="terminal-find-list" role="list">
            {bufferMatches.map((m, i) => (
              <button
                key={`buf-${m.lineIndex}-${m.col}-${i}`}
                type="button"
                className="terminal-find-item"
                role="listitem"
                onClick={() => onGoToBufferMatch(m)}
              >
                <span className="terminal-find-item-meta">
                  línea {m.lineIndex + 1} · columna {m.col + 1}
                </span>
                <MatchLinePreview text={m.lineText} col={m.col} len={m.matchLen} />
              </button>
            ))}
          </div>
        </section>
      )}

      {historyMatches.length > 0 && (
        <section className="terminal-find-section" aria-label="Coincidencias en historial">
          <h3 className="terminal-find-section-title">
            historial de comandos ({historyMatches.length})
          </h3>
          <div className="terminal-find-list" role="list">
            {historyMatches.map((line, i) => (
              <button
                key={`hist-${i}-${line.slice(0, 40)}`}
                type="button"
                className="terminal-find-item"
                role="listitem"
                title="Escribir en la terminal (sin ejecutar)"
                onClick={() => onApplyHistoryLine(line)}
              >
                <span className="terminal-find-item-meta">comando guardado</span>
                <span className="terminal-find-preview">{line}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </TerminalModal>
  )
}
