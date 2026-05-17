import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { Icon } from '../../components/ui/Icon'
import {
  FileExplorerContextMenu,
  type FileExplorerContextMenuTarget,
} from './FileExplorerContextMenu'
import { FileExplorerTreeNode } from './FileExplorerTreeNode'
import {
  buildNewRelPath,
  expandedPathsKey,
  normalizeSessionCwd,
  parentDirForCreate,
  parentRelPath,
  pasteDestRelPath,
  type ExplorerSelectedEntry,
} from './explorerPathUtils'

interface FileExplorerTreeProps {
  sessionId: string
  selectedRelPath: string | null
  selectedIsDirectory?: boolean
  expandedRelPaths: string[]
  onExpandedChange: (paths: string[]) => void
  onSelectEntry: (relPath: string, isDirectory: boolean) => boolean
  onFileCreated?: (relPath: string) => void
  /** cwd de la sesión cambió o se recargó la raíz del árbol */
  onSessionRootChange?: () => void
  onCloseExplorer?: () => void
  onEntryDeleted?: (relPath: string) => void
  onEntryRenamed?: (oldRelPath: string, newRelPath: string, isDirectory: boolean) => void
}

export interface FileExplorerTreeHandle {
  refreshDir: (relPath: string) => Promise<void>
  /** Recarga el árbol sin borrar selección ni carpetas expandidas. */
  reloadTree: () => Promise<void>
  /** cwd de la sesión cambió: reinicia selección/expandidas y recarga la raíz. */
  resetTreeForNewCwd: () => Promise<void>
  /** Elimina del caché las entradas bajo relPath (usado tras rename/delete de carpetas). */
  evictDirCache: (relPath: string) => void
}

type CreateMode = 'file' | 'dir' | null

function sortEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export const FileExplorerTree = forwardRef<FileExplorerTreeHandle, FileExplorerTreeProps>(
  function FileExplorerTree(
    {
      sessionId,
      selectedRelPath,
      selectedIsDirectory,
      expandedRelPaths,
      onExpandedChange,
      onSelectEntry,
      onFileCreated,
      onSessionRootChange,
      onCloseExplorer,
      onEntryDeleted,
      onEntryRenamed,
    },
    ref,
  ) {
    const expandedSet = useMemo(() => new Set(expandedRelPaths), [expandedRelPaths])
    const [childrenByDir, setChildrenByDir] = useState<Map<string, FileExplorerEntry[]>>(
      () => new Map(),
    )
    const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set())
    const [createMode, setCreateMode] = useState<CreateMode>(null)
    const [createName, setCreateName] = useState('')
    const [createError, setCreateError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [rootError, setRootError] = useState<string | null>(null)
    const [contextMenu, setContextMenu] = useState<{
      x: number
      y: number
      target: FileExplorerContextMenuTarget | null
    } | null>(null)
    const [renamingEntry, setRenamingEntry] = useState<FileExplorerContextMenuTarget | null>(null)
    const [renameName, setRenameName] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)

    const createParentPath = parentDirForCreate(selectedRelPath, selectedIsDirectory)

    const selectedEntry: ExplorerSelectedEntry | null = selectedRelPath
      ? { relPath: selectedRelPath, isDirectory: Boolean(selectedIsDirectory) }
      : null

    const closeContextMenu = useCallback(() => {
      setContextMenu(null)
    }, [])

    const loadDir = useCallback(
      async (relPath: string): Promise<void> => {
        setLoadingDirs(prev => new Set(prev).add(relPath))
        try {
          const result = await window.api.fileExplorerListDir(sessionId, relPath)
          if (relPath === '') {
            setRootError(result.ok ? null : (result.error ?? 'No se pudo listar la carpeta'))
          }
          setChildrenByDir(prev => {
            const next = new Map(prev)
            next.set(relPath, result.ok ? sortEntries(result.entries) : [])
            return next
          })
        } finally {
          setLoadingDirs(prev => {
            const next = new Set(prev)
            next.delete(relPath)
            return next
          })
        }
      },
      [sessionId],
    )

    const expandedKey = useMemo(
      () => expandedPathsKey(expandedRelPaths),
      [expandedRelPaths],
    )
    const loadedExpandedKeyRef = useRef<string | null>(null)
    const loadedSessionRef = useRef<string | null>(null)
    /** Timestamp del último resetTreeForNewCwd manual; el polling lo usa para evitar doble recarga. */
    const lastManualResetAtRef = useRef<number>(0)

    const reloadExpandedDirs = useCallback(async (): Promise<void> => {
      const expanded = expandedRelPaths.filter(Boolean)
      loadedExpandedKeyRef.current = expandedPathsKey(expandedRelPaths)
      await Promise.all(expanded.map(rel => loadDir(rel)))
    }, [expandedRelPaths, loadDir])

    const reloadTree = useCallback(async (): Promise<void> => {
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      await loadDir('')
      await reloadExpandedDirs()
    }, [loadDir, reloadExpandedDirs])

    const resetTreeForNewCwd = useCallback(async (): Promise<void> => {
      lastManualResetAtRef.current = Date.now()
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      onSessionRootChange?.()
      await loadDir('')
    }, [loadDir, onSessionRootChange])

    const evictDirCache = useCallback((relPath: string): void => {
      const prefix = `${relPath}/`
      setChildrenByDir(prev => {
        const next = new Map(prev)
        for (const key of next.keys()) {
          if (key === relPath || key.startsWith(prefix)) next.delete(key)
        }
        return next
      })
    }, [])

    useImperativeHandle(ref, () => ({
      refreshDir: loadDir,
      reloadTree,
      resetTreeForNewCwd,
      evictDirCache,
    }), [loadDir, reloadTree, resetTreeForNewCwd, evictDirCache])

    useEffect(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setChildrenByDir(new Map())
      loadedExpandedKeyRef.current = null
      loadedSessionRef.current = sessionId
      void loadDir('')
    }, [sessionId, loadDir])

    useEffect(() => {
      if (loadedSessionRef.current !== sessionId) return
      if (loadedExpandedKeyRef.current === expandedKey) return
      loadedExpandedKeyRef.current = expandedKey
      if (!expandedKey) return
      for (const rel of expandedKey.split('\0')) {
        void loadDir(rel)
      }
    }, [expandedKey, loadDir, sessionId])

    useEffect(() => {
      let lastCwd = ''
      const MANUAL_RESET_DEBOUNCE_MS = 3000
      const syncCwd = async (): Promise<void> => {
        const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
        if (!cwd) return
        if (lastCwd === '') {
          lastCwd = cwd
          return
        }
        if (cwd === lastCwd) return
        lastCwd = cwd
        // Saltar si ya se hizo un reset manual recientemente (e.g. desde TerminalPane tras cd)
        if (Date.now() - lastManualResetAtRef.current < MANUAL_RESET_DEBOUNCE_MS) return
        await resetTreeForNewCwd()
      }
      void syncCwd()
      const id = window.setInterval(() => {
        void syncCwd()
      }, 1500)
      return () => window.clearInterval(id)
    }, [sessionId, resetTreeForNewCwd])

    const toggleDir = useCallback(
      (relPath: string): void => {
        const next = new Set(expandedRelPaths)
        if (next.has(relPath)) {
          next.delete(relPath)
        } else {
          next.add(relPath)
          if (!childrenByDir.has(relPath)) {
            void loadDir(relPath)
          }
        }
        const paths = Array.from(next)
        if (expandedPathsKey(paths) !== expandedPathsKey(expandedRelPaths)) {
          onExpandedChange(paths)
        }
      },
      [expandedRelPaths, childrenByDir, loadDir, onExpandedChange],
    )

    const expandParents = useCallback(
      (relPath: string) => {
        const parts = relPath.split('/').filter(Boolean)
        const next = new Set(expandedRelPaths)
        next.add('')
        if (parts.length > 1) {
          let acc = ''
          for (let i = 0; i < parts.length - 1; i++) {
            acc = acc ? `${acc}/${parts[i]}` : parts[i]!
            next.add(acc)
          }
        }
        const paths = Array.from(next)
        if (expandedPathsKey(paths) !== expandedPathsKey(expandedRelPaths)) {
          onExpandedChange(paths)
        }
        for (const p of next) {
          if (p && !childrenByDir.has(p)) void loadDir(p)
        }
      },
      [expandedRelPaths, onExpandedChange, childrenByDir, loadDir],
    )

    const submitCreate = useCallback(async () => {
      if (!createMode) return
      const relPath = buildNewRelPath(createName, createParentPath)
      if (!relPath) {
        setCreateError('Nombre de ruta inválido')
        return
      }
      setCreating(true)
      setCreateError(null)
      const result =
        createMode === 'file'
          ? await window.api.fileExplorerCreateFile(sessionId, relPath)
          : await window.api.fileExplorerCreateDir(sessionId, relPath)
      setCreating(false)
      if (!result.ok) {
        setCreateError(result.error ?? 'No se pudo crear')
        return
      }
      const parent = createParentPath
      expandParents(relPath)
      await loadDir(parent)
      await loadDir('')
      setCreateMode(null)
      setCreateName('')
      if (createMode === 'file') {
        onFileCreated?.(relPath)
        onSelectEntry(relPath, false)
      } else {
        onSelectEntry(relPath, true)
      }
    }, [
      createMode,
      createName,
      createParentPath,
      sessionId,
      expandParents,
      loadDir,
      onFileCreated,
      onSelectEntry,
    ])

    const cancelCreate = useCallback(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
    }, [])

    const refreshAfterMutation = useCallback(
      async (parentRel: string) => {
        await loadDir(parentRel)
        await loadDir('')
      },
      [loadDir],
    )

    const openContextMenu = useCallback(
      (e: React.MouseEvent, target: FileExplorerContextMenuTarget | null) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY, target })
      },
      [],
    )

    const onTreeContextMenu = useCallback(
      (e: React.MouseEvent) => {
        const node = (e.target as HTMLElement).closest(
          '.file-explorer-tree-node[data-rel-path]',
        ) as HTMLElement | null
        if (node?.dataset.relPath) {
          const relPath = node.dataset.relPath
          const isDirectory = node.dataset.isDirectory === 'true'
          onSelectEntry(relPath, isDirectory)
          openContextMenu(e, {
            relPath,
            isDirectory,
            name: node.dataset.name ?? '',
          })
          return
        }
        openContextMenu(e, null)
      },
      [openContextMenu, onSelectEntry],
    )

    const copyTextToClipboard = useCallback((text: string): void => {
      void navigator.clipboard.writeText(text).catch(() => {})
    }, [])

    const handleCopy = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void window.api.fileExplorerCopy(sessionId, [target.relPath]).then(result => {
        if (!result.ok) setRootError(result.error ?? 'No se pudo copiar')
      })
    }, [contextMenu, closeContextMenu, sessionId])

    const handleCopyName = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void copyTextToClipboard(target.name)
    }, [contextMenu, closeContextMenu, copyTextToClipboard])

    const handleCopyRelPath = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void copyTextToClipboard(target.relPath)
    }, [contextMenu, closeContextMenu, copyTextToClipboard])

    const handlePaste = useCallback(() => {
      const menuTarget = contextMenu?.target
      closeContextMenu()
      const destEntry: ExplorerSelectedEntry | null = menuTarget ?? selectedEntry
      const dest = pasteDestRelPath(destEntry)
      void window.api.fileExplorerPaste(sessionId, dest).then(result => {
        if (!result.ok) {
          setRootError(result.error ?? 'No se pudo pegar')
          return
        }
        void reloadTree()
      })
    }, [contextMenu, closeContextMenu, selectedEntry, sessionId, reloadTree])

    const startRename = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      setRenamingEntry(target)
      setRenameName(target.name)
      setRenameError(null)
    }, [contextMenu, closeContextMenu])

    const cancelRename = useCallback(() => {
      setRenamingEntry(null)
      setRenameName('')
      setRenameError(null)
    }, [])

    const submitRename = useCallback(async () => {
      if (!renamingEntry) return
      const parent = parentRelPath(renamingEntry.relPath)
      const newRel = buildNewRelPath(renameName, parent)
      if (!newRel) {
        setRenameError('Nombre inválido')
        return
      }
      if (newRel === renamingEntry.relPath) {
        cancelRename()
        return
      }
      const result = await window.api.fileExplorerRename(
        sessionId,
        renamingEntry.relPath,
        newRel,
      )
      if (!result.ok) {
        setRenameError(result.error ?? 'No se pudo renombrar')
        return
      }
      const oldRel = renamingEntry.relPath
      const isDirectory = renamingEntry.isDirectory
      cancelRename()
      await refreshAfterMutation(parent)
      onEntryRenamed?.(oldRel, newRel, isDirectory)
    }, [
      renamingEntry,
      renameName,
      sessionId,
      cancelRename,
      refreshAfterMutation,
      onEntryRenamed,
    ])

    const handleDelete = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      const label = target.isDirectory ? 'carpeta' : 'archivo'
      if (!window.confirm(`¿Eliminar ${label} «${target.name}»?`)) return
      void window.api.fileExplorerDelete(sessionId, target.relPath).then(async result => {
        if (!result.ok) return
        const parent = parentRelPath(target.relPath)
        await refreshAfterMutation(parent)
        onEntryDeleted?.(target.relPath)
      })
    }, [
      contextMenu,
      closeContextMenu,
      sessionId,
      refreshAfterMutation,
      onEntryDeleted,
    ])

    const visibleRows = useMemo(() => {
      const rows: Array<{
        entry: FileExplorerEntry
        depth: number
        expanded: boolean
        loading: boolean
      }> = []

      const walk = (dirPath: string, depth: number): void => {
        const kids = childrenByDir.get(dirPath) ?? []
        for (const entry of kids) {
          const isExp = entry.isDirectory && expandedSet.has(entry.relPath)
          rows.push({
            entry,
            depth,
            expanded: isExp,
            loading: loadingDirs.has(entry.relPath),
          })
          if (isExp) {
            walk(entry.relPath, depth + 1)
          }
        }
      }

      walk('', 0)
      return rows
    }, [childrenByDir, expandedSet, loadingDirs])

    return (
      <div className="file-explorer-tree-wrap">
        <div className="file-explorer-tree__toolbar">
          <button
            type="button"
            className="file-explorer-tree__tool-btn"
            title="Nuevo archivo"
            aria-label="Nuevo archivo"
            onClick={() => {
              setCreateMode('file')
              setCreateName('')
              setCreateError(null)
            }}
          >
            <Icon name="plus" size={11} aria-hidden />
          </button>
          <button
            type="button"
            className="file-explorer-tree__tool-btn"
            title="Nueva carpeta"
            aria-label="Nueva carpeta"
            onClick={() => {
              setCreateMode('dir')
              setCreateName('')
              setCreateError(null)
            }}
          >
            <Icon name="folder" size={11} aria-hidden />
          </button>
          {onCloseExplorer && (
            <button
              type="button"
              className="file-explorer-tree__tool-btn file-explorer-tree__tool-btn--close"
              title="Cerrar explorador (⌘E)"
              aria-label="Cerrar explorador"
              onClick={onCloseExplorer}
            >
              <Icon name="close" size={9} aria-hidden />
            </button>
          )}
        </div>

        {createMode && (
          <form
            className="file-explorer-tree__create"
            onSubmit={e => {
              e.preventDefault()
              void submitCreate()
            }}
          >
            <span className="file-explorer-tree__create-label">
              {createMode === 'file' ? 'Archivo' : 'Carpeta'}
              {createParentPath ? ` en ${createParentPath}/` : ' en raíz'}
            </span>
            <input
              type="text"
              className="file-explorer-tree__create-input"
              value={createName}
              placeholder={createMode === 'file' ? 'nombre.ts' : 'carpeta'}
              autoFocus
              disabled={creating}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelCreate()
                }
              }}
            />
            <div className="file-explorer-tree__create-actions">
              <button type="submit" className="file-explorer-tree__create-submit" disabled={creating}>
                Crear
              </button>
              <button
                type="button"
                className="file-explorer-tree__create-cancel"
                disabled={creating}
                onClick={cancelCreate}
              >
                Cancelar
              </button>
            </div>
            {createError && (
              <p className="file-explorer-tree__create-error" role="alert">{createError}</p>
            )}
          </form>
        )}

        <div
          className="file-explorer-tree"
          role="tree"
          onContextMenu={onTreeContextMenu}
        >
          {rootError && !loadingDirs.has('') && (
            <p className="file-explorer-tree__empty file-explorer-tree__empty--error" role="alert">
              {rootError}
            </p>
          )}
          {!rootError && visibleRows.length === 0 && !loadingDirs.has('') && !createMode && (
            <p className="file-explorer-tree__empty">Carpeta vacía</p>
          )}
          {visibleRows.map(row => (
            <FileExplorerTreeNode
              key={row.entry.relPath}
              entry={row.entry}
              depth={row.depth}
              expanded={row.expanded}
              loading={row.loading}
              selected={
                selectedRelPath === row.entry.relPath &&
                Boolean(selectedIsDirectory) === row.entry.isDirectory
              }
              isRenaming={renamingEntry?.relPath === row.entry.relPath}
              renameValue={renameName}
              onRenameChange={setRenameName}
              onRenameSubmit={() => void submitRename()}
              onRenameCancel={cancelRename}
              onToggleDir={toggleDir}
              onSelectEntry={onSelectEntry}
            />
          ))}
          {renameError && (
            <p className="file-explorer-tree__create-error" role="alert">{renameError}</p>
          )}
        </div>

        {contextMenu && (
          <FileExplorerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            target={contextMenu.target}
            onCopy={handleCopy}
            onCopyName={handleCopyName}
            onCopyRelPath={handleCopyRelPath}
            onPaste={handlePaste}
            onRename={startRename}
            onDelete={handleDelete}
            onClose={closeContextMenu}
          />
        )}
      </div>
    )
  },
)