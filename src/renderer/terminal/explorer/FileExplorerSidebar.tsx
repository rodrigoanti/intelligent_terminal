import React, { useState } from 'react'
import { FileExplorerTree } from './FileExplorerTree'
import { FileEditorPanel } from './FileEditorPanel'

interface FileExplorerSidebarProps {
  sessionId: string
}

export const FileExplorerSidebar: React.FC<FileExplorerSidebarProps> = ({
  sessionId,
}) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <aside className="terminal-file-explorer" aria-label="Explorador de archivos">
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
