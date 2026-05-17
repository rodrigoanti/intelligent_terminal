import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { FileCodeEditor, type FileCodeEditorHandle } from './FileCodeEditor'

const SAVE_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘S'
    : 'Ctrl+S'

interface FileEditorPanelProps {
  sessionId: string
  themeId: string
  selectedPath: string | null
  onFileSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onClose?: () => void
}

export const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  sessionId,
  themeId,
  selectedPath,
  onFileSaved,
  onDirtyChange,
  onClose,
}) => {
  const [loading, setLoading] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const editorRef = useRef<FileCodeEditorHandle>(null)
  const findInputRef = useRef<HTMLInputElement>(null)

  const isDirty = draftContent !== savedContent
  const saveHint = useMemo(() => {
    if (saving) return 'Guardando…'
    return `Guardar · ${SAVE_SHORTCUT_LABEL}`
  }, [saving])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    setFindQuery('')
    setMatchCount(0)
  }, [selectedPath])

  const focusFindInput = useCallback(() => {
    findInputRef.current?.focus()
    findInputRef.current?.select()
  }, [])

  useEffect(() => {
    if (!selectedPath) {
      setDraftContent('')
      setSavedContent('')
      setError(null)
      setSaveError(null)
      return
    }

    let cancelled = false
    const doLoad = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setSaveError(null)
      try {
        const payload = await window.api.fileExplorerLoadFile(sessionId, selectedPath)
        if (cancelled) return
        if (!payload.ok) {
          setError(payload.error ?? 'No se pudo cargar el archivo')
          setDraftContent('')
          setSavedContent('')
          return
        }
        const text = payload.content ?? ''
        setDraftContent(text)
        setSavedContent(text)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void doLoad()

    return () => {
      cancelled = true
    }
  }, [sessionId, selectedPath])

  const handleSave = useCallback(async () => {
    if (!selectedPath || !isDirty || saving) return
    setSaving(true)
    setSaveError(null)
    const result = await window.api.fileExplorerSaveFile(sessionId, selectedPath, draftContent)
    setSaving(false)
    if (!result.ok) {
      setSaveError(result.error ?? 'No se pudo guardar el archivo')
      return
    }
    setSavedContent(draftContent)
    onFileSaved?.()
  }, [sessionId, selectedPath, draftContent, isDirty, saving, onFileSaved])

  if (!selectedPath) {
    return (
      <div className="file-editor-panel file-editor-panel--empty">
        <p className="file-editor-panel__hint">Selecciona un archivo del árbol.</p>
      </div>
    )
  }

  return (
    <div className="file-editor-panel">
      <div className="file-editor-panel__header">
        <code
          className={[
            'file-editor-panel__path',
            isDirty ? 'file-editor-panel__path--dirty' : '',
          ].filter(Boolean).join(' ')}
          title={selectedPath}
        >
          {selectedPath}
          {isDirty && (
            <span className="file-editor-panel__unsaved" title="Cambios sin guardar">
              {' '}•
            </span>
          )}
        </code>
        <span className="file-editor-panel__save-hint" title={`Atajo: ${SAVE_SHORTCUT_LABEL}`}>
          {saveHint}
        </span>
        {onClose && (
          <button
            type="button"
            className="file-explorer-tree__tool-btn file-explorer-tree__tool-btn--close"
            title="Cerrar archivo"
            aria-label="Cerrar visualizador de archivo"
            onClick={onClose}
          >
            <Icon name="close" size={9} aria-hidden />
          </button>
        )}
      </div>

      <div className="file-editor-panel__body">
        {loading && (
          <div className="file-editor-panel__loading">
            <Spinner aria-label="Cargando archivo" />
          </div>
        )}
        {!loading && error && (
          <p className="file-editor-panel__error" role="alert">{error}</p>
        )}
        {!loading && saveError && (
          <p className="file-editor-panel__error" role="alert">{saveError}</p>
        )}
        {!loading && !error && (
          <FileCodeEditor
            ref={editorRef}
            key={selectedPath}
            filePath={selectedPath}
            themeId={themeId}
            content={draftContent}
            findQuery={findQuery}
            onChange={setDraftContent}
            onSave={() => void handleSave()}
            onMatchCountChange={setMatchCount}
            onFindFocusRequest={focusFindInput}
          />
        )}
      </div>

      {!loading && !error && (
        <div className="file-editor-panel__search" role="search">
          <div className="file-editor-panel__search-field">
            <Input
              ref={findInputRef}
              type="text"
              size="sm"
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (e.shiftKey) {
                    editorRef.current?.findPrevious()
                  } else {
                    editorRef.current?.findNext()
                  }
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setFindQuery('')
                  e.currentTarget.blur()
                }
              }}
              placeholder="Buscar en el archivo…"
              aria-label="Buscar en el archivo"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          {findQuery.trim() !== '' && (
            <span className="file-editor-panel__search-meta" aria-live="polite">
              {matchCount === 0 ? 'Sin coincidencias' : `${matchCount} coincidencia${matchCount === 1 ? '' : 's'}`}
            </span>
          )}
          <button
            type="button"
            className="file-editor-panel__search-nav file-editor-panel__search-nav--up"
            title="Coincidencia anterior (Shift+Enter)"
            aria-label="Coincidencia anterior"
            disabled={!findQuery.trim() || matchCount === 0}
            onClick={() => editorRef.current?.findPrevious()}
          >
            <Icon name="chevron-down" size={10} aria-hidden />
          </button>
          <button
            type="button"
            className="file-editor-panel__search-nav"
            title="Siguiente coincidencia (Enter)"
            aria-label="Siguiente coincidencia"
            disabled={!findQuery.trim() || matchCount === 0}
            onClick={() => editorRef.current?.findNext()}
          >
            <Icon name="chevron-down" size={10} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
