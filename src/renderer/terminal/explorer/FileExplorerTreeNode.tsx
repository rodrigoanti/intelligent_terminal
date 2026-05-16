import React from 'react'
import type { FileExplorerChangeKind, FileExplorerEntry } from '@shared/fileExplorerTypes'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'

const GIT_STATUS_LABEL: Partial<Record<FileExplorerChangeKind, string>> = {
  modified: 'M',
  staged: 'A',
  untracked: 'U',
  deleted: 'D',
}

interface FileExplorerTreeNodeProps {
  entry: FileExplorerEntry
  depth: number
  expanded: boolean
  loading: boolean
  selected: boolean
  changeKind: FileExplorerChangeKind
  onToggleDir: (relPath: string) => void
  onSelectFile: (relPath: string) => void
}

export const FileExplorerTreeNode: React.FC<FileExplorerTreeNodeProps> = ({
  entry,
  depth,
  expanded,
  loading,
  selected,
  changeKind,
  onToggleDir,
  onSelectFile,
}) => {
  const isDir = entry.isDirectory
  const gitLabel = changeKind !== 'clean' ? GIT_STATUS_LABEL[changeKind] : undefined

  return (
    <button
      type="button"
      className={[
        'file-explorer-tree-node',
        selected ? 'file-explorer-tree-node--selected' : '',
        isDir ? 'file-explorer-tree-node--dir' : 'file-explorer-tree-node--file',
        changeKind !== 'clean' ? `file-explorer-tree-node--git-${changeKind}` : '',
      ].filter(Boolean).join(' ')}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
      onClick={() => {
        if (isDir) onToggleDir(entry.relPath)
        else onSelectFile(entry.relPath)
      }}
    >
      <span className="file-explorer-tree-node__chevron" aria-hidden>
        {isDir ? (
          loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={10} />
          )
        ) : (
          <span className="file-explorer-tree-node__chevron-spacer" />
        )}
      </span>
      <span className="file-explorer-tree-node__icon" aria-hidden>
        <Icon name={isDir ? 'folder' : 'files'} size={11} />
      </span>
      <span className="file-explorer-tree-node__name">{entry.name}</span>
      {gitLabel && (
        <span className="file-explorer-tree-node__git" aria-label={`git ${changeKind}`}>
          {gitLabel}
        </span>
      )}
    </button>
  )
}
