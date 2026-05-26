import React, { useRef } from 'react'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { Icon } from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Spinner'
import { FileExplorerEntryIcon } from './FileExplorerEntryIcon'
import type { ExplorerGitStatus } from './fileExplorerGitStatus'

interface FileExplorerTreeNodeProps {
  entry: FileExplorerEntry
  depth: number
  expanded: boolean
  loading: boolean
  selected: boolean
  gitStatus?: ExplorerGitStatus | null
  isRenaming: boolean
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onToggleDir: (relPath: string) => void
  onSelectEntry: (relPath: string, isDirectory: boolean) => boolean
}

export const FileExplorerTreeNode: React.FC<FileExplorerTreeNodeProps> = ({
  entry,
  depth,
  expanded,
  loading,
  selected,
  gitStatus = null,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onToggleDir,
  onSelectEntry,
}) => {
  const isDir = entry.isDirectory
  const escapePressedRef = useRef(false)
  const depthStyle = { '--node-depth': depth } as React.CSSProperties

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (isRenaming) return
    if (!onSelectEntry(entry.relPath, isDir)) return
    if (isDir) {
      onToggleDir(entry.relPath)
    }
    e.currentTarget.blur()
  }

  if (isRenaming) {
    return (
      <form
        className="file-explorer-tree-node file-explorer-tree-node--renaming"
        style={depthStyle}
        onSubmit={e => {
          e.preventDefault()
          onRenameSubmit()
        }}
        onContextMenu={e => e.preventDefault()}
      >
        <span className="file-explorer-tree-node__chevron" aria-hidden>
          {isDir ? (
            loading ? (
              <Spinner aria-label="Cargando" />
            ) : (
              <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={8} />
            )
          ) : (
            <span className="file-explorer-tree-node__chevron-spacer" />
          )}
        </span>
        <input
          type="text"
          className="file-explorer-tree-node__rename-input"
          value={renameValue}
          autoFocus
          onChange={e => onRenameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault()
              escapePressedRef.current = true
              onRenameCancel()
            }
          }}
          onBlur={() => {
            if (escapePressedRef.current) {
              escapePressedRef.current = false
              return
            }
            onRenameSubmit()
          }}
        />
      </form>
    )
  }

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={selected}
      className={[
        'file-explorer-tree-node',
        selected ? 'file-explorer-tree-node--selected' : '',
        isDir ? 'file-explorer-tree-node--dir' : 'file-explorer-tree-node--file',
      ].filter(Boolean).join(' ')}
      style={depthStyle}
      data-rel-path={entry.relPath}
      data-is-directory={isDir ? 'true' : 'false'}
      data-name={entry.name}
      onClick={handleClick}
    >
      <span className="file-explorer-tree-node__chevron" aria-hidden>
        {isDir ? (
          loading ? (
            <Spinner aria-label="Cargando" />
          ) : (
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={8} />
          )
        ) : (
          <span className="file-explorer-tree-node__chevron-spacer" />
        )}
      </span>
      <span className="file-explorer-tree-node__icon" aria-hidden>
        <FileExplorerEntryIcon name={entry.name} isDirectory={isDir} expanded={expanded} />
      </span>
      <span
        className={[
          'file-explorer-tree-node__name',
          gitStatus === 'new' ? 'file-explorer-tree-node__name--git-new' : '',
          gitStatus === 'modified' ? 'file-explorer-tree-node__name--git-modified' : '',
        ].filter(Boolean).join(' ')}
      >
        {entry.name}
      </span>
    </button>
  )
}
