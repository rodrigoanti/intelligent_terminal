import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileExplorerChangeKind, FileExplorerEntry } from '@shared/fileExplorerTypes'
import { FileExplorerTreeNode } from './FileExplorerTreeNode'

interface FileExplorerTreeProps {
  sessionId: string
  selectedPath: string | null
  onSelectFile: (relPath: string) => void
}

function sortEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

const GIT_KIND_PRIORITY: Record<FileExplorerChangeKind, number> = {
  clean: 0,
  staged: 1,
  untracked: 2,
  deleted: 3,
  modified: 4,
}

function mergeGitChangeKind(
  current: FileExplorerChangeKind,
  next: FileExplorerChangeKind,
): FileExplorerChangeKind {
  return GIT_KIND_PRIORITY[next] > GIT_KIND_PRIORITY[current] ? next : current
}

/** Estado git dominante por carpeta (según archivos descendientes con cambios). */
function buildDirGitStatuses(
  fileStatuses: Record<string, FileExplorerChangeKind>,
): Record<string, FileExplorerChangeKind> {
  const dirStatuses: Record<string, FileExplorerChangeKind> = {}

  for (const [filePath, kind] of Object.entries(fileStatuses)) {
    if (kind === 'clean') continue
    const parts = filePath.split('/')
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i]!
      dirStatuses[acc] = mergeGitChangeKind(dirStatuses[acc] ?? 'clean', kind)
    }
  }

  return dirStatuses
}

export const FileExplorerTree: React.FC<FileExplorerTreeProps> = ({
  sessionId,
  selectedPath,
  onSelectFile,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))
  const [childrenByDir, setChildrenByDir] = useState<Map<string, FileExplorerEntry[]>>(
    () => new Map(),
  )
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set())
  const [gitStatuses, setGitStatuses] = useState<Record<string, FileExplorerChangeKind>>({})

  const refreshGitMap = useCallback(async (): Promise<void> => {
    const result = await window.api.fileExplorerGitMap(sessionId)
    if (result.ok) {
      setGitStatuses(result.statuses)
    }
  }, [sessionId])

  const loadDir = useCallback(
    async (relPath: string): Promise<void> => {
      setLoadingDirs(prev => new Set(prev).add(relPath))
      try {
        const result = await window.api.fileExplorerListDir(sessionId, relPath)
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

  useEffect(() => {
    setExpanded(new Set(['']))
    setChildrenByDir(new Map())
    setGitStatuses({})
    void loadDir('')
    void refreshGitMap()
  }, [sessionId, loadDir, refreshGitMap])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshGitMap()
    }, 2500)
    return () => window.clearInterval(id)
  }, [refreshGitMap])

  const toggleDir = useCallback(
    (relPath: string): void => {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(relPath)) {
          next.delete(relPath)
        } else {
          next.add(relPath)
          if (!childrenByDir.has(relPath)) {
            void loadDir(relPath)
          }
        }
        return next
      })
    },
    [childrenByDir, loadDir],
  )

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
        const isExp = entry.isDirectory && expanded.has(entry.relPath)
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
  }, [childrenByDir, expanded, loadingDirs])

  const dirGitStatuses = useMemo(
    () => buildDirGitStatuses(gitStatuses),
    [gitStatuses],
  )

  return (
    <div className="file-explorer-tree" role="tree">
      {visibleRows.length === 0 && !loadingDirs.has('') && (
        <p className="file-explorer-tree__empty">Carpeta vacía</p>
      )}
      {visibleRows.map(row => (
        <FileExplorerTreeNode
          key={row.entry.relPath}
          entry={row.entry}
          depth={row.depth}
          expanded={row.expanded}
          loading={row.loading}
          selected={selectedPath === row.entry.relPath}
          changeKind={
            row.entry.isDirectory
              ? (dirGitStatuses[row.entry.relPath] ?? 'clean')
              : (gitStatuses[row.entry.relPath] ?? 'clean')
          }
          onToggleDir={toggleDir}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  )
}
