import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import { useT } from '@i18n/useT'
import { FileExplorerTree, type FileExplorerTreeHandle } from './FileExplorerTree'
import { FileEditorPanel } from './FileEditorPanel'
import { ExplorerConfirmHost } from './ExplorerConfirmHost'
import { DEFAULT_FILE_EXPLORER_STATE } from '@shared/fileExplorerPersistedState'
import {
  type ExplorerSelectedEntry,
  expandedPathsKey,
  parentDirForCreate,
  remapChildRelPath,
} from './explorerPathUtils'
import { useExplorerResize } from './useExplorerResize'

type ExplorerDetailState = Pick<
  FileExplorerPersistedState,
  | 'selectedRelPath'
  | 'selectedIsDirectory'
  | 'expandedRelPaths'
  | 'showHiddenDirs'
  | 'treeWidthPercent'
  | 'openOnSingleClick'
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
  resetTreeForNewCwd: () => Promise<void>
  evictDirCache: (relPath: string) => void
  expandParents: (relPath: string) => void
  selectEntry: (relPath: string, isDirectory: boolean) => void
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
    const { t } = useT()
    const [isEditorDirty, setIsEditorDirty] = useState(false)
    const [fsReloadToken, setFsReloadToken] = useState(0)
    const treeRef = useRef<FileExplorerTreeHandle>(null)
    const asideRef = useRef<HTMLElement>(null)
    const onToggleExplorerRef = useRef(onToggleExplorer)
    onToggleExplorerRef.current = onToggleExplorer
    const requestConfirmRef = useRef<((req: import('./ExplorerConfirmHost').ExplorerConfirmRequest) => Promise<boolean>) | null>(null)

    const { treeWidthPercent, onResizePointerDown } = useExplorerResize(
      explorerState.treeWidthPercent,
      percent => onExplorerStateChange({ treeWidthPercent: percent }),
    )

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
        if (!e.metaKey && !e.ctrlKey) return
        if (e.altKey) return
        const aside = asideRef.current
        if (!aside?.contains(document.activeElement) && document.activeElement !== aside) {
          const inExplorer = (document.activeElement as HTMLElement | null)?.closest('.terminal-file-explorer')
          if (!inExplorer) return
        }
        if ((e.key === 'e' || e.key === 'E') && !e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onToggleExplorerRef.current()
        }
        if ((e.key === 'r' || e.key === 'R') && !e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          void treeRef.current?.reloadTree()
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [])

    const requestSelectEntry = useCallback(
      async (relPath: string, isDirectory: boolean): Promise<boolean> => {
        const same =
          selectedEntry?.relPath === relPath && selectedEntry.isDirectory === isDirectory
        if (same) return true
        const changingAwayFromDirtyFile =
          isEditorDirty && openFilePath && relPath !== openFilePath
        if (changingAwayFromDirtyFile && requestConfirmRef.current) {
          const ok = await requestConfirmRef.current({ type: 'discardChanges', onConfirm: () => {} })
          if (!ok) return false
        }
        setSelectedEntry({ relPath, isDirectory })
        return true
      },
      [selectedEntry, isEditorDirty, openFilePath, setSelectedEntry],
    )

    const handleFileSaved = useCallback(() => {
      void treeRef.current?.refreshGitStatus()
    }, [])

    useEffect(() => {
      const unsub = window.api.onFileExplorerFsChanged(sessionId, dirs => {
        if (!openFilePath) return
        const parent = parentDirForCreate(openFilePath)
        const affected = dirs.some(
          d => d === '' || d === parent || openFilePath === d || openFilePath.startsWith(`${d}/`),
        )
        if (affected) setFsReloadToken(t => t + 1)
      })
      return unsub
    }, [sessionId, openFilePath])

    const handleFileCreated = useCallback(
      (relPath: string) => {
        setSelectedEntry({ relPath, isDirectory: false })
        setIsEditorDirty(false)
      },
      [setSelectedEntry],
    )

    const handleCloseFile = useCallback(async () => {
      if (!openFilePath) return
      if (isEditorDirty && requestConfirmRef.current) {
        const ok = await requestConfirmRef.current({ type: 'closeDirtyFile', onConfirm: () => {} })
        if (!ok) return
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

        if (openFilePath === relPath || openFilePath?.startsWith(prefix)) {
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
        if (openFilePath) {
          const remapped = remapChildRelPath(openFilePath, oldRelPath, newRelPath)
          if (remapped !== null) {
            setSelectedEntry({ relPath: remapped, isDirectory: false })
          }
        } else if (selectedEntry?.relPath) {
          const remapped = remapChildRelPath(selectedEntry.relPath, oldRelPath, newRelPath)
          if (remapped !== null) {
            setSelectedEntry({
              relPath: remapped,
              isDirectory: remapped === newRelPath ? isDirectory : selectedEntry.isDirectory,
            })
          }
        }
        const expanded = explorerState.expandedRelPaths.map(p => {
          const remapped = remapChildRelPath(p, oldRelPath, newRelPath)
          return remapped ?? p
        })
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
      resetTreeForNewCwd: async () => { await treeRef.current?.resetTreeForNewCwd() },
      evictDirCache: (relPath: string) => { treeRef.current?.evictDirCache(relPath) },
      expandParents: (relPath: string) => { treeRef.current?.expandParents(relPath) },
      selectEntry: (relPath: string, isDirectory: boolean) => {
        setSelectedEntry({ relPath, isDirectory })
      },
    }), [setSelectedEntry])

    const treeStyle = {
      '--explorer-tree-width': `${treeWidthPercent}%`,
    } as React.CSSProperties

    return (
      <ExplorerConfirmHost>
        {requestConfirm => {
          requestConfirmRef.current = requestConfirm
          return (
            <aside
              ref={asideRef}
              className={[
                'terminal-file-explorer',
                openFilePath ? 'terminal-file-explorer--with-file' : '',
              ].filter(Boolean).join(' ')}
              style={treeStyle}
              aria-label={t('fileExplorer.ariaLabel')}
            >
              <section
                className="terminal-file-explorer__tree"
                aria-label={t('fileExplorer.treeAriaLabel')}
                style={{ flexBasis: openFilePath ? `${treeWidthPercent}%` : undefined }}
              >
                <FileExplorerTree
                  ref={treeRef}
                  sessionId={sessionId}
                  selectedRelPath={selectedEntry?.relPath ?? null}
                  selectedIsDirectory={selectedEntry?.isDirectory}
                  expandedRelPaths={explorerState.expandedRelPaths}
                  showHiddenDirs={explorerState.showHiddenDirs}
                  openOnSingleClick={explorerState.openOnSingleClick}
                  onExpandedChange={handleExpandedChange}
                  onShowHiddenDirsChange={show => patchExplorer({ showHiddenDirs: show })}
                  onOpenOnSingleClickChange={value => patchExplorer({ openOnSingleClick: value })}
                  onSelectEntry={(relPath, isDirectory) => requestSelectEntry(relPath, isDirectory)}
                  onRequestConfirm={requestConfirm}
                  onFileCreated={handleFileCreated}
                  onSessionRootChange={onSessionRootChange}
                  onCloseExplorer={onToggleExplorer}
                  onEntryDeleted={handleEntryDeleted}
                  onEntryRenamed={handleEntryRenamed}
                />
              </section>
              {openFilePath && (
                <>
                  <div
                    className="terminal-file-explorer__resize-handle"
                    role="separator"
                    aria-orientation="vertical"
                    onPointerDown={onResizePointerDown}
                  />
                  <section
                    className="terminal-file-explorer__editor"
                    aria-label={t('fileExplorer.editorAriaLabel')}
                    style={{ flexBasis: `${100 - treeWidthPercent}%` }}
                  >
                    <FileEditorPanel
                      sessionId={sessionId}
                      themeId={themeId}
                      selectedPath={openFilePath}
                      fsReloadToken={fsReloadToken}
                      onFileSaved={handleFileSaved}
                      onDirtyChange={setIsEditorDirty}
                      onClose={() => { void handleCloseFile() }}
                    />
                  </section>
                </>
              )}
            </aside>
          )
        }}
      </ExplorerConfirmHost>
    )
  },
)
