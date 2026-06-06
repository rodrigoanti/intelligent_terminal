import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'

export interface FileExplorerContextMenuTarget {
  relPath: string
  isDirectory: boolean
  name: string
}

interface FileExplorerContextMenuProps {
  x: number
  y: number
  target: FileExplorerContextMenuTarget | null
  selectionCount: number
  showHiddenDirs: boolean
  openOnSingleClick: boolean
  onCopy: () => void
  onCut: () => void
  onCopyName: () => void
  onCopyRelPath: () => void
  onPaste: () => void
  onRename: () => void
  onDelete: () => void
  onRevealInFinder: () => void
  onNewFile: () => void
  onNewDir: () => void
  onRefresh: () => void
  onToggleHiddenDirs: () => void
  onToggleOpenOnSingleClick: () => void
  onClose: () => void
}

export const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  target,
  selectionCount,
  showHiddenDirs,
  openOnSingleClick,
  onCopy,
  onCut,
  onCopyName,
  onCopyRelPath,
  onPaste,
  onRename,
  onDelete,
  onRevealInFinder,
  onNewFile,
  onNewDir,
  onRefresh,
  onToggleHiddenDirs,
  onToggleOpenOnSingleClick,
  onClose,
}) => {
  const { t } = useT()
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return
      if (menuRef.current?.contains(e.target as Node)) return
      onCloseRef.current()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('mousedown', onMouseDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [])

  const menuLeft = Math.min(x, Math.max(8, window.innerWidth - 168))
  const menuTop = Math.min(y, Math.max(8, window.innerHeight - 320))
  const multi = selectionCount > 1
  const canCreateHere = !target || target.isDirectory

  return createPortal(
    <div
      ref={menuRef}
      className="file-explorer-context-menu"
      role="menu"
      style={{ '--menu-x': `${menuLeft}px`, '--menu-y': `${menuTop}px` } as React.CSSProperties}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
    >
      {canCreateHere && (
        <>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onNewFile}>
            {t('fileExplorer.contextMenu.newFileHere')}
          </button>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onNewDir}>
            {t('fileExplorer.contextMenu.newDirHere')}
          </button>
          <div className="file-explorer-context-menu__sep" role="separator" />
        </>
      )}
      {target ? (
        <>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopy}>
            {multi ? t('fileExplorer.contextMenu.copyMany', { count: selectionCount }) : t('fileExplorer.contextMenu.copy')}
          </button>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCut}>
            {multi ? t('fileExplorer.contextMenu.cutMany', { count: selectionCount }) : t('fileExplorer.contextMenu.cut')}
          </button>
          {!multi && (
            <>
              <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopyName}>
                {t('fileExplorer.contextMenu.copyName')}
              </button>
              <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopyRelPath}>
                {t('fileExplorer.contextMenu.copyPath')}
              </button>
            </>
          )}
          {!multi && (
            <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onRename}>
              {t('fileExplorer.contextMenu.rename')}
            </button>
          )}
          <button
            type="button"
            className="file-explorer-context-menu__item file-explorer-context-menu__item--danger"
            role="menuitem"
            onClick={onDelete}
          >
            {multi
              ? t('fileExplorer.contextMenu.deleteMany', { count: selectionCount })
              : t('fileExplorer.contextMenu.delete')}
          </button>
          {!multi && (
            <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onRevealInFinder}>
              {t('fileExplorer.contextMenu.revealInFinder')}
            </button>
          )}
          <div className="file-explorer-context-menu__sep" role="separator" />
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onPaste}>
            {t('fileExplorer.contextMenu.paste')}
          </button>
        </>
      ) : (
        <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onPaste}>
          {t('fileExplorer.contextMenu.paste')}
        </button>
      )}
      <div className="file-explorer-context-menu__sep" role="separator" />
      <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onRefresh}>
        {t('fileExplorer.contextMenu.refresh')}
      </button>
      <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onToggleHiddenDirs}>
        {showHiddenDirs
          ? t('fileExplorer.contextMenu.toggleHiddenDirsOff')
          : t('fileExplorer.contextMenu.toggleHiddenDirsOn')}
      </button>
      <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onToggleOpenOnSingleClick}>
        {openOnSingleClick
          ? t('fileExplorer.contextMenu.openOnDoubleClick')
          : t('fileExplorer.contextMenu.openOnSingleClick')}
      </button>
    </div>,
    document.body,
  )
}
