import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import { Spinner } from '../components/ui/Spinner'
import { rankQuickOpenPaths, splitPathHighlight } from './quickOpenScore'
import './PaneToolbarQuickOpen.css'

const SEARCH_DEBOUNCE_MS = 180
const MAX_VISIBLE = 12

interface PaneToolbarQuickOpenProps {
  open: boolean
  sessionId: string
  onClose: () => void
  onPick: (relPath: string) => void
}

function PathHighlight({ path, query }: { path: string; query: string }): React.ReactElement {
  const segments = useMemo(() => splitPathHighlight(path, query), [path, query])
  return (
    <span className="pane-toolbar-quick-open__path">
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i}>{seg.text}</mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}

export const PaneToolbarQuickOpen: React.FC<PaneToolbarQuickOpenProps> = ({
  open,
  sessionId,
  onClose,
  onPick,
}) => {
  const { t } = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const [query, setQuery] = useState('')
  const [paths, setPaths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const visiblePaths = useMemo(
    () => rankQuickOpenPaths(paths, query).slice(0, MAX_VISIBLE),
    [paths, query],
  )

  const trimmed = query.trim()
  const showDropdown = trimmed.length > 0 && (loading || visiblePaths.length > 0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setPaths([])
    setLoading(false)
    setTruncated(false)
    setSelectedIndex(0)
    queueMicrotask(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setPaths([])
      setLoading(false)
      setTruncated(false)
      setSelectedIndex(0)
      return
    }

    let cancelled = false
    setLoading(true)
    const id = window.setTimeout(() => {
      void window.api.fileExplorerSearch(sessionId, q).then(result => {
        if (cancelled) return
        setPaths(result.ok ? result.paths : [])
        setTruncated(Boolean(result.ok && result.truncated))
        setLoading(false)
        setSelectedIndex(0)
      }).catch(() => {
        if (cancelled) return
        setPaths([])
        setTruncated(false)
        setLoading(false)
        setSelectedIndex(0)
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [open, query, sessionId])

  useEffect(() => {
    setSelectedIndex(i => Math.min(i, Math.max(0, visiblePaths.length - 1)))
  }, [visiblePaths.length])

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, visiblePaths])

  const pick = useCallback(
    (relPath: string) => {
      onPick(relPath)
    },
    [onPick],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      const accel = e.metaKey || e.ctrlKey
      if (accel && !e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(i => Math.min(visiblePaths.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(i => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        const fromInput = inputRef.current?.contains(e.target as Node)
        if (!fromInput && e.target !== inputRef.current) return
        e.preventDefault()
        e.stopPropagation()
        const path = visiblePaths[selectedIndex]
        if (path) pick(path)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose, pick, selectedIndex, visiblePaths])

  if (!open) return null

  const meta = (() => {
    if (loading && trimmed) {
      return <Spinner aria-label={t('quickOpen.searching')} />
    }
    if (trimmed && !loading && visiblePaths.length === 0) {
      return t('quickOpen.noMatches')
    }
    return null
  })()

  return (
    <div className="pane-toolbar-quick-open">
      <div className="pane-toolbar-quick-open__bar">
        <input
          ref={inputRef}
          type="text"
          className="pane-toolbar-quick-open__input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('quickOpen.placeholder')}
          aria-label={t('quickOpen.inputAria')}
          spellCheck={false}
          autoComplete="off"
          onMouseDown={e => e.stopPropagation()}
        />
        {meta && (
          <span className="pane-toolbar-quick-open__meta" aria-live="polite">
            {meta}
          </span>
        )}
      </div>

      {showDropdown && (
        <div className="pane-toolbar-quick-open__dropdown" role="listbox">
          {!loading && visiblePaths.map((relPath, index) => {
            const active = index === selectedIndex
            return (
              <button
                key={relPath}
                ref={active ? activeItemRef : undefined}
                type="button"
                role="option"
                aria-selected={active}
                className={[
                  'pane-toolbar-quick-open__item',
                  active ? 'pane-toolbar-quick-open__item--active' : '',
                ].filter(Boolean).join(' ')}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => pick(relPath)}
              >
                <PathHighlight path={relPath} query={query} />
              </button>
            )
          })}
          {!loading && truncated && visiblePaths.length > 0 && (
            <div className="pane-toolbar-quick-open__item pane-toolbar-quick-open__item--hint" aria-hidden>
              {t('quickOpen.truncated')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
