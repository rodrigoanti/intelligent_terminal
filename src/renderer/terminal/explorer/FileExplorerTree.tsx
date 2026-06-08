import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { FILE_EXPLORER_ERROR_CODES } from '@shared/fileExplorerErrorCodes'
import { useT } from '@i18n/useT'
import { shortcutLabel } from '@i18n/modKeyLabel'
import { Icon } from '../../components/ui/Icon'
import {
  FileExplorerContextMenu,
  type FileExplorerContextMenuTarget,
} from './FileExplorerContextMenu'
import { FileExplorerNewMenu } from './FileExplorerNewMenu'
import { FileExplorerTreeNode } from './FileExplorerTreeNode'
import { ExplorerToast } from './ExplorerToast'
import type { ExplorerConfirmRequest } from './ExplorerConfirmHost'
import {
  buildNewRelPath,
  expandedPathsKey,
  isRelPathInside,
  normalizeSessionCwd,
  parentDirForCreate,
  parentRelPath,
  pasteDestRelPath,
  relPathFromCwd,
  sessionCwdPaneLabel,
  type ExplorerSelectedEntry,
} from './explorerPathUtils'
import {
  buildGitStatusMap,
  gitStatusFromMap,
  type ExplorerGitStatus,
} from './fileExplorerGitStatus'
import { fileExplorerErrorMessage } from './fileExplorerErrorI18n'

interface FileExplorerTreeProps {
  sessionId: string
  selectedRelPath: string | null
  selectedIsDirectory?: boolean
  expandedRelPaths: string[]
  showHiddenDirs: boolean
  openOnSingleClick: boolean
  onExpandedChange: (paths: string[]) => void
  onShowHiddenDirsChange: (show: boolean) => void
  onOpenOnSingleClickChange?: (value: boolean) => void
  onSelectEntry: (relPath: string, isDirectory: boolean, e?: React.MouseEvent) => boolean | Promise<boolean>
  onRequestConfirm?: (req: ExplorerConfirmRequest) => Promise<boolean>
  onFileCreated?: (relPath: string) => void
  onSessionRootChange?: () => void
  onCloseExplorer?: () => void
  onEntryDeleted?: (relPath: string) => void
  onEntryRenamed?: (oldRelPath: string, newRelPath: string, isDirectory: boolean) => void
}

export interface FileExplorerTreeHandle {
  refreshDir: (relPath: string) => Promise<void>
  reloadTree: () => Promise<void>
  resetTreeForNewCwd: () => Promise<void>
  evictDirCache: (relPath: string) => void
  expandParents: (relPath: string) => void
  refreshGitStatus: () => Promise<void>
}

type CreateMode = 'file' | 'dir' | null

const VIRTUAL_THRESHOLD = 200
const ROW_HEIGHT = 18

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
      showHiddenDirs,
      openOnSingleClick,
      onExpandedChange,
      onShowHiddenDirsChange,
      onOpenOnSingleClickChange,
      onSelectEntry,
      onRequestConfirm,
      onFileCreated,
      onSessionRootChange,
      onCloseExplorer,
      onEntryDeleted,
      onEntryRenamed,
    },
    ref,
  ) {
    const { t } = useT()
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
    const [filterQuery, setFilterQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const [globalSearchPaths, setGlobalSearchPaths] = useState<string[]>([])
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null)
    const [createParentOverride, setCreateParentOverride] = useState<string | null>(null)
    const [multiSelected, setMultiSelected] = useState<Set<string>>(() => new Set())
    const [lastClickedPath, setLastClickedPath] = useState<string | null>(null)
    const [focusedRowIndex, setFocusedRowIndex] = useState(0)
    const [treeRootCwd, setTreeRootCwd] = useState('')
    const [contextMenu, setContextMenu] = useState<{
      x: number
      y: number
      target: FileExplorerContextMenuTarget | null
    } | null>(null)
    const [renamingEntry, setRenamingEntry] = useState<FileExplorerContextMenuTarget | null>(null)
    const [renameName, setRenameName] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)
    const [gitStatusByPath, setGitStatusByPath] = useState<Map<string, ExplorerGitStatus>>(
      () => new Map(),
    )
    const treeScrollRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const dragRelPathRef = useRef<string | null>(null)

    const createParentPath = createParentOverride ?? parentDirForCreate(selectedRelPath, selectedIsDirectory)

    const selectedEntry: ExplorerSelectedEntry | null = selectedRelPath
      ? { relPath: selectedRelPath, isDirectory: Boolean(selectedIsDirectory) }
      : null

    const closeContextMenu = useCallback(() => {
      setContextMenu(null)
    }, [])

    const showToast = useCallback((error?: string, code?: Parameters<typeof fileExplorerErrorMessage>[2]) => {
      setToastMessage(fileExplorerErrorMessage(t, error, code))
    }, [t])

    const dismissToast = useCallback(() => {
      setToastMessage(null)
    }, [])

    const startCreate = useCallback((mode: CreateMode, parentOverride: string | null = null) => {
      setCreateParentOverride(parentOverride)
      setCreateMode(mode)
      setCreateName('')
      setCreateError(null)
      setNewMenu(null)
      closeContextMenu()
    }, [closeContextMenu])

    const refreshGitStatus = useCallback(async (): Promise<void> => {
      try {
        const status = await window.api.gitStatus(sessionId)
        setGitStatusByPath(buildGitStatusMap(status))
      } catch {
        setGitStatusByPath(new Map())
      }
    }, [sessionId])

    const loadDir = useCallback(
      async (relPath: string): Promise<void> => {
        setLoadingDirs(prev => new Set(prev).add(relPath))
        try {
          const result = await window.api.fileExplorerListDir(sessionId, relPath, showHiddenDirs)
          if (relPath === '') {
            setRootError(result.ok ? null : fileExplorerErrorMessage(t, result.error, result.code))
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
      [sessionId, showHiddenDirs, t],
    )

    const expandedKey = useMemo(() => expandedPathsKey(expandedRelPaths), [expandedRelPaths])
    const loadedExpandedKeyRef = useRef<string | null>(null)
    const loadedSessionRef = useRef<string | null>(null)
    const lastManualResetAtRef = useRef<number>(0)

    const reloadExpandedDirs = useCallback(async (): Promise<void> => {
      loadedExpandedKeyRef.current = expandedPathsKey(expandedRelPaths)
      await Promise.all(expandedRelPaths.filter(Boolean).map(rel => loadDir(rel)))
    }, [expandedRelPaths, loadDir])

    const reloadTree = useCallback(async (): Promise<void> => {
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      await loadDir('')
      await reloadExpandedDirs()
      await refreshGitStatus()
    }, [loadDir, reloadExpandedDirs, refreshGitStatus])

    const resetTreeForNewCwd = useCallback(async (): Promise<void> => {
      lastManualResetAtRef.current = Date.now()
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      setMultiSelected(new Set())
      const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
      setTreeRootCwd(cwd)
      onSessionRootChange?.()
      window.api.fileExplorerWatchStart(sessionId)
      await loadDir('')
    }, [loadDir, onSessionRootChange, sessionId])

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

    const expandParents = useCallback(
      (relPath: string) => {
        const parts = relPath.split('/').filter(Boolean)
        const next = new Set(expandedRelPaths)
        next.add('')
        if (parts.length > 1) {
          let acc = ''
          for (let i = 0; i < parts.length - 1; i++) {
            acc = acc ? `${acc}/${parts[i]!}` : parts[i]!
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

    useImperativeHandle(ref, () => ({
      refreshDir: loadDir,
      reloadTree,
      resetTreeForNewCwd,
      evictDirCache,
      expandParents,
      refreshGitStatus,
    }), [loadDir, reloadTree, resetTreeForNewCwd, evictDirCache, expandParents, refreshGitStatus])

    useEffect(() => {
      void refreshGitStatus()
      const unsubGit = window.api.onGitStatusChanged(sessionId, () => { void refreshGitStatus() })
      return () => unsubGit()
    }, [refreshGitStatus, sessionId])

    useEffect(() => {
      window.api.fileExplorerWatchStart(sessionId)
      const unsub = window.api.onFileExplorerFsChanged(sessionId, dirs => {
        const unique = Array.from(new Set(dirs))
        void Promise.all(unique.map(d => loadDir(d)))
        void loadDir('')
        void refreshGitStatus()
      })
      return () => {
        unsub()
        window.api.fileExplorerWatchStop(sessionId)
      }
    }, [sessionId, loadDir, refreshGitStatus])

    useEffect(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setChildrenByDir(new Map())
      loadedExpandedKeyRef.current = null
      loadedSessionRef.current = sessionId
      void window.api.getSessionCwd(sessionId).then(cwd => {
        setTreeRootCwd(normalizeSessionCwd(cwd))
      })
      void loadDir('')
    }, [sessionId, loadDir])

    useEffect(() => {
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      void (async () => {
        await loadDir('')
        await reloadExpandedDirs()
      })()
    }, [showHiddenDirs, loadDir, reloadExpandedDirs])

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
          setTreeRootCwd(cwd)
          return
        }
        if (cwd === lastCwd) return
        lastCwd = cwd
        setTreeRootCwd(cwd)
        if (Date.now() - lastManualResetAtRef.current < MANUAL_RESET_DEBOUNCE_MS) return
        await resetTreeForNewCwd()
      }
      void syncCwd()
      const id = window.setInterval(() => { void syncCwd() }, 3000)
      return () => window.clearInterval(id)
    }, [sessionId, resetTreeForNewCwd])

    const toggleDir = useCallback(
      (relPath: string): void => {
        const next = new Set(expandedRelPaths)
        if (next.has(relPath)) {
          next.delete(relPath)
        } else {
          next.add(relPath)
          if (!childrenByDir.has(relPath)) void loadDir(relPath)
        }
        const paths = Array.from(next)
        if (expandedPathsKey(paths) !== expandedPathsKey(expandedRelPaths)) {
          onExpandedChange(paths)
        }
      },
      [expandedRelPaths, childrenByDir, loadDir, onExpandedChange],
    )

    const getSelectedRelPaths = useCallback((): string[] => {
      if (multiSelected.size > 0) return Array.from(multiSelected)
      if (contextMenu?.target) return [contextMenu.target.relPath]
      if (selectedRelPath) return [selectedRelPath]
      return []
    }, [multiSelected, contextMenu, selectedRelPath])

    const handleSelectEntry = useCallback(
      async (relPath: string, isDirectory: boolean, e?: React.MouseEvent): Promise<void> => {
        const accel = e?.metaKey || e?.ctrlKey
        const range = e?.shiftKey

        if (accel) {
          setMultiSelected(prev => {
            const next = new Set(prev)
            if (next.has(relPath)) next.delete(relPath)
            else next.add(relPath)
            return next
          })
          setLastClickedPath(relPath)
          return
        }

        if (range && lastClickedPath) {
          const idxA = visibleRowsRef.current.findIndex(r => r.entry.relPath === lastClickedPath)
          const idxB = visibleRowsRef.current.findIndex(r => r.entry.relPath === relPath)
          if (idxA >= 0 && idxB >= 0) {
            const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA]
            const rangePaths = visibleRowsRef.current.slice(lo, hi + 1).map(r => r.entry.relPath)
            setMultiSelected(new Set(rangePaths))
          }
          return
        }

        setMultiSelected(new Set())
        setLastClickedPath(relPath)

        if (!openOnSingleClick && !isDirectory) return

        const ok = await onSelectEntry(relPath, isDirectory, e)
        if (!ok) return
      },
      [lastClickedPath, onSelectEntry, openOnSingleClick],
    )

    const handleDoubleClickEntry = useCallback(
      (relPath: string, isDirectory: boolean): void => {
        if (isDirectory) {
          toggleDir(relPath)
          return
        }
        if (!openOnSingleClick) {
          void onSelectEntry(relPath, false)
        }
      },
      [toggleDir, onSelectEntry, openOnSingleClick],
    )

    const submitCreate = useCallback(async () => {
      if (!createMode) return
      const relPath = buildNewRelPath(createName, createParentPath)
      if (!relPath) {
        setCreateError(t('fileExplorer.create.invalidName'))
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
        setCreateError(fileExplorerErrorMessage(t, result.error, result.code))
        return
      }
      const parent = createParentPath
      expandParents(relPath)
      await loadDir(parent)
      await loadDir('')
      setCreateMode(null)
      setCreateName('')
      setCreateParentOverride(null)
      if (createMode === 'file') {
        onFileCreated?.(relPath)
        await onSelectEntry(relPath, false)
      } else {
        await onSelectEntry(relPath, true)
      }
      await refreshGitStatus()
    }, [
      createMode, createName, createParentPath, sessionId, expandParents, loadDir,
      onFileCreated, onSelectEntry, refreshGitStatus, t,
    ])

    const cancelCreate = useCallback(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setCreateParentOverride(null)
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
          openContextMenu(e, {
            relPath: node.dataset.relPath,
            isDirectory: node.dataset.isDirectory === 'true',
            name: node.dataset.name ?? '',
          })
          return
        }
        openContextMenu(e, null)
      },
      [openContextMenu],
    )

    const copyTextToClipboard = useCallback((text: string): void => {
      void navigator.clipboard.writeText(text).catch(() => {})
    }, [])

    const handleCopy = useCallback(() => {
      const paths = getSelectedRelPaths()
      closeContextMenu()
      if (paths.length === 0) return
      void window.api.fileExplorerCopy(sessionId, paths).then(result => {
        if (!result.ok) showToast(result.error, result.code)
      })
    }, [getSelectedRelPaths, closeContextMenu, sessionId, showToast])

    const handleCut = useCallback(() => {
      const paths = getSelectedRelPaths()
      closeContextMenu()
      if (paths.length === 0) return
      void window.api.fileExplorerCut(sessionId, paths).then(result => {
        if (!result.ok) showToast(result.error, result.code)
      })
    }, [getSelectedRelPaths, closeContextMenu, sessionId, showToast])

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
          showToast(result.error, result.code)
          return
        }
        void reloadTree()
      })
    }, [contextMenu, closeContextMenu, selectedEntry, sessionId, reloadTree, showToast])

    const startRename = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target || multiSelected.size > 1) return
      setRenamingEntry(target)
      setRenameName(target.name)
      setRenameError(null)
    }, [contextMenu, closeContextMenu, multiSelected.size])

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
        setRenameError(t('fileExplorer.rename.invalidName'))
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
        setRenameError(fileExplorerErrorMessage(t, result.error, result.code))
        return
      }
      const oldRel = renamingEntry.relPath
      const isDirectory = renamingEntry.isDirectory
      cancelRename()
      await refreshAfterMutation(parent)
      onEntryRenamed?.(oldRel, newRel, isDirectory)
      await refreshGitStatus()
    }, [
      renamingEntry, renameName, sessionId, cancelRename, refreshAfterMutation,
      onEntryRenamed, refreshGitStatus, t,
    ])

    const performDelete = useCallback(async (paths: string[]): Promise<void> => {
      for (const relPath of paths) {
        const result = await window.api.fileExplorerDelete(sessionId, relPath)
        if (!result.ok) {
          showToast(result.error, result.code)
          return
        }
        const parent = parentRelPath(relPath)
        await refreshAfterMutation(parent)
        onEntryDeleted?.(relPath)
      }
      setMultiSelected(new Set())
      await refreshGitStatus()
    }, [sessionId, refreshAfterMutation, onEntryDeleted, refreshGitStatus, showToast])

    const handleDelete = useCallback(() => {
      const paths = getSelectedRelPaths()
      const target = contextMenu?.target
      closeContextMenu()
      if (paths.length === 0) return

      const runDelete = (): void => { void performDelete(paths) }

      if (onRequestConfirm) {
        const message = paths.length > 1
          ? t('fileExplorer.confirm.deleteMany', { count: paths.length })
          : target?.isDirectory
            ? t('fileExplorer.confirm.deleteDir', { name: target.name })
            : t('fileExplorer.confirm.deleteFile', { name: target?.name ?? paths[0] })
        void onRequestConfirm({ type: 'delete', message, onConfirm: runDelete })
        return
      }
      runDelete()
    }, [getSelectedRelPaths, contextMenu, closeContextMenu, onRequestConfirm, performDelete, t])

    const handleRevealTerminalCwd = useCallback(async () => {
      const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
      const rel = relPathFromCwd(treeRootCwd, cwd)
      if (rel === null) return
      if (rel) expandParents(rel)
      void onSelectEntry(rel, true)
    }, [sessionId, treeRootCwd, expandParents, onSelectEntry])

    const handleRevealInFinder = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void window.api.fileExplorerReveal(sessionId, target.relPath)
    }, [contextMenu, closeContextMenu, sessionId])

    const handleDropOnDir = useCallback(
      (destRelPath: string, e: React.DragEvent): void => {
        const src = dragRelPathRef.current ?? e.dataTransfer.getData('text/plain')
        if (!src || src === destRelPath) return
        if (isRelPathInside(src, destRelPath)) {
          showToast(undefined, FILE_EXPLORER_ERROR_CODES.DROP_INTO_SELF)
          return
        }
        const dest = destRelPath ? `${destRelPath}/${src.split('/').pop()}` : src.split('/').pop()!
        const parent = parentRelPath(dest)
        const newName = dest.split('/').pop()!
        const newRel = parent ? `${parent}/${newName}` : newName
        void window.api.fileExplorerMove(sessionId, src, newRel).then(async result => {
          if (!result.ok) {
            showToast(result.error, result.code)
            return
          }
          let movedIsDir = false
          for (const entries of childrenByDir.values()) {
            const found = entries.find(entry => entry.relPath === src)
            if (found) {
              movedIsDir = found.isDirectory
              break
            }
          }
          onEntryRenamed?.(src, newRel, movedIsDir)
          await refreshAfterMutation(destRelPath)
          await refreshAfterMutation(parentRelPath(src))
          await refreshGitStatus()
        })
      },
      [sessionId, childrenByDir, refreshAfterMutation, refreshGitStatus, showToast, onEntryRenamed],
    )

    const loadedFilterMatches = useMemo(() => {
      const q = filterQuery.trim().toLowerCase()
      if (!q) return [] as string[]
      const matches: string[] = []
      for (const entries of childrenByDir.values()) {
        for (const entry of entries) {
          if (entry.name.toLowerCase().includes(q) || entry.relPath.toLowerCase().includes(q)) {
            matches.push(entry.relPath)
          }
        }
      }
      return matches
    }, [filterQuery, childrenByDir])

    useEffect(() => {
      const q = filterQuery.trim()
      if (!q) return
      const id = window.setTimeout(() => {
        for (const rel of loadedFilterMatches) {
          expandParents(rel)
        }
      }, 150)
      return () => window.clearTimeout(id)
    }, [filterQuery, loadedFilterMatches, expandParents])

    useEffect(() => {
      const q = filterQuery.trim()
      if (!q) {
        setGlobalSearchPaths([])
        setGlobalSearchLoading(false)
        return
      }
      let cancelled = false
      setGlobalSearchLoading(true)
      const id = window.setTimeout(() => {
        void window.api.fileExplorerSearch(sessionId, q).then(result => {
          if (cancelled) return
          setGlobalSearchPaths(result.ok ? result.paths : [])
          setGlobalSearchLoading(false)
        }).catch(() => {
          if (cancelled) return
          setGlobalSearchPaths([])
          setGlobalSearchLoading(false)
        })
      }, 200)
      return () => {
        cancelled = true
        window.clearTimeout(id)
      }
    }, [filterQuery, sessionId])

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
          if (isExp) walk(entry.relPath, depth + 1)
        }
      }

      walk('', 0)

      const q = filterQuery.trim().toLowerCase()
      if (!q) return rows
      const filtered = rows.filter(
        r => r.entry.name.toLowerCase().includes(q) || r.entry.relPath.toLowerCase().includes(q),
      )
      const seen = new Set(filtered.map(r => r.entry.relPath))
      for (const relPath of globalSearchPaths) {
        if (seen.has(relPath)) continue
        const name = relPath.split('/').pop() ?? relPath
        filtered.push({
          entry: { name, relPath, isDirectory: false },
          depth: 0,
          expanded: false,
          loading: false,
        })
        seen.add(relPath)
      }
      return filtered
    }, [childrenByDir, expandedSet, loadingDirs, filterQuery, globalSearchPaths])

    const showSearchHint = useMemo(() => {
      const q = filterQuery.trim().toLowerCase()
      if (!q) return false
      if (globalSearchLoading) return true
      if (loadedFilterMatches.length === 0 && globalSearchPaths.length === 0) return true
      if (loadedFilterMatches.length === 0) return false
      for (const rel of loadedFilterMatches) {
        const parts = rel.split('/').filter(Boolean)
        let acc = ''
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]!}` : parts[i]!
          if (!childrenByDir.has(acc)) return true
        }
      }
      return false
    }, [filterQuery, loadedFilterMatches, childrenByDir, globalSearchLoading, globalSearchPaths.length])

    const visibleRowsRef = useRef(visibleRows)
    visibleRowsRef.current = visibleRows

    const useVirtual = visibleRows.length > VIRTUAL_THRESHOLD
    const virtualizer = useVirtualizer({
      count: visibleRows.length,
      getScrollElement: () => treeScrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 12,
      enabled: useVirtual,
    })
    const virtualizerRef = useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // Solo al mover el foco con teclado/clic en fila — no cuando `visibleRows` cambia
    // (p. ej. loadDir async), para no saltar al inicio mientras el usuario scrollea.
    useEffect(() => {
      const rows = visibleRowsRef.current
      if (rows.length === 0) return
      const idx = Math.min(focusedRowIndex, rows.length - 1)
      if (rows.length > VIRTUAL_THRESHOLD) {
        virtualizerRef.current.scrollToIndex(idx, { align: 'auto' })
      } else {
        const row = rows[idx]
        if (!row || !treeScrollRef.current) return
        const el = treeScrollRef.current.querySelector(
          `.file-explorer-tree-node[data-rel-path="${row.entry.relPath.replace(/"/g, '\\"')}"]`,
        )
        el?.scrollIntoView({ block: 'nearest' })
      }
    }, [focusedRowIndex])

    const handleTreeKeyDown = useCallback(
      (e: React.KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault()
          setSearchOpen(true)
          requestAnimationFrame(() => searchInputRef.current?.focus())
          return
        }
        if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          setSearchOpen(true)
          requestAnimationFrame(() => searchInputRef.current?.focus())
          return
        }

        const rows = visibleRowsRef.current
        if (rows.length === 0) return

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setFocusedRowIndex(i => Math.min(rows.length - 1, i + 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setFocusedRowIndex(i => Math.max(0, i - 1))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row?.entry.isDirectory && !expandedSet.has(row.entry.relPath)) {
            toggleDir(row.entry.relPath)
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row?.entry.isDirectory && expandedSet.has(row.entry.relPath)) {
            toggleDir(row.entry.relPath)
          }
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row) {
            if (!openOnSingleClick && !row.entry.isDirectory) {
              handleDoubleClickEntry(row.entry.relPath, row.entry.isDirectory)
            } else {
              void handleSelectEntry(row.entry.relPath, row.entry.isDirectory)
            }
          }
        } else if (e.key === 'F2') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row) {
            setRenamingEntry({
              relPath: row.entry.relPath,
              isDirectory: row.entry.isDirectory,
              name: row.entry.name,
            })
            setRenameName(row.entry.name)
          }
        } else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row) {
            const paths = multiSelected.size > 0 ? Array.from(multiSelected) : [row.entry.relPath]
            const runDelete = (): void => { void performDelete(paths) }
            if (onRequestConfirm) {
              const message = paths.length > 1
                ? t('fileExplorer.confirm.deleteMany', { count: paths.length })
                : row.entry.isDirectory
                  ? t('fileExplorer.confirm.deleteDir', { name: row.entry.name })
                  : t('fileExplorer.confirm.deleteFile', { name: row.entry.name })
              void onRequestConfirm({ type: 'delete', message, onConfirm: runDelete })
            } else {
              runDelete()
            }
          }
        }
      },
      [
        focusedRowIndex, expandedSet, toggleDir, handleSelectEntry, multiSelected,
        performDelete, onRequestConfirm, t,
      ],
    )

    const renderRow = (row: typeof visibleRows[number], index: number): React.ReactNode => (
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
        multiSelected={multiSelected.has(row.entry.relPath)}
        gitStatus={gitStatusFromMap(gitStatusByPath, row.entry.relPath)}
        isRenaming={renamingEntry?.relPath === row.entry.relPath}
        renameValue={renameName}
        onRenameChange={setRenameName}
        onRenameSubmit={() => void submitRename()}
        onRenameCancel={cancelRename}
        onToggleDir={toggleDir}
        onSelectEntry={handleSelectEntry}
        onDoubleClickEntry={handleDoubleClickEntry}
        onDragStartEntry={rel => { dragRelPathRef.current = rel }}
        onDropOnDir={handleDropOnDir}
        tabIndex={index === focusedRowIndex ? 0 : -1}
        onFocusNode={() => setFocusedRowIndex(index)}
      />
    )

    return (
      <div className="file-explorer-tree-wrap">
        <div className="file-explorer-tree__toolbar">
          <span
            className="file-explorer-tree__root-label"
            title={
              !showHiddenDirs
                ? `${treeRootCwd} — ${t('fileExplorer.toolbar.hiddenActive')}`
                : treeRootCwd
            }
          >
            {t('fileExplorer.toolbar.rootLabel', { path: sessionCwdPaneLabel(treeRootCwd, 2) })}
            {!showHiddenDirs && (
              <span className="file-explorer-tree__hidden-dot" aria-hidden />
            )}
          </span>
          <button
            type="button"
            className="file-explorer-tree__tool-btn"
            title={t('fileExplorer.toolbar.revealCwd')}
            aria-label={t('fileExplorer.toolbar.revealCwd')}
            onClick={() => { void handleRevealTerminalCwd() }}
          >
            <Icon name="terminal" size={11} aria-hidden />
          </button>
          <button
            type="button"
            className="file-explorer-tree__tool-btn"
            title={t('fileExplorer.toolbar.newMenu')}
            aria-label={t('fileExplorer.toolbar.newMenu')}
            onClick={e => setNewMenu({ x: e.clientX, y: e.clientY })}
          >
            <Icon name="plus" size={11} aria-hidden />
          </button>
          {onCloseExplorer && (
            <button
              type="button"
              className="file-explorer-tree__tool-btn file-explorer-tree__tool-btn--close"
              title={t('fileExplorer.toolbar.closeTitle')}
              aria-label={t('fileExplorer.toolbar.close')}
              onClick={onCloseExplorer}
            >
              <Icon name="close" size={9} aria-hidden />
            </button>
          )}
        </div>

        {(searchOpen || filterQuery) && (
          <div className="file-explorer-tree__search">
            <Icon name="search" size={10} aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              className="file-explorer-tree__search-input"
              value={filterQuery}
              placeholder={t('fileExplorer.search.placeholder')}
              title={`${t('fileExplorer.search.shortcutTitle')} (${shortcutLabel('F')})`}
              onChange={e => setFilterQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchOpen(false)
                  setFilterQuery('')
                  treeScrollRef.current?.focus()
                }
              }}
              spellCheck={false}
            />
            {showSearchHint && (
              <span className="file-explorer-tree__search-hint">
                {globalSearchLoading
                  ? t('fileExplorer.search.hint')
                  : t('fileExplorer.search.hintExpand')}
              </span>
            )}
          </div>
        )}

        {createMode && (
          <form
            className="file-explorer-tree__create"
            onSubmit={e => {
              e.preventDefault()
              void submitCreate()
            }}
          >
            <span className="file-explorer-tree__create-label">
              {createMode === 'file' ? t('fileExplorer.create.fileLabel') : t('fileExplorer.create.dirLabel')}
              {createParentPath
                ? t('fileExplorer.create.inDir', { dir: createParentPath })
                : ` ${t('fileExplorer.create.inRoot')}`}
            </span>
            <input
              type="text"
              className="file-explorer-tree__create-input"
              value={createName}
              placeholder={createMode === 'file'
                ? t('fileExplorer.create.filePlaceholder')
                : t('fileExplorer.create.dirPlaceholder')}
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
                {t('fileExplorer.create.submit')}
              </button>
              <button
                type="button"
                className="file-explorer-tree__create-cancel"
                disabled={creating}
                onClick={cancelCreate}
              >
                {t('fileExplorer.create.cancel')}
              </button>
            </div>
            {createError && (
              <p className="file-explorer-tree__create-error" role="alert">{createError}</p>
            )}
          </form>
        )}

        <div
          ref={treeScrollRef}
          className="file-explorer-tree"
          role="tree"
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
          onContextMenu={onTreeContextMenu}
        >
          {rootError && !loadingDirs.has('') && (
            <p className="file-explorer-tree__empty file-explorer-tree__empty--error" role="alert">
              {rootError}
            </p>
          )}
          {!rootError && visibleRows.length === 0 && !loadingDirs.has('') && !createMode && (
            <p className="file-explorer-tree__empty">
              {filterQuery.trim()
                ? t('fileExplorer.search.noMatches')
                : t('fileExplorer.empty.folderEmpty')}
            </p>
          )}
          {useVirtual ? (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const row = visibleRows[vRow.index]
                if (!row) return null
                return (
                  <div
                    key={row.entry.relPath}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vRow.size,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    {renderRow(row, vRow.index)}
                  </div>
                )
              })}
            </div>
          ) : (
            visibleRows.map((row, index) => renderRow(row, index))
          )}
          {renameError && (
            <p className="file-explorer-tree__create-error" role="alert">{renameError}</p>
          )}
        </div>

        {contextMenu && (
          <FileExplorerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            target={contextMenu.target}
            selectionCount={getSelectedRelPaths().length}
            showHiddenDirs={showHiddenDirs}
            openOnSingleClick={openOnSingleClick}
            onCopy={handleCopy}
            onCut={handleCut}
            onCopyName={handleCopyName}
            onCopyRelPath={handleCopyRelPath}
            onPaste={handlePaste}
            onRename={startRename}
            onDelete={handleDelete}
            onRevealInFinder={handleRevealInFinder}
            onNewFile={() => {
              const target = contextMenu.target
              const parent = !target
                ? ''
                : target.isDirectory
                  ? target.relPath
                  : parentRelPath(target.relPath)
              startCreate('file', parent)
            }}
            onNewDir={() => {
              const target = contextMenu.target
              const parent = !target
                ? ''
                : target.isDirectory
                  ? target.relPath
                  : parentRelPath(target.relPath)
              startCreate('dir', parent)
            }}
            onRefresh={() => {
              closeContextMenu()
              void reloadTree()
            }}
            onToggleHiddenDirs={() => {
              closeContextMenu()
              onShowHiddenDirsChange(!showHiddenDirs)
            }}
            onToggleOpenOnSingleClick={() => {
              closeContextMenu()
              onOpenOnSingleClickChange?.(!openOnSingleClick)
            }}
            onClose={closeContextMenu}
          />
        )}

        {newMenu && (
          <FileExplorerNewMenu
            x={newMenu.x}
            y={newMenu.y}
            onNewFile={() => startCreate('file')}
            onNewDir={() => startCreate('dir')}
            onClose={() => setNewMenu(null)}
          />
        )}

        {toastMessage && (
          <ExplorerToast message={toastMessage} onClose={dismissToast} />
        )}
      </div>
    )
  },
)
