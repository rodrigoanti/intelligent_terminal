import React, { useEffect, useState } from 'react'
import { FileExplorerTree } from './FileExplorerTree'
import { FileEditorPanel } from './FileEditorPanel'

interface FileExplorerSidebarProps {
  sessionId: string
  onClose: () => void
}

export const FileExplorerSidebar: React.FC<FileExplorerSidebarProps> = ({
  sessionId,
  onClose,
}) => {
  const [rootLabel, setRootLabel] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getSessionCwd(sessionId).then(cwd => {
      const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean)
      setRootLabel(parts[parts.length - 1] ?? cwd ?? 'proyecto')
    })
  }, [sessionId])

  return (
    <aside className="terminal-file-explorer" aria-label="Explorador de archivos">
      <header className="terminal-file-explorer__header">
        <span className="terminal-file-explorer__title" title={rootLabel}>
          {rootLabel || '…'}
        </span>
        <button
          type="button"
          className="terminal-file-explorer__close terminal-chrome-btn"
          title="Cerrar explorador (⌘E)"
          aria-label="Cerrar explorador"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="terminal-file-explorer__tree-wrap">
        <FileExplorerTree
          sessionId={sessionId}
          selectedPath={selectedPath}
          onSelectFile={setSelectedPath}
        />
      </div>
      <FileEditorPanel sessionId={sessionId} selectedPath={selectedPath} />
    </aside>
  )
}
