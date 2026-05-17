import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import { FileExplorerTree, type FileExplorerTreeHandle } from './FileExplorerTree'
import { FileEditorPanel } from './FileEditorPanel'
import { DEFAULT_FILE_EXPLORER_STATE } from '@shared/fileExplorerPersistedState'
import {
  type ExplorerSelectedEntry,
  expandedPathsKey,
  parentDirForCreate,
} from './explorerPathUtils'

type ExplorerDetailState = Pick<
  FileExplorerPersistedState,
  'selectedRelPath' | 'selectedIsDirectory' | 'expandedRelPaths'
>

interface FileExplorerSidebarProps {
  sessionId: string
  themeId: string
  explorerState: ExplorerDetailState
  onExplorerStateChange: (patch: Partial<ExplorerDetailState>) => void
  onToggleExplorer: () => void
}

export interface FileExplorerSidebarHandle {
  reloadTree: () => void
  resetTreeForNewCwd: () => void
  evictDirCache: (relPath: string) => void
}

export const FileExplorerSidebar = forwardRef<FileExplorerSidebarHandle, FileExplorerSidebarProps>(
  function FileExplorerSidebar(
    {
      sessionId,
      themeId,
      explorerState,
      onExplorerStateChange,
      onToggleExplorer,
    },
    ref,
  ) {
    const [isEditorDirty, setIsEditorDirty] = useState(false)
    const treeRef = useRef<FileExplorerTreeHandle>(null)
    const asideRef = useRef<HTMLElement>(null)
    const onToggleExplorerRef = useRef(onToggleExplorer)
    onToggleExplorerRef.current = onToggleExplorer

    const selectedEntry: ExplorerSelectedEntry | null = explorerState.selectedRelPath
      ? {
          relPath: explorerState.selectedRelPath,
          isDirectory: explorerState.selectedIsDirectory,
        }
      : null

    const openFilePath =
      selectedEntry && !selectedEntry.isDirectory ? selectedEntry.relPath : null

    const patchExplorer = useCallback(
      (patch: Partial<ExplorerDetailState>) => {
        onExplorerStateChange(patch)
      },
      [onExplorerStateChange],
    )

    const handleExpandedChange = useCallback(
      (paths: string[]) => {
        if (expandedPathsKey(paths) === expandedPathsKey(explorerState.expandedRelPaths)) {
          return
        }
        patchExplorer({ expandedRelPaths: paths })
      },
      [explorerState.expandedRelPaths, patchExplorer],
    )

    const setSelectedEntry = useCallback(
      (entry: ExplorerSelectedEntry | null) => {
        patchExplorer({
          selectedRelPath: entry?.relPath ?? null,
          selectedIsDirectory: entry?.isDirectory ?? false,
        })
      },
      [patchExplorer],
    )

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent): void => {
        if (e.type !== 'keydown') return
        if (!e.metaKey && !e.ctrlKey) return
        if (e.altKey) return
        const aside = asideRef.current
        if (!aside?.contains(document.activeElement)) return
        if ((e.key === 'e' || e.key === 'E') && !e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onToggleExplorerRef.current()
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [])

    const requestSelectEntry = useCallback(
      (relPath: string, isDirectory: boolean): boolean => {
        const same =
          selectedEntry?.relPath === relPath && selectedEntry.isDirectory === isDirectory
        if (same) return true
        const changingAwayFromDirtyFile =
          isEditorDirty && openFilePath && relPath !== openFilePath
        if (changingAwayFromDirtyFile && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) {
          return false
        }
        setSelectedEntry({ relPath, isDirectory })
        return true
      },
      [selectedEntry, isEditorDirty, openFilePath, setSelectedEntry],
    )

    const handleFileSaved = useCallback(() => {
      // Guardar contenido no cambia las entradas del directorio; no se recarga el árbol.
    }, [])

    const handleFileCreated = useCallback(
      (relPath: string) => {
        setSelectedEntry({ relPath, isDirectory: false })
        setIsEditorDirty(false)
      },
      [setSelectedEntry],
    )

    const handleCloseFile = useCallback(() => {
      if (!openFilePath) return
      if (
        isEditorDirty &&
        !window.confirm('Hay cambios sin guardar. ¿Cerrar el archivo sin guardar?')
      ) {
        return
      }
      const parent = parentDirForCreate(openFilePath)
      setSelectedEntry(parent ? { relPath: parent, isDirectory: true } : null)
      setIsEditorDirty(false)
    }, [openFilePath, isEditorDirty, setSelectedEntry])

    const handleEntryDeleted = useCallback(
      (relPath: string) => {
        const prefix = `${relPath}/`
        const filtered = explorerState.expandedRelPaths.filter(
          p => p !== relPath && !p.startsWith(prefix),
        )
        if (filtered.length !== explorerState.expandedRelPaths.length) {
          patchExplorer({ expandedRelPaths: filtered })
        }
        treeRef.current?.evictDirCache(relPath)

        if (openFilePath === relPath) {
          setIsEditorDirty(false)
          const parent = parentDirForCreate(relPath)
          setSelectedEntry(parent ? { relPath: parent, isDirectory: true } : null)
          return
        }
        if (selectedEntry?.relPath === relPath || selectedEntry?.relPath.startsWith(prefix)) {
          const parent = parentDirForCreate(relPath)
          setSelectedEntry(parent ? { relPath: parent, isDirectory: true } : null)
        }
      },
      [openFilePath, selectedEntry, setSelectedEntry, explorerState.expandedRelPaths, patchExplorer],
    )

    const handleEntryRenamed = useCallback(
      (oldRelPath: string, newRelPath: string, isDirectory: boolean) => {
        if (openFilePath === oldRelPath) {
          setSelectedEntry({ relPath: newRelPath, isDirectory: false })
        } else if (selectedEntry?.relPath === oldRelPath) {
          setSelectedEntry({ relPath: newRelPath, isDirectory })
        }
        const expanded = explorerState.expandedRelPaths.map(p =>
          p === oldRelPath ? newRelPath : p.startsWith(`${oldRelPath}/`)
            ? `${newRelPath}${p.slice(oldRelPath.length)}`
            : p,
        )
        if (expanded.some((p, i) => p !== explorerState.expandedRelPaths[i])) {
          patchExplorer({ expandedRelPaths: expanded })
        }
        if (isDirectory) {
          treeRef.current?.evictDirCache(oldRelPath)
        }
      },
      [openFilePath, selectedEntry, setSelectedEntry, explorerState.expandedRelPaths, patchExplorer],
    )

    const onSessionRootChange = useCallback(() => {
      setIsEditorDirty(false)
      patchExplorer({
        selectedRelPath: null,
        selectedIsDirectory: false,
        expandedRelPaths: DEFAULT_FILE_EXPLORER_STATE.expandedRelPaths,
      })
    }, [patchExplorer])

    useImperativeHandle(ref, () => ({
      reloadTree: () => { void treeRef.current?.reloadTree() },
      resetTreeForNewCwd: () => { void treeRef.current?.resetTreeForNewCwd() },
      evictDirCache: (relPath: string) => { treeRef.current?.evictDirCache(relPath) },
    }), [])

    return (
      <aside
        ref={asideRef}
        className={[
          'terminal-file-explorer',
          openFilePath ? 'terminal-file-explorer--with-file' : '',
        ].filter(Boolean).join(' ')}
        aria-label="Explorador de archivos"
      >
        <section className="terminal-file-explorer__tree" aria-label="Árbol de archivos">
          <FileExplorerTree
            ref={treeRef}
            sessionId={sessionId}
            selectedRelPath={selectedEntry?.relPath ?? null}
            selectedIsDirectory={selectedEntry?.isDirectory}
            expandedRelPaths={explorerState.expandedRelPaths}
            onExpandedChange={handleExpandedChange}
            onSelectEntry={requestSelectEntry}
            onFileCreated={handleFileCreated}
            onSessionRootChange={onSessionRootChange}
            onCloseExplorer={onToggleExplorer}
            onEntryDeleted={handleEntryDeleted}
            onEntryRenamed={handleEntryRenamed}
          />
        </section>
        {openFilePath && (
          <section className="terminal-file-explorer__editor" aria-label="Vista de archivo">
            <FileEditorPanel
              sessionId={sessionId}
              themeId={themeId}
              selectedPath={openFilePath}
              onFileSaved={handleFileSaved}
              onDirtyChange={setIsEditorDirty}
              onClose={handleCloseFile}
            />
          </section>
        )}
      </aside>
    )
  },
)
