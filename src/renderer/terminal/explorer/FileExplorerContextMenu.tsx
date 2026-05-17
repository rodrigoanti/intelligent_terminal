import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface FileExplorerContextMenuTarget {
  relPath: string
  isDirectory: boolean
  name: string
}

interface FileExplorerContextMenuProps {
  x: number
  y: number
  target: FileExplorerContextMenuTarget | null
  onCopy: () => void
  onCopyName: () => void
  onCopyRelPath: () => void
  onPaste: () => void
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

export const FileExplorerContextMenu: React.FC<FileExplorerContextMenuProps> = ({
  x,
  y,
  target,
  onCopy,
  onCopyName,
  onCopyRelPath,
  onPaste,
  onRename,
  onDelete,
  onClose,
}) => {
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

  const menuLeft = Math.min(
    x,
    Math.max(8, window.innerWidth - 168),
  )
  const menuTop = Math.min(
    y,
    Math.max(8, window.innerHeight - 220),
  )

  return createPortal(
    <div
      ref={menuRef}
      className="file-explorer-context-menu"
      role="menu"
      style={{ '--menu-x': `${menuLeft}px`, '--menu-y': `${menuTop}px` } as React.CSSProperties}
      onContextMenu={e => e.preventDefault()}
      onMouseDown={e => e.stopPropagation()}
    >
      {target ? (
        <>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopy}>
            Copiar
          </button>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopyName}>
            Copiar nombre
          </button>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onCopyRelPath}>
            Copiar ruta relativa
          </button>
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onRename}>
            Cambiar nombre
          </button>
          <button
            type="button"
            className="file-explorer-context-menu__item file-explorer-context-menu__item--danger"
            role="menuitem"
            onClick={onDelete}
          >
            Eliminar
          </button>
          <div className="file-explorer-context-menu__sep" role="separator" />
          <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onPaste}>
            Pegar
          </button>
        </>
      ) : (
        <button type="button" className="file-explorer-context-menu__item" role="menuitem" onClick={onPaste}>
          Pegar
        </button>
      )}
    </div>,
    document.body,
  )
}
