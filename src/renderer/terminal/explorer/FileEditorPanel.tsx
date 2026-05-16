import React, { useEffect, useState } from 'react'
import type { FileExplorerChangeKind } from '@shared/fileExplorerTypes'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { FileDiffView } from './FileDiffView'
import { FilePlainView } from './FilePlainView'

type EditorView = 'changes' | 'file'

interface FileEditorPanelProps {
  sessionId: string
  selectedPath: string | null
}

export const FileEditorPanel: React.FC<FileEditorPanelProps> = ({
  sessionId,
  selectedPath,
}) => {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [diff, setDiff] = useState('')
  const [changeKind, setChangeKind] = useState<FileExplorerChangeKind>('clean')
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<EditorView>('file')

  useEffect(() => {
    if (!selectedPath) {
      setContent('')
      setDiff('')
      setChangeKind('clean')
      setError(null)
      setView('file')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void window.api.fileExplorerLoadFile(sessionId, selectedPath).then(payload => {
      if (cancelled) return
      if (!payload.ok) {
        setError(payload.error ?? 'No se pudo cargar el archivo')
        setContent('')
        setDiff('')
        return
      }
      setContent(payload.content ?? '')
      setDiff(payload.diff ?? '')
      const kind = payload.changeKind ?? 'clean'
      setChangeKind(kind)
      const hasDiff = Boolean(payload.diff?.trim())
      setView(hasDiff || kind === 'deleted' ? 'changes' : 'file')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [sessionId, selectedPath])

  if (!selectedPath) {
    return (
      <div className="file-editor-panel file-editor-panel--empty">
        <p className="file-editor-panel__hint">Selecciona un archivo del árbol.</p>
      </div>
    )
  }

  const hasDiff = diff.trim().length > 0
  const showChanges = view === 'changes' && (hasDiff || changeKind === 'deleted')

  return (
    <div className="file-editor-panel">
      <div className="file-editor-panel__header">
        <code className="file-editor-panel__path" title={selectedPath}>
          {selectedPath}
        </code>
        {changeKind === 'untracked' && (
          <span className="file-editor-panel__badge">nuevo</span>
        )}
        {hasDiff && (
          <div className="file-editor-panel__tabs">
            <Button
              variant={showChanges ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('changes')}
            >
              Cambios
            </Button>
            <Button
              variant={!showChanges ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('file')}
            >
              Archivo
            </Button>
          </div>
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
        {!loading && !error && showChanges && (
          hasDiff ? (
            <FileDiffView diff={diff} />
          ) : (
            <p className="file-editor-panel__hint">Archivo eliminado (sin diff disponible).</p>
          )
        )}
        {!loading && !error && !showChanges && (
          <FilePlainView
            content={content}
            variant={changeKind === 'untracked' ? 'untracked' : 'default'}
          />
        )}
      </div>
    </div>
  )
}
